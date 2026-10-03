import { useEffect } from 'react'

import { useSyncStore } from './store/syncStore'

const INTERVAL_MS = 60_000

/**
 * Background sync while unlocked: once on mount, then every minute, and whenever the app
 * comes back online or regains focus. Never opens the OAuth popup (`interactive: false`),
 * so it is a no-op until the user has signed in once.
 */
export function useAutoSync(): void {
  const sync = useSyncStore((s) => s.sync)

  useEffect(() => {
    const run = () => void sync({ interactive: false })
    run()
    const id = window.setInterval(run, INTERVAL_MS)
    window.addEventListener('online', run)
    window.addEventListener('focus', run)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('online', run)
      window.removeEventListener('focus', run)
    }
  }, [sync])
}
