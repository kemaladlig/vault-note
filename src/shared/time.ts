/** Epoch milliseconds. Centralised so a single clock source can be swapped in later. */
export function now(): number {
  return Date.now()
}

const RELATIVE = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' })

const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

/** "3 dk önce" style label. Falls back to seconds for very recent timestamps. */
export function relativeTime(ts: number, from = Date.now()): string {
  const diff = ts - from
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return RELATIVE.format(Math.round(diff / ms), unit)
  }
  return RELATIVE.format(Math.round(diff / 1000), 'second')
}

export type DateBucket = 'today' | 'yesterday' | 'week' | 'older'

const DAY_MS = 86_400_000

/** Local midnight for a timestamp — calendar-day boundary, DST-safe. */
function startOfDay(ts: number): number {
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Which section a note belongs to in the list (Bugün / Dün / Bu hafta / Daha eski). */
export function bucketOf(ts: number, from = Date.now()): DateBucket {
  const days = Math.round((startOfDay(from) - startOfDay(ts)) / DAY_MS)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days <= 6) return 'week'
  return 'older'
}
