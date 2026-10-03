import { create } from 'zustand'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'vaultnote.theme'
const QUERY = '(prefers-color-scheme: dark)'

function readStored(): ThemeMode {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

function isDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && window.matchMedia(QUERY).matches)
}

export function applyTheme(mode: ThemeMode): void {
  const dark = isDark(mode)
  document.documentElement.classList.toggle('dark', dark)
  // Keep native controls/scrollbars in the right scheme as the theme changes.
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readStored(),
  setMode: (mode) => {
    localStorage.setItem(STORAGE_KEY, mode)
    applyTheme(mode)
    set({ mode })
  },
}))

/** Apply the stored theme and keep following the OS while in `system` mode. */
export function initTheme(): void {
  applyTheme(useThemeStore.getState().mode)
  window.matchMedia(QUERY).addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') applyTheme('system')
  })
}
