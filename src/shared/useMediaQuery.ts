import { useSyncExternalStore } from 'react'

/**
 * Reactive CSS media query. Lets layout branches render only the surface that
 * is actually visible, instead of duplicating markup and hiding one with CSS.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
