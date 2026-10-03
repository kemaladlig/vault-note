import type { Bytes } from '@/features/vault/crypto'
import { db } from '@/shared/db'
import { openFolders, sealFolders, type Folder } from '@/shared/folders'

const DOC = 'folders'
const UPDATED_AT = 'foldersUpdatedAt'
const MODIFIED_TIME = 'foldersModifiedTime'

export interface FoldersLocalState {
  folders: Folder[]
  updatedAt: number
  modifiedTime?: string
}

/**
 * The notebook tree is kept as a single sealed doc in the meta table, so folder names never
 * sit in cleartext at rest. `updatedAt`/`modifiedTime` are sync bookkeeping (not sensitive).
 */
export async function loadFolders(dek: Bytes): Promise<FoldersLocalState> {
  const [doc, at, modified] = await Promise.all([
    db.meta.get(DOC),
    db.meta.get(UPDATED_AT),
    db.meta.get(MODIFIED_TIME),
  ])
  const updatedAt = typeof at?.value === 'number' ? at.value : 0
  const modifiedTime = typeof modified?.value === 'string' ? modified.value : undefined
  if (!doc) return { folders: [], updatedAt, modifiedTime }
  const opened = await openFolders(dek, doc.value as string)
  return { folders: opened.folders, updatedAt: opened.updatedAt, modifiedTime }
}

export async function saveFolders(
  dek: Bytes,
  folders: Folder[],
  updatedAt: number,
  modifiedTime?: string,
): Promise<void> {
  const sealed = await sealFolders(dek, { folders, updatedAt })
  await db.meta.bulkPut([
    { key: DOC, value: sealed },
    { key: UPDATED_AT, value: updatedAt },
    { key: MODIFIED_TIME, value: modifiedTime ?? null },
  ])
}
