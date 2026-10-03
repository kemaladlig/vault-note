import {
  bytesToUtf8,
  deriveFoldersKey,
  open,
  seal,
  utf8ToBytes,
  type Bytes,
  type Sealed,
} from '@/features/vault/crypto'

/** A notebook node. Names are only ever persisted inside a sealed doc. */
export interface Folder {
  id: string
  name: string
  parentId?: string
  order: number
  /** Optional accent color token (see FOLDER_COLORS); render via `folderColorVar`. */
  color?: FolderColor
  createdAt: number
  updatedAt: number
}

/** Preset notebook colors, mapped to `--folder-*` CSS vars (theme-aware). */
export const FOLDER_COLORS = ['blue', 'green', 'red', 'amber', 'violet', 'teal', 'slate'] as const
export type FolderColor = (typeof FOLDER_COLORS)[number]

/** CSS color for a folder's accent, or undefined to inherit the current text color. */
export function folderColorVar(color?: string): string | undefined {
  return color ? `var(--folder-${color})` : undefined
}

/** The whole notebook tree, sealed as one document (local meta + Drive file). */
export interface FoldersDoc {
  folders: Folder[]
  updatedAt: number
}

export const FOLDERS_FILE = 'vaultnote.folders.json'

const AAD = utf8ToBytes('vaultnote:v1:folders')

export async function sealFolders(dek: Bytes, doc: FoldersDoc): Promise<string> {
  const key = await deriveFoldersKey(dek)
  const sealed = await seal(key, utf8ToBytes(JSON.stringify(doc)), AAD)
  return JSON.stringify(sealed)
}

export async function openFolders(dek: Bytes, text: string): Promise<FoldersDoc> {
  const key = await deriveFoldersKey(dek)
  const sealed = JSON.parse(text) as Sealed
  const doc = JSON.parse(bytesToUtf8(await open(key, sealed, AAD))) as FoldersDoc
  return { folders: doc.folders ?? [], updatedAt: doc.updatedAt ?? 0 }
}

/** Direct children of `parentId` (or roots), sorted by manual order then name. */
export function childFolders(folders: Folder[], parentId?: string): Folder[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'tr'))
}

/** A folder and every descendant — used for scoped note filtering and cascade deletes. */
export function folderSubtree(folders: Folder[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const folder of folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id)
        grew = true
      }
    }
  }
  return ids
}

/** Root → … → folder, for breadcrumbs. */
export function folderPath(folders: Folder[], id: string): Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: Folder[] = []
  let current = byId.get(id)
  while (current) {
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

/** Depth-first flattening with nesting depth — drives the sidebar tree and pickers. */
export function flattenFolders(
  folders: Folder[],
  parentId?: string,
  depth = 0,
): Array<{ folder: Folder; depth: number }> {
  return childFolders(folders, parentId).flatMap((folder) => [
    { folder, depth },
    ...flattenFolders(folders, folder.id, depth + 1),
  ])
}
