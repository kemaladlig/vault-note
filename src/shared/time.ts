import { t, useI18nStore, type Locale } from './i18n'

/** Epoch milliseconds. Centralised so a single clock source can be swapped in later. */
export function now(): number {
  return Date.now()
}

// One formatter per locale, created lazily so a language switch is picked up on the next call.
const RELATIVE = new Map<string, Intl.RelativeTimeFormat>()

function relativeFormatter(): Intl.RelativeTimeFormat {
  const locale = useI18nStore.getState().locale
  let formatter = RELATIVE.get(locale)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    RELATIVE.set(locale, formatter)
  }
  return formatter
}

const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

type ShortUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

/** "3 dk önce" / "3 min ago" style label. Falls back to seconds for very recent timestamps. */
export function relativeTime(ts: number, from = Date.now()): string {
  const diff = ts - from
  const formatter = relativeFormatter()
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit)
  }
  return formatter.format(Math.round(diff / 1000), 'second')
}

const SHORT_SUFFIX: Record<Locale, Record<ShortUnit, string>> = {
  tr: { second: 'sn', minute: 'dk', hour: 'sa', day: 'g', week: 'hf', month: 'ay', year: 'y' },
  en: { second: 's', minute: 'm', hour: 'h', day: 'd', week: 'w', month: 'mo', year: 'y' },
}

/** Compact "35sn" / "12m" label for tight rows — no önce/ago suffix. */
export function relativeTimeShort(ts: number, from = Date.now()): string {
  const abs = Math.abs(ts - from)
  if (abs < 10_000) return t('time.now')
  const suffix = SHORT_SUFFIX[useI18nStore.getState().locale]
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return `${Math.round(abs / ms)}${suffix[unit as ShortUnit]}`
  }
  return `${Math.round(abs / 1000)}${suffix.second}`
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
