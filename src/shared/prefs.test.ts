import { describe, expect, it } from 'vitest'

import { ACCENTS } from './accent'
import {
  EDITOR_DELTA_MAX,
  EDITOR_DELTA_MIN,
  EDITOR_LINES,
  lineValue,
} from './editorPrefs'

describe('accent options', () => {
  it('offers five distinct accents with valid swatches', () => {
    expect(ACCENTS.map((accent) => accent.id)).toEqual([
      'blue',
      'violet',
      'teal',
      'amber',
      'rose',
    ])
    for (const accent of ACCENTS) {
      expect(accent.labelKey).toMatch(/^settings\.accent\./)
      expect(accent.swatch).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('editor reading prefs', () => {
  it('maps line spacing in ascending comfort', () => {
    expect(EDITOR_LINES.map((line) => line.id)).toEqual(['compact', 'normal', 'relaxed'])
    expect(lineValue('compact')).toBeLessThan(lineValue('normal'))
    expect(lineValue('normal')).toBeLessThan(lineValue('relaxed'))
  })

  it('falls back to normal spacing for unknown ids', () => {
    expect(lineValue('unknown' as never)).toBe(lineValue('normal'))
  })

  it('keeps the size delta range around zero', () => {
    expect(EDITOR_DELTA_MIN).toBeLessThan(0)
    expect(EDITOR_DELTA_MAX).toBeGreaterThan(0)
  })
})
