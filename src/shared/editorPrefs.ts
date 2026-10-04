import { create } from 'zustand'

import type { MessageKey } from './i18n'

export type EditorLineId = 'compact' | 'normal' | 'relaxed'

export const EDITOR_LINES: ReadonlyArray<{
  id: EditorLineId
  labelKey: MessageKey
  value: number
}> = [
  { id: 'compact', labelKey: 'notes.editor.line.compact', value: 1.55 },
  { id: 'normal', labelKey: 'notes.editor.line.normal', value: 1.75 },
  { id: 'relaxed', labelKey: 'notes.editor.line.relaxed', value: 2 },
]

/** Editör metni kök boyutu takip eder (1rem); delta onun üstüne kişisel fark ekler. */
export const EDITOR_DELTA_MIN = -3
export const EDITOR_DELTA_MAX = 6

const DELTA_KEY = 'vaultnote.editorDelta'
const LINE_KEY = 'vaultnote.editorLine'

function readDelta(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = Number(localStorage.getItem(DELTA_KEY) ?? 0)
  if (!Number.isFinite(raw)) return 0
  return Math.min(EDITOR_DELTA_MAX, Math.max(EDITOR_DELTA_MIN, Math.round(raw)))
}

function readLine(): EditorLineId {
  if (typeof localStorage === 'undefined') return 'normal'
  const value = localStorage.getItem(LINE_KEY)
  return EDITOR_LINES.some((line) => line.id === value) ? (value as EditorLineId) : 'normal'
}

export function lineValue(id: EditorLineId): number {
  return EDITOR_LINES.find((line) => line.id === id)?.value ?? 1.75
}

function applyPrefs(delta: number, line: EditorLineId): void {
  document.documentElement.style.setProperty('--editor-delta', `${delta}px`)
  document.documentElement.style.setProperty('--editor-line-height', String(lineValue(line)))
}

interface EditorPrefsState {
  delta: number
  line: EditorLineId
  stepDelta: (step: 1 | -1) => void
  setLine: (line: EditorLineId) => void
}

export const useEditorPrefsStore = create<EditorPrefsState>((set) => ({
  delta: readDelta(),
  line: readLine(),
  stepDelta: (step) =>
    set((state) => {
      const delta = Math.min(
        EDITOR_DELTA_MAX,
        Math.max(EDITOR_DELTA_MIN, state.delta + step),
      )
      localStorage.setItem(DELTA_KEY, String(delta))
      applyPrefs(delta, state.line)
      return { delta }
    }),
  setLine: (line) =>
    set((state) => {
      localStorage.setItem(LINE_KEY, line)
      applyPrefs(state.delta, line)
      return { line }
    }),
}))

/** Apply the stored editor prefs on boot (mirrored inline in index.html for a no-flash paint). */
export function initEditorPrefs(): void {
  const { delta, line } = useEditorPrefsStore.getState()
  applyPrefs(delta, line)
}
