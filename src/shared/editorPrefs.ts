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

export type EditorWidthId = 'reading' | 'wide'

export const EDITOR_WIDTHS: ReadonlyArray<{ id: EditorWidthId; labelKey: MessageKey }> = [
  { id: 'reading', labelKey: 'notes.editor.widthReading' },
  { id: 'wide', labelKey: 'notes.editor.widthWide' },
]

const DELTA_KEY = 'vaultnote.editorDelta'
const LINE_KEY = 'vaultnote.editorLine'
const WIDTH_KEY = 'vaultnote.editorWidth'

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

function readWidth(): EditorWidthId {
  if (typeof localStorage === 'undefined') return 'reading'
  const value = localStorage.getItem(WIDTH_KEY)
  return EDITOR_WIDTHS.some((width) => width.id === value) ? (value as EditorWidthId) : 'reading'
}

export function lineValue(id: EditorLineId): number {
  return EDITOR_LINES.find((line) => line.id === id)?.value ?? 1.75
}

function applyPrefs(delta: number, line: EditorLineId, width: EditorWidthId): void {
  document.documentElement.style.setProperty('--editor-delta', `${delta}px`)
  document.documentElement.style.setProperty('--editor-line-height', String(lineValue(line)))
  // Wide drops the reading cap: --editor-measure resolves to the full column so
  // both the CodeMirror gutter calc and the preview max-width expand to fill it.
  if (width === 'wide') {
    document.documentElement.style.setProperty('--editor-measure', '100%')
  } else {
    document.documentElement.style.removeProperty('--editor-measure')
  }
}

interface EditorPrefsState {
  delta: number
  line: EditorLineId
  width: EditorWidthId
  stepDelta: (step: 1 | -1) => void
  setLine: (line: EditorLineId) => void
  setWidth: (width: EditorWidthId) => void
}

export const useEditorPrefsStore = create<EditorPrefsState>((set) => ({
  delta: readDelta(),
  line: readLine(),
  width: readWidth(),
  stepDelta: (step) =>
    set((state) => {
      const delta = Math.min(
        EDITOR_DELTA_MAX,
        Math.max(EDITOR_DELTA_MIN, state.delta + step),
      )
      localStorage.setItem(DELTA_KEY, String(delta))
      applyPrefs(delta, state.line, state.width)
      return { delta }
    }),
  setLine: (line) =>
    set((state) => {
      localStorage.setItem(LINE_KEY, line)
      applyPrefs(state.delta, line, state.width)
      return { line }
    }),
  setWidth: (width) =>
    set((state) => {
      localStorage.setItem(WIDTH_KEY, width)
      applyPrefs(state.delta, state.line, width)
      return { width }
    }),
}))

/** Apply the stored editor prefs on boot (mirrored inline in index.html for a no-flash paint). */
export function initEditorPrefs(): void {
  const { delta, line, width } = useEditorPrefsStore.getState()
  applyPrefs(delta, line, width)
}
