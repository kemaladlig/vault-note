import type { Bytes } from '@/features/vault/crypto'
import { FOLDERS_FILE, openFolders, sealFolders, type Folder } from '@/shared/folders'
import { now } from '@/shared/time'

import type { DriveClient } from './drive/types'

export interface SyncFoldersDeps {
  drive: DriveClient
  dek: Bytes
  folders: Folder[]
  updatedAt: number
  /** Drive `modifiedTime` of the folders file from the last sync. */
  modifiedTime?: string
  /** Local folder changes pending a push. */
  dirty: boolean
}

export interface FoldersSyncResult {
  folders: Folder[]
  updatedAt: number
  modifiedTime?: string
  pulled: boolean
  pushed: boolean
}

/**
 * Sync the notebook tree as one sealed document. Last-write-wins on the doc `updatedAt`.
 * Skips entirely when nothing is pending locally and the Drive file is untouched.
 */
export async function syncFolders(deps: SyncFoldersDeps): Promise<FoldersSyncResult> {
  const { drive, dek } = deps
  const unchanged = (): FoldersSyncResult => ({
    folders: deps.folders,
    updatedAt: deps.updatedAt,
    modifiedTime: deps.modifiedTime,
    pulled: false,
    pushed: false,
  })

  const file = (await drive.list()).find((entry) => entry.name === FOLDERS_FILE)

  // No remote file yet: publish the local tree (creating one is itself the change).
  if (!file) {
    if (deps.folders.length === 0) return unchanged()
    const updatedAt = Math.max(deps.updatedAt, now())
    const created = await drive.create(
      FOLDERS_FILE,
      await sealFolders(dek, { folders: deps.folders, updatedAt }),
    )
    return { folders: deps.folders, updatedAt, modifiedTime: created.modifiedTime, pulled: false, pushed: true }
  }

  if (!deps.dirty && deps.modifiedTime === file.modifiedTime) return unchanged()

  const remote = await openFolders(dek, await drive.download(file.id))

  if (remote.updatedAt > deps.updatedAt) {
    return {
      folders: remote.folders,
      updatedAt: remote.updatedAt,
      modifiedTime: file.modifiedTime,
      pulled: true,
      pushed: false,
    }
  }

  if (deps.dirty || deps.updatedAt > remote.updatedAt) {
    const updatedAt = Math.max(deps.updatedAt, now())
    const saved = await drive.update(
      file.id,
      await sealFolders(dek, { folders: deps.folders, updatedAt }),
    )
    return { folders: deps.folders, updatedAt, modifiedTime: saved.modifiedTime, pulled: false, pushed: true }
  }

  return unchanged()
}
