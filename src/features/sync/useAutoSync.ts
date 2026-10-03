import { useEffect, useRef } from 'react'

import { useFolderStore } from '@/features/notes/store/folderStore'
import { useNotesStore } from '@/features/notes/store/notesStore'

import { useSyncStore } from './store/syncStore'

/** How often to poll for remote changes while unlocked (cheap: skips when the manifest is unchanged). */
const POLL_MS = 5_000
/** Wait this long after the last local edit before pushing, so typing settles first. */
const PUSH_DEBOUNCE_MS = 1_500

/**
 * Keeps the vault in step with Drive while unlocked, without the user pressing anything:
 * - pushes shortly after every local edit (new note, save, delete),
 * - pulls on a short interval and whenever the tab regains focus/visibility or network,
 * - never opens the OAuth popup (`interactive: false`), so it is a no-op until first sign-in.
 */
export function useAutoSync(): void {
  const sync = useSyncStore((s) => s.sync)
  const revision = useNotesStore((s) => s.revision)
  const foldersUpdatedAt = useFolderStore((s) => s.updatedAt)

  // Pull: on unlock, on an interval, and on focus/visibility/online.
  useEffect(() => {
    const run = () => void sync({ interactive: false })
    run()
    const id = window.setInterval(run, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    window.addEventListener('online', run)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('online', run)
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sync])

  // Push: after a local edit (note or notebook tree) settles, send it so other devices follow.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const id = window.setTimeout(() => void sync({ interactive: false }), PUSH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [revision, foldersUpdatedAt, sync])
}
