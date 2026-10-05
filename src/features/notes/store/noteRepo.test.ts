import 'fake-indexeddb/auto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { openNote, randomBytes, type Bytes } from '@/features/vault/crypto'
import { db } from '@/shared/db'

import {
  createNote,
  deleteNote,
  destroyNote,
  listNotes,
  listRevisions,
  restoreNote,
  updateNote,
} from './noteRepo'

let dek: Bytes

beforeEach(async () => {
  await db.transaction('rw', db.meta, db.notes, db.revisions, async () => {
    await db.meta.clear()
    await db.notes.clear()
    await db.revisions.clear()
  })
  dek = randomBytes(32)
})

afterEach(() => {
  vi.unstubAllGlobals()
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
    const row = (await db.notes.get(id))!
    await expect(openNote(randomBytes(32), row!, row!.sealed)).rejects.toThrow()
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
    await deleteNote(dek, id)
    const notes = await listNotes(dek)
    expect(notes).toHaveLength(1)
    expect(notes[0].deleted).toBe(true)
    const row = await db.notes.get(id)
    expect(row!.deleted).toBe(1)
  })

  it('restore clears the tombstone and destroy removes the row', async () => {
    const { id } = await createNote(dek, { title: 't', body: 'b', tags: [] })
    await deleteNote(dek, id)
    await restoreNote(dek, id)
    expect((await listNotes(dek))[0].deleted).toBe(false)
    await destroyNote(id)
    expect(await listNotes(dek)).toHaveLength(0)
  })

  it('trash and restore keep the ciphertext readable', async () => {
    // Both move `updatedAt` without touching the content, so both must re-seal. If they did not,
    // the timestamp would stop matching the AAD and the note would stop opening at all.
    const { id } = await createNote(dek, { title: 'başlık', body: 'gövde', tags: ['x'] })
    await deleteNote(dek, id)
    expect((await listNotes(dek))[0]).toMatchObject({ title: 'başlık', body: 'gövde' })
    await restoreNote(dek, id)
    expect((await listNotes(dek))[0]).toMatchObject({ title: 'başlık', body: 'gövde', tags: ['x'] })
  })

  it('trash re-seals, so the old timestamp no longer opens the row', async () => {
    const created = await createNote(dek, { title: 't', body: 'b', tags: [] })
    const before = (await db.notes.get(created.id))!
    await deleteNote(dek, created.id)
    const after = (await db.notes.get(created.id))!
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt)
    expect(after.sealed.ct).not.toBe(before.sealed.ct)
  })
})

describe('noteRepo version history (device-local)', () => {
  it('snapshots the prior content before a content edit, newest first', async () => {
    const created = await createNote(dek, { title: 't', body: 'ilk', tags: [] })
    const updated = await updateNote(dek, created, { title: 't', body: 'ikinci', tags: [] })

    expect(updated.version).toBe(created.version + 1)
    const revisions = await listRevisions(dek, created.id)
    expect(revisions).toHaveLength(1)
    expect(revisions[0]).toMatchObject({ version: created.version, body: 'ilk' })
  })

  it('does not snapshot metadata-only updates (pin/archive/folder)', async () => {
    const created = await createNote(dek, { title: 't', body: 'b', tags: [] })
    await updateNote(dek, created, { title: 't', body: 'b', tags: [], pinned: true })
    expect(await listRevisions(dek, created.id)).toHaveLength(0)
  })

  it('prunes history to the configured retention limit', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    })
    store.set('vaultnote.revisionLimit', '5')

    let note = await createNote(dek, { title: 't', body: 'v0', tags: [] })
    for (const body of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) {
      note = await updateNote(dek, note, { title: 't', body, tags: [] })
    }
    const revisions = await listRevisions(dek, note.id)
    expect(revisions.map((revision) => revision.body)).toEqual(['v5', 'v4', 'v3', 'v2', 'v1'])
  })

  it('destroyNote drops the history too', async () => {
    const created = await createNote(dek, { title: 't', body: 'a', tags: [] })
    const updated = await updateNote(dek, created, { title: 't', body: 'b', tags: [] })
    expect(await listRevisions(dek, updated.id)).toHaveLength(1)
    await destroyNote(updated.id)
    expect(await listRevisions(dek, updated.id)).toHaveLength(0)
  })
})
