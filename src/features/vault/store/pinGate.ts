import { db } from '@/shared/db'

import {
  WrongPassphraseError,
  bytesToUtf8,
  deriveKekBytes,
  importAesKey,
  newKdfParams,
  open,
  seal,
  utf8ToBytes,
  type Bytes,
  type KdfParams,
  type Sealed,
} from '../crypto'
import {
  openQuickUnlockBlob,
  sealQuickUnlock,
  QUICK_UNLOCK_KEY,
} from './quickUnlock'

/**
 * Optional PIN gate for quick unlock. This is a **convenience lock**, not the encryption root:
 * it wraps the device-sealed Vault Key under a key derived from a 4–8 digit PIN, so recovering
 * the DEK needs both this device's key and the PIN. A short PIN alone would be brute-forceable,
 * which is why it never encrypts notes directly — the passphrase (or the OS-held device key, in
 * passwordless mode) remains the root. Wrong attempts are throttled with backoff.
 *
 * Device-local only: never synced. Stored in `db.meta`.
 */

const PIN_KEY = 'vault.quickUnlockPin'
const ATTEMPTS_KEY = 'vault.pinAttempts'
const AAD = utf8ToBytes('vaultnote:v1:pin-gate')

const PIN_MIN = 4
const PIN_MAX = 8
const FREE_ATTEMPTS = 5
const BASE_LOCK_SEC = 30
const MAX_LOCK_SEC = 300

/** Raised while a lockout from repeated failures is in effect. */
export class PinLockedError extends Error {
  readonly remainingMs: number

  constructor(remainingMs: number) {
    super('PIN geçici olarak kilitli.')
    this.name = 'PinLockedError'
    this.remainingMs = remainingMs
  }
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)
}

interface PinGateRow {
  v: 1
  kdf: KdfParams
  /** The device-sealed Vault Key, JSON-encoded, sealed under the PIN-derived key. */
  sealed: Sealed
}

interface AttemptsRow {
  count: number
  lockedUntil: number
}

export async function hasPinGate(): Promise<boolean> {
  return Boolean(await db.meta.get(PIN_KEY))
}

async function derivePinKey(pin: string, kdf: KdfParams): Promise<CryptoKey> {
  return importAesKey(await deriveKekBytes(pin, kdf))
}

/**
 * Enable the PIN gate: move the plain device blob behind a PIN-derived key and drop the plain
 * copy so the PIN cannot be bypassed by reading `vault.quickUnlock`.
 */
export async function setPin(
  pin: string,
  dek: Bytes,
  kdfOverrides?: Partial<Omit<KdfParams, 'salt'>>,
): Promise<void> {
  const kdf = newKdfParams(kdfOverrides)
  const pinKey = await derivePinKey(pin, kdf)
  const inner = await sealQuickUnlock(dek)
  const sealed = await seal(pinKey, utf8ToBytes(JSON.stringify(inner)), AAD)
  const row: PinGateRow = { v: 1, kdf, sealed }
  await db.transaction('rw', db.meta, async () => {
    await db.meta.put({ key: PIN_KEY, value: row })
    await db.meta.delete(QUICK_UNLOCK_KEY)
    await db.meta.delete(ATTEMPTS_KEY)
  })
}

/** Unlock with the PIN, returning the Vault Key. Throws on a wrong PIN or during lockout. */
export async function unlockWithPin(pin: string): Promise<Bytes> {
  const row = (await db.meta.get(PIN_KEY))?.value as PinGateRow | undefined
  if (!row) throw new Error('Bu cihazda PIN kilidi etkin değil.')
  await assertNotLocked()

  let innerJson: Bytes
  try {
    innerJson = await open(await derivePinKey(pin, row.kdf), row.sealed, AAD)
  } catch {
    await recordFailure()
    throw new WrongPassphraseError()
  }
  const inner = JSON.parse(bytesToUtf8(innerJson)) as Sealed
  const dek = await openQuickUnlockBlob(inner)
  await db.meta.delete(ATTEMPTS_KEY)
  return dek
}

/** Remove the PIN gate after verifying it, restoring the plain device blob. */
export async function clearPin(pin: string): Promise<void> {
  const dek = await unlockWithPin(pin)
  const plain = await sealQuickUnlock(dek)
  await db.transaction('rw', db.meta, async () => {
    await db.meta.put({ key: QUICK_UNLOCK_KEY, value: plain })
    await db.meta.delete(PIN_KEY)
    await db.meta.delete(ATTEMPTS_KEY)
  })
}

/** Replace the PIN after verifying the current one. */
export async function changePin(currentPin: string, nextPin: string): Promise<void> {
  const dek = await unlockWithPin(currentPin)
  await setPin(nextPin, dek)
}

/** Drop all PIN state on this device (used when forgetting the device / resetting). */
export async function clearPinState(): Promise<void> {
  await db.meta.delete(PIN_KEY)
  await db.meta.delete(ATTEMPTS_KEY)
}

async function readAttempts(): Promise<AttemptsRow> {
  const row = (await db.meta.get(ATTEMPTS_KEY))?.value as AttemptsRow | undefined
  return row ?? { count: 0, lockedUntil: 0 }
}

async function assertNotLocked(): Promise<void> {
  const { lockedUntil } = await readAttempts()
  const remaining = lockedUntil - Date.now()
  if (remaining > 0) throw new PinLockedError(remaining)
}

/** Count a failed attempt; after a free allowance, lock for an exponentially growing window. */
async function recordFailure(): Promise<void> {
  const { count } = await readAttempts()
  const next = count + 1
  let lockedUntil = 0
  if (next >= FREE_ATTEMPTS) {
    const secs = Math.min(MAX_LOCK_SEC, BASE_LOCK_SEC * 2 ** (next - FREE_ATTEMPTS))
    lockedUntil = Date.now() + secs * 1000
  }
  await db.meta.put({ key: ATTEMPTS_KEY, value: { count: next, lockedUntil } })
}
