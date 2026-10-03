import { create } from 'zustand'

import { useVaultStore } from '@/features/vault/store/vaultStore'

import { EMPTY_NOTE, type DecryptedNote, type NoteContent } from '../model'
import * as repo from './noteRepo'

interface NotesState {
  notes: DecryptedNote[]
  selectedId?: string
  loading: boolean
  load: () => Promise<void>
  select: (id?: string) => void
  create: () => Promise<void>
  update: (id: string, content: NoteContent) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Drop decrypted notes from memory (called when the vault locks). */
  clear: () => void
}

/** The Vault Key only lives in the vault store; this is the single place we read it. */
function requireDek() {
  const dek = useVaultStore.getState().dek
  if (!dek) throw new Error('Vault kilitli')
  return dek
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const notes = await repo.listNotes(requireDek())
    set((state) => ({
      notes,
      loading: false,
      selectedId: state.selectedId ?? notes[0]?.id,
    }))
  },

  select: (id) => set({ selectedId: id }),

  create: async () => {
    const note = await repo.createNote(requireDek(), EMPTY_NOTE)
    set((state) => ({ notes: [note, ...state.notes], selectedId: note.id }))
  },

  update: async (id, content) => {
    const note = get().notes.find((n) => n.id === id)
    if (!note) return
    const saved = await repo.updateNote(requireDek(), note, content)
    // Keep list order stable while typing; only touch the edited row.
    set((state) => ({ notes: state.notes.map((n) => (n.id === id ? saved : n)) }))
  },

  remove: async (id) => {
    await repo.deleteNote(id)
    set((state) => {
      const notes = state.notes.filter((n) => n.id !== id)
      return {
        notes,
        selectedId: state.selectedId === id ? notes[0]?.id : state.selectedId,
      }
    })
  },

  clear: () => set({ notes: [], selectedId: undefined, loading: false }),
}))

// Security: decrypted notes must not linger in memory once the vault is no longer unlocked.
useVaultStore.subscribe((state, previous) => {
  if (previous.status === 'unlocked' && state.status !== 'unlocked') {
    useNotesStore.getState().clear()
  }
})
