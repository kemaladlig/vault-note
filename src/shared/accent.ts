import { create } from 'zustand'

import type { MessageKey } from './i18n'

export type AccentId = 'blue' | 'violet' | 'teal' | 'amber' | 'rose'

/** Accent options: label for Settings, swatch dot, nothing else. Tokens live in index.css. */
export const ACCENTS: ReadonlyArray<{ id: AccentId; labelKey: MessageKey; swatch: string }> = [
  { id: 'blue', labelKey: 'settings.accent.blue', swatch: '#0b57d0' },
  { id: 'violet', labelKey: 'settings.accent.violet', swatch: '#6d28d9' },
  { id: 'teal', labelKey: 'settings.accent.teal', swatch: '#0f766e' },
  { id: 'amber', labelKey: 'settings.accent.amber', swatch: '#b45309' },
  { id: 'rose', labelKey: 'settings.accent.rose', swatch: '#be123c' },
]

const STORAGE_KEY = 'vaultnote.accent'
const DEFAULT: AccentId = 'blue'

function readStored(): AccentId {
  if (typeof localStorage === 'undefined') return DEFAULT
  const value = localStorage.getItem(STORAGE_KEY)
  return ACCENTS.some((accent) => accent.id === value) ? (value as AccentId) : DEFAULT
}

/** Blue is the `:root` default — any other accent rides `data-accent` on `<html>`. */
export function applyAccent(id: AccentId): void {
  if (id === DEFAULT) document.documentElement.removeAttribute('data-accent')
  else document.documentElement.setAttribute('data-accent', id)
}

interface AccentState {
  accent: AccentId
  setAccent: (accent: AccentId) => void
}

export const useAccentStore = create<AccentState>((set) => ({
  accent: readStored(),
  setAccent: (accent) => {
    localStorage.setItem(STORAGE_KEY, accent)
    applyAccent(accent)
    set({ accent })
  },
}))

/** Apply the stored accent on boot (mirrored inline in index.html for a no-flash paint). */
export function initAccent(): void {
  applyAccent(useAccentStore.getState().accent)
}
