import type { VaultHeader, VaultMode } from '@/features/vault/crypto'

import type { DriveClient } from './drive/types'

/** Plaintext bootstrap: everything a *new* device needs to find and unlock the vault. The
 * header is not secret (KDF salt + wrapped key + key-check), so it is stored unencrypted. */
export const BOOTSTRAP_NAME = 'vaultnote.vault.json'

export interface BootstrapSettings {
  mode: VaultMode
  deviceId: string
  createdAt: number
}

export interface VaultBootstrap {
  header: VaultHeader
  settings: BootstrapSettings
}

export async function uploadBootstrap(
  drive: DriveClient,
  bootstrap: VaultBootstrap,
): Promise<void> {
  const files = await drive.list()
  const existing = files.find((f) => f.name === BOOTSTRAP_NAME)
  const content = JSON.stringify(bootstrap)
  if (existing) await drive.update(existing.id, content)
  else await drive.create(BOOTSTRAP_NAME, content)
}

export async function downloadBootstrap(
  drive: DriveClient,
): Promise<VaultBootstrap | undefined> {
  const files = await drive.list()
  const file = files.find((f) => f.name === BOOTSTRAP_NAME)
  if (!file) return undefined
  return JSON.parse(await drive.download(file.id)) as VaultBootstrap
}
