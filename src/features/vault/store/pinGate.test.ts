import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WrongPassphraseError, randomBytes, type Bytes } from '@/features/vault/crypto'
import { db } from '@/shared/db'

// The fake IndexedDB cannot structured-clone a CryptoKey, so pin the device key to one stable
// in-memory key. The PIN layer — not the device-key plumbing — is what these tests cover.
vi.mock('./deviceKey', () => {
  const key = import('@/features/vault/crypto').then(({ importAesKey, randomBytes }) =>
    importAesKey(randomBytes(32)),
  )
  return {
    getOrCreateDeviceKey: () => key,
    clearDeviceKey: async () => {},
  }
})

import {
  PinLockedError,
  changePin,
  clearPin,
  hasPinGate,
  isValidPin,
  setPin,
  unlockWithPin,
} from './pinGate'
import { enableQuickUnlock, hasQuickUnlock, quickUnlock } from './quickUnlock'

/** Fast KDF so the suite runs in milliseconds instead of seconds. */
const FAST = { memoryKiB: 1024, iterations: 1, parallelism: 1 }

let dek: Bytes

beforeEach(async () => {
  await db.meta.clear()
  dek = randomBytes(32)
})

describe('pinGate', () => {
  it('validates PIN shape', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('12345678')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('123456789')).toBe(false)
    expect(isValidPin('12ab')).toBe(false)
  })

  it('moves the device blob behind the PIN and unlocks with the right PIN', async () => {
    await enableQuickUnlock(dek)
    expect(await hasQuickUnlock()).toBe(true)

    await setPin('1234', dek, FAST)
    expect(await hasPinGate()).toBe(true)
    // The plain device blob is gone, so the PIN cannot be bypassed.
    expect(await hasQuickUnlock()).toBe(false)

    expect([...(await unlockWithPin('1234'))]).toEqual([...dek])
  })

  it('rejects a wrong PIN without leaking the key', async () => {
    await setPin('1234', dek, FAST)
    await expect(unlockWithPin('9999')).rejects.toBeInstanceOf(WrongPassphraseError)
    expect(await hasPinGate()).toBe(true)
  })

  it('restores plain quick unlock when the PIN is removed', async () => {
    await setPin('1234', dek, FAST)
    await clearPin('1234')

    expect(await hasPinGate()).toBe(false)
    expect(await hasQuickUnlock()).toBe(true)
    expect([...(await quickUnlock())]).toEqual([...dek])
  })

  it('changes the PIN after verifying the current one', async () => {
    await setPin('1234', dek, FAST)
    await changePin('1234', '5678')

    await expect(unlockWithPin('1234')).rejects.toBeInstanceOf(WrongPassphraseError)
    expect([...(await unlockWithPin('5678'))]).toEqual([...dek])
  })

  it('throttles repeated failures with a lockout', async () => {
    await setPin('1234', dek, FAST)

    for (let i = 0; i < 5; i++) {
      await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPassphraseError)
    }
    // Even the correct PIN is refused while the lockout is in effect.
    await expect(unlockWithPin('1234')).rejects.toBeInstanceOf(PinLockedError)
  })
})
