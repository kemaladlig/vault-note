/** Decrypted note shapes used by the UI. Never persisted as-is. */

import type { Folder } from '@/shared/folders'

export type { Folder }

export interface NoteContent {
  title: string
  body: string
  tags: string[]
  /** Organized metadata, sealed alongside the content. */
  pinned?: boolean
  folderId?: string
  archived?: boolean
}

export interface DecryptedNote extends NoteContent {
  id: string
  version: number
  createdAt: number
  updatedAt: number
  /** Sync tombstone: true means the note is in the trash. */
  deleted: boolean
}

export const EMPTY_NOTE: NoteContent = { title: '', body: '', tags: [] }

/** Sidebar scope. `all` shows everything active; the rest are filtered views. */
export type NotesView = 'all' | 'pinned' | 'archive' | 'trash'

/** The organizational fields carried through the editor without being edited there. */
export function orgFields(note: NoteContent) {
  return { pinned: note.pinned, folderId: note.folderId, archived: note.archived }
}
