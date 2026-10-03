import { NotesShell } from '@/features/notes/ui/NotesShell'
import { useAutoSync } from '@/features/sync/useAutoSync'

import { useShortcuts } from '../useShortcuts'
import { CommandPalette } from './CommandPalette'
import { SettingsDialog } from './SettingsDialog'
import { TopBar } from './TopBar'

/** Application chrome: floating workspace card on a soft gradient shell. */
export function AppShell() {
  useAutoSync()
  useShortcuts()

  return (
    <div className="flex h-full flex-col bg-shell-gradient">
      <TopBar />
      <main className="min-h-0 flex-1 overflow-hidden px-1.5 pb-1.5 md:px-3 md:pb-3">
        <div className="relative h-full overflow-hidden rounded-xl border border-border/80 bg-background shadow-e2 md:rounded-2xl">
          <NotesShell />
        </div>
      </main>
      <CommandPalette />
      <SettingsDialog />
    </div>
  )
}
