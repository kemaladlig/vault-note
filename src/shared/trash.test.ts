import { describe, expect, it } from 'vitest'

import { isTrashExpired } from './trash'

const DAY = 24 * 60 * 60 * 1000

describe('isTrashExpired', () => {
  it('never expires when retention is disabled', () => {
    expect(isTrashExpired(0, 10 * DAY, 0)).toBe(false)
  })

  it('keeps a note still inside the window', () => {
    const now = 100 * DAY
    expect(isTrashExpired(now - 29 * DAY, now, 30)).toBe(false)
  })

  it('expires a note past the window', () => {
    const now = 100 * DAY
    expect(isTrashExpired(now - 31 * DAY, now, 30)).toBe(true)
  })

  it('expires exactly at the boundary', () => {
    const now = 100 * DAY
    expect(isTrashExpired(now - 30 * DAY, now, 30)).toBe(true)
  })
})
