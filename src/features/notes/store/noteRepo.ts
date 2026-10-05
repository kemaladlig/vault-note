import { openNote, restampNote, sealNote, type Bytes } from '@/features/vault/crypto'
import { db, type NoteRow } from '@/shared/db'
import { newId } from '@/shared/ids'
import { getRevisionLimit } from '@/shared/revisions'
import { now } from '@/shared/time'

import type { DecryptedNote, NoteContent } from '../model'

/** A decrypted historical snapshot shown in the version-history UI. */
export interface NoteRevision {
  version: number
  /** The note's `updatedAt` when this snapshot was taken. */
  updatedAt: number
  title: string
  body: string
  tags: string[]
  pinned?: boolean
  folderId?: string
  archived?: boolean
}

async function decrypt(row: NoteRow, dek: Bytes): Promise<DecryptedNote> {
  const payload = await openNote(dek, row, row.sealed)
  return {
    id: row.id,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deleted: row.deleted === 1,
    ...payload,
  }
}

/** Every note in the vault (active, archived and trashed); newest first. */
export async function listNotes(dek: Bytes): Promise<DecryptedNote[]> {
  const rows = await db.notes.toArray()
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
    sealed: await sealNote(dek, { id, version: 1, updatedAt: ts }, content),
  }
  await db.notes.put(row)
  return { id, version: 1, createdAt: ts, updatedAt: ts, deleted: false, ...content }
}

/**
 * Keep only the newest `limit` snapshots for a note (`0` = unlimited). Oldest are dropped.
 */
async function pruneRevisions(noteId: string): Promise<void> {
  const limit = getRevisionLimit()
  if (limit <= 0) return
  const rows = await db.revisions.where('noteId').equals(noteId).sortBy('version')
  const excess = rows.length - limit
  if (excess <= 0) return
  await db.revisions.bulkDelete(rows.slice(0, excess).map((row) => [row.noteId, row.version]))
}

/** Snapshot the prior row into the (device-local) history before it is overwritten. */
async function snapshot(prior: NoteRow): Promise<void> {
  await db.revisions.put({
    noteId: prior.id,
    version: prior.version,
    updatedAt: prior.updatedAt,
    sealed: prior.sealed,
  })
  await pruneRevisions(prior.id)
}

export async function updateNote(
  dek: Bytes,
  note: DecryptedNote,
  content: NoteContent,
): Promise<DecryptedNote> {
  // Only a genuine content change is worth a history entry; pin/move/archive churn is not.
  const contentChanged =
    content.title !== note.title ||
    content.body !== note.body ||
    content.tags.join('\u0000') !== note.tags.join('\u0000')
  const prior = contentChanged ? await db.notes.get(note.id) : undefined
  if (prior) await snapshot(prior)

  const version = note.version + 1
  const ts = now()
  const row: NoteRow = {
    id: note.id,
    version,
    createdAt: note.createdAt,
    updatedAt: ts,
    deleted: note.deleted ? 1 : 0,
    dirty: 1,
    sealed: await sealNote(dek, { id: note.id, version, updatedAt: ts }, content),
  }
  await db.notes.put(row)
  return { ...note, ...content, version, updatedAt: ts }
}

/** Decrypted history for one note, newest first. Empty until the note has been edited. */
export async function listRevisions(dek: Bytes, noteId: string): Promise<NoteRevision[]> {
  const rows = await db.revisions.where('noteId').equals(noteId).toArray()
  const revisions = await Promise.all(
    rows.map(async (row) => {
      const payload = await openNote(
        dek,
        { id: row.noteId, version: row.version, updatedAt: row.updatedAt },
        row.sealed,
      )
      return { version: row.version, updatedAt: row.updatedAt, ...payload }
    }),
  )
  return revisions.sort((a, b) => b.version - a.version)
}

/** Drop all history for a note (called when it is permanently removed). */
export async function deleteRevisions(noteId: string): Promise<void> {
  await db.revisions.where('noteId').equals(noteId).delete()
}

/** Re-apply the retention limit to every note (called after the setting changes). */
export async function pruneAllRevisions(): Promise<void> {
  const noteIds = (await db.revisions.orderBy('noteId').uniqueKeys()) as string[]
  for (const noteId of noteIds) await pruneRevisions(noteId)
}

/** Soft delete: move to the trash. The tombstone syncs so other devices follow. */
export async function deleteNote(dek: Bytes, id: string): Promise<void> {
  const row = await db.notes.get(id)
  if (!row) return
  const updatedAt = now()
  await db.notes.put({ ...row, deleted: 1, dirty: 1, updatedAt, sealed: await restampNote(dek, row, updatedAt) })
}

/** Restore from the trash (undelete). */
export async function restoreNote(dek: Bytes, id: string): Promise<void> {
  const row = await db.notes.get(id)
  if (!row) return
  const updatedAt = now()
  await db.notes.put({ ...row, deleted: 0, dirty: 1, updatedAt, sealed: await restampNote(dek, row, updatedAt) })
}

/** Permanently remove a note from this device (and its local history). */
export async function destroyNote(id: string): Promise<void> {
  await db.revisions.where('noteId').equals(id).delete()
  await db.notes.delete(id)
}

/** Permanently remove every trashed note from this device. */
export async function emptyTrash(): Promise<void> {
  const rows = await db.notes.where('deleted').equals(1).toArray()
  const ids = rows.map((row) => row.id)
  if (ids.length > 0) await db.revisions.where('noteId').anyOf(ids).delete()
  await db.notes.bulkDelete(ids)
}
