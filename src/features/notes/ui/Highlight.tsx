import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { normalizeTr } from '../search'

/** Turkish-aware fuzzy-friendly highlight. Shared by the note list and the search palette. */
export function Highlight({
  text,
  query,
  className,
}: {
  text: string
  query: string
  className?: string
}) {
  const needle = normalizeTr(query.trim())
  if (!needle) return <>{text}</>
  const lower = normalizeTr(text)
  const parts: ReactNode[] = []
  let cursor = 0
  for (;;) {
    const index = lower.indexOf(needle, cursor)
    if (index === -1) {
      parts.push(text.slice(cursor))
      break
    }
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(
      <mark
        key={index}
        className={cn(
          'rounded-[calc(var(--radius)/4)] bg-[var(--search-highlight)] px-0.5 font-semibold text-[var(--search-highlight-ink)] ring-1 ring-[var(--search-highlight-ring)] [box-decoration-break:clone]',
          className,
        )}
      >
        {text.slice(index, index + needle.length)}
      </mark>,
    )
    cursor = index + needle.length
  }
  return <>{parts}</>
}
