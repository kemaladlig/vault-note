import { useEffect } from 'react'

import { useNotesStore } from '@/features/notes/store/notesStore'

import { useShellStore } from './store/shellStore'

/** Global keyboard shortcuts: Ctrl/Cmd+K palette, Ctrl/Cmd+N new note, Ctrl/Cmd+B panel cycle. */
export function useShortcuts(): void {
  const setCommandOpen = useShellStore((s) => s.setCommandOpen)
  const setListOpen = useShellStore((s) => s.setListOpen)
  const cyclePanels = useShellStore((s) => s.cyclePanels)
  const create = useNotesStore((s) => s.create)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      } else if (key === 'n') {
        event.preventDefault()
        void create().then(() => setListOpen(false))
      } else if (key === 'b') {
        event.preventDefault()
        cyclePanels()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [create, setCommandOpen, setListOpen, cyclePanels])
}
