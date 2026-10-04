import { describe, expect, it } from 'vitest'

import { relativeTimeShort } from './time'

const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

describe('relativeTimeShort', () => {
  it('says now for very recent timestamps', () => {
    const from = 1_700_000_000_000
    expect(relativeTimeShort(from - 3_000, from)).toBe('şimdi')
  })

  it('uses compact Turkish suffixes without önce', () => {
    const from = 1_700_000_000_000
    expect(relativeTimeShort(from - 35_000, from)).toBe('35sn')
    expect(relativeTimeShort(from - 12 * MIN, from)).toBe('12dk')
    expect(relativeTimeShort(from - 3 * HOUR, from)).toBe('3sa')
    expect(relativeTimeShort(from - 2 * DAY, from)).toBe('2g')
  })
})
