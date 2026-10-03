import { create } from 'zustand'

import { newId } from '@/shared/ids'
import { folderSubtree, type Folder, type FolderColor } from '@/shared/folders'
import { now } from '@/shared/time'
import { useVaultStore } from '@/features/vault/store/vaultStore'

import * as repo from './folderRepo'
import { useNotesStore } from './notesStore'

interface FolderState {
  folders: Folder[]
  updatedAt: number
  modifiedTime?: string
  /** Local changes not yet pushed to Drive. */
  dirty: boolean
  loaded: boolean
  load: () => Promise<void>
  create: (name: string, parentId?: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  move: (id: string, parentId?: string) => Promise<void>
  setColor: (id: string, color?: FolderColor) => Promise<void>
  /** Delete a folder and its descendants; their notes move to the parent folder. */
  remove: (id: string) => Promise<void>
  /** Adopt a newer tree pulled from Drive. */
  adopt: (folders: Folder[], updatedAt: number, modifiedTime?: string) => Promise<void>
  /** Record that the local tree is now in sync with Drive. */
  markSynced: (updatedAt: number, modifiedTime?: string) => Promise<void>
  clear: () => void
}

async function persist(
  folders: Folder[],
  updatedAt: number,
  modifiedTime: string | undefined,
  dirty: boolean,
  set: (partial: Partial<FolderState>) => void,
): Promise<void> {
  set({ folders, updatedAt, modifiedTime, dirty })
  const dek = useVaultStore.getState().dek
  if (dek) await repo.saveFolders(dek, folders, updatedAt, modifiedTime)
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],
  updatedAt: 0,
  modifiedTime: undefined,
  dirty: false,
  loaded: false,

  load: async () => {
    const dek = useVaultStore.getState().dek
    if (!dek) return
    const state = await repo.loadFolders(dek)
    set({ ...state, dirty: false, loaded: true })
  },

  create: async (name, parentId) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const ts = now()
    const folder: Folder = {
      id: newId(),
      name: trimmed,
      parentId,
      order: get().folders.filter((item) => item.parentId === parentId).length,
      createdAt: ts,
      updatedAt: ts,
    }
    await persist([...get().folders, folder], now(), get().modifiedTime, true, set)
  },

  rename: async (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const folders = get().folders.map((folder) =>
      folder.id === id ? { ...folder, name: trimmed, updatedAt: now() } : folder,
    )
    await persist(folders, now(), get().modifiedTime, true, set)
  },

  move: async (id, parentId) => {
    if (id === parentId) return
    // Refuse to move a folder into its own subtree.
    if (parentId && folderSubtree(get().folders, id).has(parentId)) return
    const folders = get().folders.map((folder) =>
      folder.id === id ? { ...folder, parentId, updatedAt: now() } : folder,
    )
    await persist(folders, now(), get().modifiedTime, true, set)
  },

  setColor: async (id, color) => {
    const folders = get().folders.map((folder) =>
      folder.id === id ? { ...folder, color, updatedAt: now() } : folder,
    )
    await persist(folders, now(), get().modifiedTime, true, set)
  },

  remove: async (id) => {
    const target = get().folders.find((folder) => folder.id === id)
    if (!target) return
    const ids = folderSubtree(get().folders, id)
    const folders = get().folders.filter((folder) => !ids.has(folder.id))
    // Notes in the removed subtree fall back to the deleted folder's parent.
    await useNotesStore.getState().reassignFolder([...ids], target.parentId)
    await persist(folders, now(), get().modifiedTime, true, set)
  },

  adopt: async (folders, updatedAt, modifiedTime) => {
    set({ folders, updatedAt, modifiedTime, dirty: false, loaded: true })
    const dek = useVaultStore.getState().dek
    if (dek) await repo.saveFolders(dek, folders, updatedAt, modifiedTime)
  },

  markSynced: async (updatedAt, modifiedTime) => {
    set({ updatedAt, modifiedTime, dirty: false })
    const dek = useVaultStore.getState().dek
    if (dek) await repo.saveFolders(dek, get().folders, updatedAt, modifiedTime)
  },

  clear: () =>
    set({ folders: [], updatedAt: 0, modifiedTime: undefined, dirty: false, loaded: false }),
}))

// Folder names are useful only while unlocked; drop them with the other decrypted state.
useVaultStore.subscribe((state, previous) => {
  if (previous.status === 'unlocked' && state.status !== 'unlocked') {
    useFolderStore.getState().clear()
  }
})
