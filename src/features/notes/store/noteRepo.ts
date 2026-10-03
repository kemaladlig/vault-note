import { openNote, sealNote, type Bytes } from '@/features/vault/crypto'
import { db, type NoteRow } from '@/shared/db'
import { newId } from '@/shared/ids'
import { now } from '@/shared/time'

import type { DecryptedNote, NoteContent } from '../model'

async function decrypt(row: NoteRow, dek: Bytes): Promise<DecryptedNote> {
  const payload = await openNote(dek, row.id, row.version, row.sealed)
  return {
    id: row.id,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...payload,
  }
}

/** Active (non-deleted) notes, newest first. Bodies are decrypted in memory. */
export async function listNotes(dek: Bytes): Promise<DecryptedNote[]> {
  const rows = await db.notes.where('deleted').equals(0).toArray()
  const notes = await Promise.all(rows.map((row) => decrypt(row, dek)))
  return notes.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function createNote(dek: Bytes, content: NoteContent): Promise<DecryptedNote> {
  const id = newId()
  const ts = now()
  const row: NoteRow = {
    id,
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    deleted: 0,
    dirty: 1,
    sealed: await sealNote(dek, id, 1, content),
  }
  await db.notes.put(row)
  return { id, version: 1, createdAt: ts, updatedAt: ts, ...content }
}

export async function updateNote(
  dek: Bytes,
  note: DecryptedNote,
  content: NoteContent,
): Promise<DecryptedNote> {
  const version = note.version + 1
  const ts = now()
  const row: NoteRow = {
    id: note.id,
    version,
    createdAt: note.createdAt,
    updatedAt: ts,
    deleted: 0,
    dirty: 1,
    sealed: await sealNote(dek, note.id, version, content),
  }
  await db.notes.put(row)
  return { ...note, ...content, version, updatedAt: ts }
}

/** Soft delete: tombstone kept for future sync reconciliation. */
export async function deleteNote(id: string): Promise<void> {
  const row = await db.notes.get(id)
  if (!row) return
  await db.notes.put({ ...row, deleted: 1, dirty: 1, updatedAt: now() })
}
