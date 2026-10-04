import { db } from '@/shared/db'

import { open, seal, utf8ToBytes, type Bytes, type Sealed } from '../crypto'
import { getOrCreateDeviceKey } from './deviceKey'

const QUICK_KEY = 'vault.quickUnlock'
const AAD = utf8ToBytes('vaultnote:v1:quick-unlock')

/**
 * Device-seal the Vault Key (DEK) under this device's non-extractable key. Exposed so an
 * optional PIN gate can wrap the same blob without re-deriving device-key handling.
 */
export async function sealQuickUnlock(dek: Bytes): Promise<Sealed> {
  const deviceKey = await getOrCreateDeviceKey()
  return seal(deviceKey, dek, AAD)
}

/** Recover the Vault Key from a device-sealed blob. Throws on a wrong device key. */
export async function openQuickUnlockBlob(sealed: Sealed): Promise<Bytes> {
  const deviceKey = await getOrCreateDeviceKey()
  return open(deviceKey, sealed, AAD)
}

/** Wrap the Vault Key under this device's non-extractable key so we can skip the passphrase. */
export async function enableQuickUnlock(dek: Bytes): Promise<void> {
  const sealed = await sealQuickUnlock(dek)
  await db.meta.put({ key: QUICK_KEY, value: sealed })
}

export async function hasQuickUnlock(): Promise<boolean> {
  return Boolean(await db.meta.get(QUICK_KEY))
}

/** Recover the Vault Key without a passphrase. Throws if quick unlock was never enabled. */
export async function quickUnlock(): Promise<Bytes> {
  const row = await db.meta.get(QUICK_KEY)
  if (!row) throw new Error('Bu cihazda hızlı açma etkin değil.')
  return openQuickUnlockBlob(row.value as Sealed)
}

export async function disableQuickUnlock(): Promise<void> {
  await db.meta.delete(QUICK_KEY)
}

/** Storage key for the plain device blob; shared with the PIN gate so it can move/restore it. */
export const QUICK_UNLOCK_KEY = QUICK_KEY
