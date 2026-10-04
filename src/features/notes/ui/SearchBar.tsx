import { useRef } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useT } from '@/shared/i18n'

interface SearchBarProps {
  term: string
  matchCount: number
  onTermChange: (term: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

/** In-note search controls. Matches are highlighted by CodeMirror; this drives navigation. */
export function SearchBar({
  term,
  matchCount,
  onTermChange,
  onNext,
  onPrevious,
  onClose,
}: SearchBarProps) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)

  function clearTerm() {
    onTermChange('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-1.5 border-b border-border/70 bg-sidebar/60 px-2 py-1.5 animate-slide-up">
      <div className="relative min-w-0 flex-1">
        <Input
          ref={inputRef}
          autoFocus
          value={term}
          placeholder={t('notes.search.placeholder')}
          aria-label={t('notes.search.label')}
          className={cn('h-8', term && 'pr-8')}
          onChange={(event) => onTermChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (event.shiftKey) onPrevious()
              else onNext()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
        />
        {term && (
          <button
            type="button"
            aria-label={t('notes.search.clear')}
            title={t('notes.search.clear')}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearTerm}
            className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <span className="min-w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {term ? t('notes.search.matches', { count: matchCount }) : ''}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t('notes.search.prev')}
        disabled={!term}
        onClick={onPrevious}
      >
        <ChevronUp />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={t('notes.search.next')}
        disabled={!term}
        onClick={onNext}
      >
        <ChevronDown />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label={t('notes.search.close')} onClick={onClose}>
        <X />
      </Button>
    </div>
  )
}
