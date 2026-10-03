import { create } from 'zustand'

import { useVaultStore } from '@/features/vault/store/vaultStore'
import { newId } from '@/shared/ids'

import type { SavedView } from '../views'
import { useNotesStore } from './notesStore'
import { loadViews, saveViews } from './viewRepo'

interface ViewState {
  /** Saved smart views (decrypted only while unlocked). */
  views: SavedView[]
  loaded: boolean
  load: () => Promise<void>
  /** Save the current notes filters under a name. */
  saveCurrent: (name: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Apply a saved view's filters to the notes store. */
  apply: (id: string) => void
  /** Drop decrypted views from memory (called when the vault locks). */
  clear: () => void
}

/** The Vault Key only lives in the vault store; this is the single place we read it. */
function requireDek() {
  const dek = useVaultStore.getState().dek
  if (!dek) throw new Error('Vault kilitli')
  return dek
}

export const useViewStore = create<ViewState>((set, get) => ({
  views: [],
  loaded: false,

  load: async () => {
    const views = await loadViews(requireDek())
    set({ views, loaded: true })
  },

  saveCurrent: async (name) => {
    const { query, tagFilter, folderId, view } = useNotesStore.getState()
    const item: SavedView = {
      id: newId(),
      name: name.trim() || 'Görünüm',
      query,
      tag: tagFilter,
      folderId,
      view,
      createdAt: Date.now(),
    }
    const views = [...get().views, item]
    await saveViews(requireDek(), views)
    set({ views })
  },

  rename: async (id, name) => {
    const views = get().views.map((item) =>
      item.id === id ? { ...item, name: name.trim() || item.name } : item,
    )
    await saveViews(requireDek(), views)
    set({ views })
  },

  remove: async (id) => {
    const views = get().views.filter((item) => item.id !== id)
    await saveViews(requireDek(), views)
    set({ views })
  },

  apply: (id) => {
    const saved = get().views.find((item) => item.id === id)
    if (!saved) return
    useNotesStore.getState().applyView({
      query: saved.query,
      tag: saved.tag,
      folderId: saved.folderId,
      view: saved.view,
    })
  },

  clear: () => set({ views: [], loaded: false }),
}))

// Security: decrypted views must not linger in memory once the vault is no longer unlocked.
useVaultStore.subscribe((state, previous) => {
  if (previous.status === 'unlocked' && state.status !== 'unlocked') {
    useViewStore.getState().clear()
  }
})
