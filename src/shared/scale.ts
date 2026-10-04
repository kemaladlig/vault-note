import { create } from 'zustand'

import type { MessageKey } from './i18n'

export type ScaleId = 'compact' | 'normal' | 'comfortable'

/** Presets map to the root font size; every size in the app is rem-based. */
export const SCALES: ReadonlyArray<{ id: ScaleId; labelKey: MessageKey; px: number }> = [
  { id: 'compact', labelKey: 'settings.scale.compact', px: 15 },
  { id: 'normal', labelKey: 'settings.scale.normal', px: 17 },
  { id: 'comfortable', labelKey: 'settings.scale.comfortable', px: 19 },
]

const STORAGE_KEY = 'vaultnote.scale'
const DEFAULT: ScaleId = 'normal'

function readStored(): ScaleId {
  const value = localStorage.getItem(STORAGE_KEY)
  return SCALES.some((scale) => scale.id === value) ? (value as ScaleId) : DEFAULT
}

export function applyScale(id: ScaleId): void {
  const scale = SCALES.find((item) => item.id === id) ?? SCALES[1]
  document.documentElement.style.fontSize = `${scale.px}px`
}

interface ScaleState {
  scale: ScaleId
  setScale: (scale: ScaleId) => void
}

export const useScaleStore = create<ScaleState>((set) => ({
  scale: readStored(),
  setScale: (scale) => {
    localStorage.setItem(STORAGE_KEY, scale)
    applyScale(scale)
    set({ scale })
  },
}))

/** Apply the stored UI scale on boot. */
export function initScale(): void {
  applyScale(useScaleStore.getState().scale)
}
