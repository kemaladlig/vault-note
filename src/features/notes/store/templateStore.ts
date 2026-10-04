import { create } from 'zustand'

import { useVaultStore } from '@/features/vault/store/vaultStore'
import { newId } from '@/shared/ids'

import type { NoteTemplate } from '../templates'
import { loadTemplates, saveTemplates } from './templateRepo'

interface TemplateState {
  /** Decrypted templates (only while unlocked). Device-local, never synced. */
  templates: NoteTemplate[]
  loaded: boolean
  load: () => Promise<void>
  create: (input: {
    name: string
    title: string
    body: string
    tags: string[]
    folderId?: string
  }) => Promise<NoteTemplate>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Drop decrypted templates from memory (called when the vault locks). */
  clear: () => void
}

/** The Vault Key only lives in the vault store; this is the single place we read it. */
function requireDek() {
  const dek = useVaultStore.getState().dek
  if (!dek) throw new Error('Vault kilitli')
  return dek
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  loaded: false,

  load: async () => {
    const templates = await loadTemplates(requireDek())
    set({ templates, loaded: true })
  },

  create: async (input) => {
    const template: NoteTemplate = {
      id: newId(),
      name: input.name.trim() || 'Şablon',
      title: input.title,
      body: input.body,
      tags: input.tags,
      folderId: input.folderId,
      createdAt: Date.now(),
    }
    const templates = [...get().templates, template]
    await saveTemplates(requireDek(), templates)
    set({ templates })
    return template
  },

  rename: async (id, name) => {
    const templates = get().templates.map((item) =>
      item.id === id ? { ...item, name: name.trim() || item.name } : item,
    )
    await saveTemplates(requireDek(), templates)
    set({ templates })
  },

  remove: async (id) => {
    const templates = get().templates.filter((item) => item.id !== id)
    await saveTemplates(requireDek(), templates)
    set({ templates })
  },

  clear: () => set({ templates: [], loaded: false }),
}))

// Security: decrypted templates must not linger in memory once the vault is locked.
useVaultStore.subscribe((state, previous) => {
  if (previous.status === 'unlocked' && state.status !== 'unlocked') {
    useTemplateStore.getState().clear()
  }
})
