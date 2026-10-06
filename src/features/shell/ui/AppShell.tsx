import { useEffect } from 'react'

import { useTemplateStore } from '@/features/notes/store/templateStore'
import { ImportDialog } from '@/features/notes/ui/ImportDialog'
import { TemplatePickerDialog } from '@/features/notes/ui/TemplatePickerDialog'
import { NotesShell } from '@/features/notes/ui/NotesShell'
import { useAutoSync } from '@/features/sync/useAutoSync'
import { useMediaQuery } from '@/shared/useMediaQuery'
import { useAutoLock } from '@/features/vault/store/useAutoLock'

import { useShortcuts } from '../useShortcuts'
import { CommandPalette } from './CommandPalette'
import { SettingsDialog } from './SettingsDialog'
import { TopBar } from './TopBar'

/** Application chrome: floating workspace card on a soft gradient shell. */
export function AppShell() {
  useAutoSync()
  useAutoLock()
  useShortcuts()

  // Below sm the app has no top bar: the note-list header is the chrome.
  const isWide = useMediaQuery('(min-width: 640px)')

  // Templates are device-local; load them once the (already unlocked) shell mounts.
  const loadTemplates = useTemplateStore((s) => s.load)
  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  return (
    // Full-bleed below sm (no floating card, status bar respected); the
    // gradient workspace card treatment belongs to wide viewports only.
    <div className="flex h-full flex-col bg-shell-gradient pt-[env(safe-area-inset-top)] sm:pt-0">
      {isWide && <TopBar />}
      <main className="min-h-0 flex-1 overflow-hidden sm:px-1.5 sm:pb-1.5 md:px-3 md:pb-3">
        <div className="relative h-full overflow-hidden bg-background sm:rounded-xl sm:border sm:border-border/80 sm:shadow-e2 md:rounded-2xl">
          <NotesShell />
        </div>
      </main>
      <CommandPalette />
      <TemplatePickerDialog />
      <ImportDialog />
      <SettingsDialog />
    </div>
  )
}
