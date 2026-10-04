import { create } from 'zustand'

import { useVaultStore } from '@/features/vault/store/vaultStore'
import { getTrashRetentionDays, isTrashExpired } from '@/shared/trash'

import { EMPTY_NOTE, type DecryptedNote, type NoteContent, type NotesView } from '../model'
import {
  DEFAULT_SORT_DIR,
  DEFAULT_SORT_FIELD,
  defaultDirFor,
  type SortDir,
  type SortField,
} from '../sort'
import * as repo from './noteRepo'

interface NotesState {
  /** Every note in the vault (active, archived, trashed); filtered for display downstream. */
  notes: DecryptedNote[]
  selectedId?: string
  /** Open editor tabs, in order. Persisted so tabs survive a reload. */
  openIds: string[]
  loading: boolean
  /** Global sidebar filter: scope + text query + optional tag. Single source of truth. */
  view: NotesView
  folderId?: string
  query: string
  tagFilter?: string
  /** Note-list ordering. A device preference (localStorage), not vault data. */
  sortBy: SortField
  sortDir: SortDir
  /** Bumped on every local mutation; the auto-sync hook watches it to push soon after edits. */
  revision: number
  load: () => Promise<void>
  /** Re-read notes after a sync without toggling the loading skeleton. */
  reload: () => Promise<void>
  /** Select a note and make sure it has a tab. Pristine empty notes left behind go to trash. */
  select: (id?: string) => Promise<void>
  /** Trash every pristine empty note except `keepId`; returns how many were dropped. */
  dropEmpty: (keepId?: string) => Promise<number>
  /** Close a tab; the neighbour becomes active. */
  closeTab: (id: string) => void
  /** Close every open tab. */
  closeAllTabs: () => void
  /** Close every tab except the given one. */
  closeOtherTabs: (id: string) => void
  setView: (view: NotesView) => void
  setFolderFilter: (folderId?: string) => void
  setQuery: (query: string) => void
  setTagFilter: (tag?: string) => void
  /** Set the list ordering explicitly. */
  setSort: (field: SortField, dir: SortDir) => void
  /** Pick a field: re-picking the active one flips its direction. */
  chooseSort: (field: SortField) => void
  /** Apply a saved smart view's filters in one shot. */
  applyView: (filters: { query: string; tag?: string; folderId?: string; view: NotesView }) => void
  create: (content?: NoteContent) => Promise<DecryptedNote>
  /** Bulk-insert parsed imports in one revision; returns how many were created. */
  importNotes: (contents: NoteContent[]) => Promise<number>
  /** Decrypted local version history for one note, newest first (device-only). */
  listRevisions: (noteId: string) => Promise<repo.NoteRevision[]>
  /** Re-apply the revision retention limit across every note. */
  pruneRevisions: () => Promise<void>
  update: (id: string, content: NoteContent) => Promise<DecryptedNote | undefined>
  togglePin: (id: string) => Promise<void>
  setArchived: (id: string, archived: boolean) => Promise<void>
  moveToFolder: (id: string, folderId?: string) => Promise<void>
  /** Unassign the given folders' notes (used when a notebook is deleted). */
  reassignFolder: (folderIds: string[], folderId?: string) => Promise<void>
  /** Move to trash (soft delete). */
  remove: (id: string) => Promise<void>
  restore: (id: string) => Promise<void>
  /** Permanent delete from this device. */
  destroy: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  /** Hard-delete trashed notes past the retention window; returns how many were purged. */
  purgeTrash: () => Promise<number>
  /** Drop decrypted notes from memory (called when the vault locks). */
  clear: () => void
}

/** The Vault Key only lives in the vault store; this is the single place we read it. */
function requireDek() {
  const dek = useVaultStore.getState().dek
  if (!dek) throw new Error('Vault kilitli')
  return dek
}

/** Full sealed payload for a note, so metadata edits never drop the body. */
function contentOf(note: DecryptedNote): NoteContent {
  return {
    title: note.title,
    body: note.body,
    tags: note.tags,
    pinned: note.pinned,
    folderId: note.folderId,
    archived: note.archived,
  }
}

/**
 * Untouched and contentless: created but never edited, with no organization intent.
 * A note the user deliberately emptied (version 2+) is never pristine — only these
 * silent leftovers are pruned, and only into the trash (recoverable + synced).
 */
export function isPristineEmpty(note: DecryptedNote): boolean {
  return (
    note.version === 1 &&
    !note.deleted &&
    !note.archived &&
    !note.pinned &&
    !note.folderId &&
    note.tags.length === 0 &&
    !note.title.trim() &&
    !note.body.trim()
  )
}

/* Tabs are just opaque note ids, so persisting them leaks nothing; pruning happens on load. */
const TABS_KEY = 'vaultnote.tabs'
interface PersistedTabs {
  openIds: string[]
  activeId?: string
}

function readTabs(): PersistedTabs {
  if (typeof localStorage === 'undefined') return { openIds: [] }
  try {
    const parsed = JSON.parse(localStorage.getItem(TABS_KEY) ?? '{}') as Partial<PersistedTabs>
    return {
      openIds: Array.isArray(parsed.openIds) ? parsed.openIds : [],
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : undefined,
    }
  } catch {
    return { openIds: [] }
  }
}

function writeTabs(openIds: string[], activeId?: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify({ openIds, activeId }))
  } catch {
    /* storage full or unavailable — tabs just fall back to session memory */
  }
}

/* List ordering is a viewing preference, so it lives with theme/scale, not in the vault. */
const SORT_KEY = 'vaultnote.sort'

function readSort(): { field: SortField; dir: SortDir } {
  if (typeof localStorage === 'undefined') return { field: DEFAULT_SORT_FIELD, dir: DEFAULT_SORT_DIR }
  try {
    const parsed = JSON.parse(localStorage.getItem(SORT_KEY) ?? '{}') as Partial<{
      field: SortField
      dir: SortDir
    }>
    const field =
      parsed.field === 'updatedAt' || parsed.field === 'createdAt' || parsed.field === 'title'
        ? parsed.field
        : DEFAULT_SORT_FIELD
    const dir =
      parsed.dir === 'asc' || parsed.dir === 'desc'
        ? parsed.dir
        : defaultDirFor(field)
    return { field, dir }
  } catch {
    return { field: DEFAULT_SORT_FIELD, dir: DEFAULT_SORT_DIR }
  }
}

function writeSort(field: SortField, dir: SortDir): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify({ field, dir }))
  } catch {
    /* storage unavailable — ordering just falls back to the default next launch */
  }
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  selectedId: undefined,
  openIds: [],
  loading: false,
  view: 'all',
  folderId: undefined,
  query: '',
  tagFilter: undefined,
  ...(() => {
    const sort = readSort()
    return { sortBy: sort.field, sortDir: sort.dir }
  })(),
  revision: 0,

  load: async () => {
    set({ loading: true })
    const notes = await repo.listNotes(requireDek())
    const alive = new Set(notes.map((note) => note.id))
    const persisted = readTabs()
    const openIds = persisted.openIds.filter((id) => alive.has(id))
    const selectedId =
      persisted.activeId && alive.has(persisted.activeId) ? persisted.activeId : openIds[0]
    set({ notes, loading: false, openIds, selectedId })
    writeTabs(openIds, selectedId)
    // Crash leftovers: untouched empty notes from a killed session go to trash,
    // except the note being restored (the user may still type into it).
    try {
      await get().dropEmpty(selectedId)
    } catch {
      /* retried on the next note switch */
    }
    await get().purgeTrash()
  },

  reload: async () => {
    const notes = await repo.listNotes(requireDek())
    const alive = new Set(notes.map((note) => note.id))
    const state = get()
    const openIds = state.openIds.filter((id) => alive.has(id))
    const selectedId =
      state.selectedId && alive.has(state.selectedId) ? state.selectedId : openIds[0]
    set({ notes, openIds, selectedId })
    writeTabs(openIds, selectedId)
    await get().purgeTrash()
  },

  select: async (id) => {
    // Leaving an untouched empty note behind trashes it (recoverable, synced like trash).
    const current = get().selectedId
    if (current && current !== id) {
      try {
        await get().dropEmpty(id)
      } catch {
        /* Dexie hiccup — the empty note stays; retried on the next switch */
      }
    }
    if (!id) {
      set({ selectedId: undefined })
      writeTabs(get().openIds, undefined)
      return
    }
    const openIds = get().openIds.includes(id) ? get().openIds : [...get().openIds, id]
    set({ selectedId: id, openIds })
    writeTabs(openIds, id)
  },

  dropEmpty: async (keepId) => {
    const targets = get().notes.filter((note) => note.id !== keepId && isPristineEmpty(note))
    for (const target of targets) {
      await get().remove(target.id)
    }
    return targets.length
  },

  closeTab: (id) => {
    const state = get()
    const index = state.openIds.indexOf(id)
    const openIds = state.openIds.filter((item) => item !== id)
    const selectedId =
      state.selectedId === id ? (openIds[index] ?? openIds[index - 1]) : state.selectedId
    set({ openIds, selectedId })
    writeTabs(openIds, selectedId)
    void get()
      .dropEmpty(selectedId)
      .catch(() => {})
  },

  closeAllTabs: () => {
    set({ openIds: [], selectedId: undefined })
    writeTabs([], undefined)
    void get()
      .dropEmpty()
      .catch(() => {})
  },

  closeOtherTabs: (id) => {
    set({ openIds: [id], selectedId: id })
    writeTabs([id], id)
    void get()
      .dropEmpty(id)
      .catch(() => {})
  },

  setView: (view) => set({ view, folderId: undefined }),
  setFolderFilter: (folderId) => set({ folderId, view: 'all' }),
  setQuery: (query) => set({ query }),
  setTagFilter: (tagFilter) => set({ tagFilter }),
  setSort: (sortBy, sortDir) => {
    writeSort(sortBy, sortDir)
    set({ sortBy, sortDir })
  },
  chooseSort: (field) => {
    const { sortBy, sortDir } = get()
    const nextDir: SortDir = field === sortBy ? (sortDir === 'asc' ? 'desc' : 'asc') : defaultDirFor(field)
    writeSort(field, nextDir)
    set({ sortBy: field, sortDir: nextDir })
  },
  applyView: (filters) =>
    set({
      query: filters.query,
      tagFilter: filters.tag,
      folderId: filters.folderId,
      view: filters.view,
    }),

  create: async (content = EMPTY_NOTE) => {
    const note = await repo.createNote(requireDek(), content)
    const openIds = [...get().openIds, note.id]
    set((state) => ({
      notes: [note, ...state.notes],
      selectedId: note.id,
      openIds,
      revision: state.revision + 1,
    }))
    writeTabs(openIds, note.id)
    return note
  },

  importNotes: async (contents) => {
    const created: DecryptedNote[] = []
    for (const content of contents) {
      created.push(await repo.createNote(requireDek(), content))
    }
    if (created.length === 0) return 0
    set((state) => ({
      notes: [...created, ...state.notes],
      revision: state.revision + 1,
    }))
    return created.length
  },

  listRevisions: (noteId) => repo.listRevisions(requireDek(), noteId),

  pruneRevisions: () => repo.pruneAllRevisions(),

  update: async (id, content) => {
    const note = get().notes.find((n) => n.id === id)
    if (!note) return undefined
    const saved = await repo.updateNote(requireDek(), note, content)
    // Keep list order stable while typing; only touch the edited row.
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? saved : n)),
      revision: state.revision + 1,
    }))
    return saved
  },

  togglePin: async (id) => {
    const note = get().notes.find((n) => n.id === id)
    if (!note) return
    await get().update(id, { ...contentOf(note), pinned: !note.pinned })
  },

  setArchived: async (id, archived) => {
    const note = get().notes.find((n) => n.id === id)
    if (!note) return
    await get().update(id, { ...contentOf(note), archived })
  },

  moveToFolder: async (id, folderId) => {
    const note = get().notes.find((n) => n.id === id)
    if (!note) return
    await get().update(id, { ...contentOf(note), folderId })
  },

  reassignFolder: async (folderIds, folderId) => {
    const targets = get().notes.filter((note) => note.folderId && folderIds.includes(note.folderId))
    for (const note of targets) {
      await get().update(note.id, { ...contentOf(note), folderId })
    }
  },

  remove: async (id) => {
    await repo.deleteNote(id)
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, deleted: true } : n)),
      revision: state.revision + 1,
    }))
  },

  restore: async (id) => {
    await repo.restoreNote(id)
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, deleted: false } : n)),
      revision: state.revision + 1,
    }))
  },

  destroy: async (id) => {
    await repo.destroyNote(id)
    const state = get()
    const notes = state.notes.filter((n) => n.id !== id)
    const openIds = state.openIds.filter((item) => item !== id)
    const selectedId = state.selectedId === id ? openIds[0] : state.selectedId
    set({ notes, openIds, selectedId })
    writeTabs(openIds, selectedId)
  },

  emptyTrash: async () => {
    await repo.emptyTrash()
    const state = get()
    const removed = new Set(state.notes.filter((n) => n.deleted).map((n) => n.id))
    const notes = state.notes.filter((n) => !n.deleted)
    const openIds = state.openIds.filter((id) => !removed.has(id))
    const selectedId = state.selectedId && removed.has(state.selectedId) ? openIds[0] : state.selectedId
    set({ notes, openIds, selectedId })
    writeTabs(openIds, selectedId)
  },

  purgeTrash: async () => {
    const days = getTrashRetentionDays()
    if (days <= 0) return 0
    const nowMs = Date.now()
    const expired = get().notes.filter(
      (note) => note.deleted && isTrashExpired(note.updatedAt, nowMs, days),
    )
    if (expired.length === 0) return 0
    for (const note of expired) await repo.destroyNote(note.id)
    const removed = new Set(expired.map((note) => note.id))
    const state = get()
    const notes = state.notes.filter((note) => !removed.has(note.id))
    const openIds = state.openIds.filter((id) => !removed.has(id))
    const selectedId =
      state.selectedId && removed.has(state.selectedId) ? openIds[0] : state.selectedId
    set({ notes, openIds, selectedId, revision: state.revision + 1 })
    writeTabs(openIds, selectedId)
    return expired.length
  },

  clear: () =>
    set({
      notes: [],
      selectedId: undefined,
      openIds: [],
      loading: false,
      view: 'all',
      folderId: undefined,
      query: '',
      tagFilter: undefined,
    }),
}))

// Security: decrypted notes must not linger in memory once the vault is no longer unlocked.
useVaultStore.subscribe((state, previous) => {
  if (previous.status === 'unlocked' && state.status !== 'unlocked') {
    useNotesStore.getState().clear()
  }
})
