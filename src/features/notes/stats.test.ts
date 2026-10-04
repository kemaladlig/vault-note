import { describe, expect, it } from 'vitest'

import { countWords } from './stats'

describe('countWords', () => {
  it('counts zero for empty or whitespace-only text', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   \n\t  ')).toBe(0)
  })

  it('counts words across lines and extra spaces', () => {
    expect(countWords('merhaba  dünya')).toBe(2)
    expect(countWords('bir\niki\nüç')).toBe(3)
  })

  it('handles Turkish text', () => {
    expect(countWords('Çay içip işe gittik')).toBe(4)
  })
})
