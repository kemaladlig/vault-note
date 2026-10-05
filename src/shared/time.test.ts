import { describe, expect, it } from 'vitest'

import { relativeTime, relativeTimeShort, shortDate } from './time'

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

  it('floors elapsed time so a yesterday note never reads 2g', () => {
    const from = 1_700_000_000_000
    // 35h ago: the list groups it under "Dün", so the label must stay at 1g.
    expect(relativeTimeShort(from - 35 * HOUR, from)).toBe('1g')
    expect(relativeTime(from - 35 * HOUR, from)).toBe('dün')
  })
})

describe('shortDate', () => {
  it('adds the year only when the date left the current one', () => {
    const thisYear = new Date().getFullYear()
    const current = new Date(thisYear, 1, 12, 12).getTime()
    const lastYear = new Date(thisYear - 1, 1, 12, 12).getTime()
    expect(shortDate(current)).toMatch(/^\d{1,2} \p{L}+$/u)
    expect(shortDate(lastYear)).toContain(String(thisYear - 1))
  })
})
