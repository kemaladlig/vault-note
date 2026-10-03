import { db } from '@/shared/db'
import { newId } from '@/shared/ids'
import { now } from '@/shared/time'

import type { VaultHeader, VaultMode } from '../crypto'

const HEADER_KEY = 'vault.header'
const SETTINGS_KEY = 'vault.settings'

export interface VaultSettings {
  readonly mode: VaultMode
  readonly deviceId: string
  readonly createdAt: number
}

export async function loadHeader(): Promise<VaultHeader | undefined> {
  const row = await db.meta.get(HEADER_KEY)
  return row?.value as VaultHeader | undefined
}

export async function loadSettings(): Promise<VaultSettings | undefined> {
  const row = await db.meta.get(SETTINGS_KEY)
  return row?.value as VaultSettings | undefined
}

export async function saveVault(header: VaultHeader, mode: VaultMode): Promise<VaultSettings> {
  const existing = await loadSettings()
  const settings: VaultSettings = {
    mode,
    deviceId: existing?.deviceId ?? newId(),
    createdAt: existing?.createdAt ?? now(),
  }
  await db.transaction('rw', db.meta, async () => {
    await db.meta.put({ key: HEADER_KEY, value: header })
    await db.meta.put({ key: SETTINGS_KEY, value: settings })
  })
  return settings
}

/** Wipe vault metadata and all notes. Used by "reset vault", never by normal lock. */
export async function destroyVault(): Promise<void> {
  await db.transaction('rw', db.meta, db.notes, async () => {
    await db.meta.clear()
    await db.notes.clear()
  })
}
