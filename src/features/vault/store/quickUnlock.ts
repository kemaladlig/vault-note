import { db } from '@/shared/db'

import { open, seal, utf8ToBytes, type Bytes, type Sealed } from '../crypto'
import { getOrCreateDeviceKey } from './deviceKey'

const QUICK_KEY = 'vault.quickUnlock'
const AAD = utf8ToBytes('vaultnote:v1:quick-unlock')

/** Wrap the Vault Key under this device's non-extractable key so we can skip the passphrase. */
export async function enableQuickUnlock(dek: Bytes): Promise<void> {
  const deviceKey = await getOrCreateDeviceKey()
  const sealed = await seal(deviceKey, dek, AAD)
  await db.meta.put({ key: QUICK_KEY, value: sealed })
}

export async function hasQuickUnlock(): Promise<boolean> {
  return Boolean(await db.meta.get(QUICK_KEY))
}

/** Recover the Vault Key without a passphrase. Throws if quick unlock was never enabled. */
export async function quickUnlock(): Promise<Bytes> {
  const row = await db.meta.get(QUICK_KEY)
  if (!row) throw new Error('Bu cihazda hızlı açma etkin değil.')
  const deviceKey = await getOrCreateDeviceKey()
  return open(deviceKey, row.value as Sealed, AAD)
}

export async function disableQuickUnlock(): Promise<void> {
  await db.meta.delete(QUICK_KEY)
}
