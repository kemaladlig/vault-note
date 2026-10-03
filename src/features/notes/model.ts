/** Decrypted note shapes used by the UI. Never persisted as-is. */

export interface NoteContent {
  title: string
  body: string
  tags: string[]
}

export interface DecryptedNote extends NoteContent {
  id: string
  version: number
  createdAt: number
  updatedAt: number
}

export const EMPTY_NOTE: NoteContent = { title: '', body: '', tags: [] }
