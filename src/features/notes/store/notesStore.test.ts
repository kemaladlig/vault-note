import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { randomBytes } from '@/features/vault/crypto'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { db } from '@/shared/db'

import type { DecryptedNote } from '../model'
import { isPristineEmpty, useNotesStore } from './notesStore'

function blank(overrides: Partial<DecryptedNote> = {}): DecryptedNote {
  return {
    id: 'n1',
    title: '',
    body: '',
    tags: [],
    pinned: false,
    folderId: undefined,
    archived: false,
    deleted: false,
    version: 1,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('isPristineEmpty', () => {
  it('matches an untouched empty note', () => {
    expect(isPristineEmpty(blank())).toBe(true)
  })

  it('rejects notes with content', () => {
    expect(isPristineEmpty(blank({ title: 'a' }))).toBe(false)
    expect(isPristineEmpty(blank({ body: '  x  ' }))).toBe(false)
    expect(isPristineEmpty(blank({ tags: ['a'] }))).toBe(false)
  })

  it('rejects notes with organization intent or history', () => {
    expect(isPristineEmpty(blank({ pinned: true }))).toBe(false)
    expect(isPristineEmpty(blank({ folderId: 'f1' }))).toBe(false)
    expect(isPristineEmpty(blank({ archived: true }))).toBe(false)
    // Deliberately emptied (edited at least once) — never prune.
    expect(isPristineEmpty(blank({ version: 2 }))).toBe(false)
    expect(isPristineEmpty(blank({ deleted: true }))).toBe(false)
  })
})

describe('empty-note pruning', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.revisions.clear()
    await db.meta.clear()
    useVaultStore.setState({ dek: randomBytes(32) })
    useNotesStore.setState({ notes: [], selectedId: undefined, openIds: [], revision: 0 })
  })

  it('trashes a pristine empty note when switching away', async () => {
    const store = useNotesStore.getState()
    const empty = await store.create()
    const second = await useNotesStore
      .getState()
      .create({ title: 'dolu', body: 'içerik', tags: [] })
    await useNotesStore.getState().select(empty.id)
    await useNotesStore.getState().select(second.id)
    const notes = useNotesStore.getState().notes
    expect(notes.find((note) => note.id === empty.id)?.deleted).toBe(true)
    expect(notes.find((note) => note.id === second.id)?.deleted).toBe(false)
  })

  it('keeps a deliberately emptied note (version 2+)', async () => {
    const store = useNotesStore.getState()
    const first = await store.create()
    const second = await useNotesStore
      .getState()
      .create({ title: 'dolu', body: 'içerik', tags: [] })
    await useNotesStore
      .getState()
      .update(second.id, { title: '', body: '', tags: [], pinned: false, folderId: undefined, archived: false })
    await useNotesStore.getState().select(first.id)
    await useNotesStore.getState().select(second.id)
    const notes = useNotesStore.getState().notes
    expect(notes.find((note) => note.id === second.id)?.deleted).toBe(false)
  })
})
