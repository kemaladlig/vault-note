import { ChevronDown, ChevronUp, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  return (
    <div className="flex items-center gap-1.5 border-b border-border/70 bg-sidebar/60 px-2 py-1.5 animate-slide-up">
      <Input
        autoFocus
        value={term}
        placeholder="Notta ara…"
        aria-label="Aramayı gir"
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
        {term ? `${matchCount} eşleşme` : ''}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Önceki eşleşme"
        disabled={!term}
        onClick={onPrevious}
      >
        <ChevronUp />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Sonraki eşleşme"
        disabled={!term}
        onClick={onNext}
      >
        <ChevronDown />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Aramayı kapat" onClick={onClose}>
        <X />
      </Button>
    </div>
  )
}
