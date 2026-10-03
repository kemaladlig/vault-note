import { useEffect } from 'react'

import { useVaultStore } from '@/features/vault/store/vaultStore'
import { dismissBootSplash } from '@/shared/boot'

/** Last-resort handover: the brand screen must never be the reason the app is unreachable. */
const BOOT_BUDGET_MS = 6000

/**
 * Hands the screen over from the inline boot splash (index.html) to the first real screen.
 * Waits for the vault lifecycle to leave `loading`, then lets that screen paint a frame before
 * the splash fades. An unlock/setup screen looks nothing like the app chrome, so it gets an
 * instant handover instead of a cross-fade.
 */
export function useBoot(): void {
  const status = useVaultStore((s) => s.status)

  useEffect(() => {
    if (status === 'loading') return
    // Two frames: the screen renders, then the splash starts fading out over it.
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => dismissBootSplash({ instant: status !== 'unlocked' })),
    )
    return () => cancelAnimationFrame(frame)
  }, [status])

  useEffect(() => {
    // If boot never resolves (storage blocked, boot read rejected), hand over to the in-app
    // brand screen instead of stranding the user on a screen that cannot be dismissed.
    if (status !== 'loading') return
    const guard = window.setTimeout(() => dismissBootSplash({ instant: true }), BOOT_BUDGET_MS)
    return () => window.clearTimeout(guard)
  }, [status])
}
