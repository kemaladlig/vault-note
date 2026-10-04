import { ChevronDown, ChevronUp, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  return (
    <div className="flex items-center gap-1.5 border-b border-border/70 bg-sidebar/60 px-2 py-1.5 animate-slide-up">
      <Input
        autoFocus
        value={term}
        placeholder={t('notes.search.placeholder')}
        aria-label={t('notes.search.label')}
        className="h-8"
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
      <span className="min-w-16 text-right text-xs tabular-nums text-muted-foreground">
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
