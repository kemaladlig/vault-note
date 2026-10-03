import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { openNote, randomBytes, type Bytes } from '@/features/vault/crypto'
import { db } from '@/shared/db'

import { createNote, deleteNote, destroyNote, listNotes, restoreNote, updateNote } from './noteRepo'

let dek: Bytes

beforeEach(async () => {
  await db.transaction('rw', db.meta, db.notes, async () => {
    await db.meta.clear()
    await db.notes.clear()
  })
  dek = randomBytes(32)
})

describe('noteRepo (encrypted at rest)', () => {
  it('round-trips a note through encryption', async () => {
    const created = await createNote(dek, {
      title: 'Alışveriş',
      body: 'süt\nyumurta',
      tags: ['ev'],
    })
    const notes = await listNotes(dek)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ title: 'Alışveriş', body: 'süt\nyumurta', tags: ['ev'] })
    expect(notes[0].id).toBe(created.id)
  })

  it('stores only ciphertext on disk', async () => {
    const { id } = await createNote(dek, { title: 'gizli-baslik', body: 'gizli-gövde', tags: [] })
    const row = await db.notes.get(id)
    expect(row).toBeDefined()
    const serialized = JSON.stringify(row)
    expect(serialized).not.toContain('gizli-baslik')
    expect(serialized).not.toContain('gizli-gövde')
  })

  it('the raw ciphertext cannot be opened with the wrong key', async () => {
    const { id } = await createNote(dek, { title: 't', body: 'b', tags: [] })
    const row = await db.notes.get(id)
    await expect(openNote(randomBytes(32), id, row!.version, row!.sealed)).rejects.toThrow()
  })

  it('update bumps the version and replaces the ciphertext', async () => {
    const created = await createNote(dek, { title: 't', body: 'ilk', tags: [] })
    const before = await db.notes.get(created.id)
    const updated = await updateNote(dek, created, { title: 't', body: 'ikinci', tags: [] })

    expect(updated.version).toBe(created.version + 1)
    const after = await db.notes.get(created.id)
    expect(after!.sealed.ct).not.toBe(before!.sealed.ct)
    expect((await listNotes(dek))[0].body).toBe('ikinci')
  })

  it('delete soft-hides the note as a trashed row', async () => {
    const { id } = await createNote(dek, { title: 't', body: 'b', tags: [] })
    await deleteNote(id)
    const notes = await listNotes(dek)
    expect(notes).toHaveLength(1)
    expect(notes[0].deleted).toBe(true)
    const row = await db.notes.get(id)
    expect(row!.deleted).toBe(1)
  })

  it('restore clears the tombstone and destroy removes the row', async () => {
    const { id } = await createNote(dek, { title: 't', body: 'b', tags: [] })
    await deleteNote(id)
    await restoreNote(id)
    expect((await listNotes(dek))[0].deleted).toBe(false)
    await destroyNote(id)
    expect(await listNotes(dek)).toHaveLength(0)
  })
})
