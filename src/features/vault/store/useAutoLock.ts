import { Capacitor } from '@capacitor/core'
import { useEffect, useRef } from 'react'

import { getAutoLockMinutes } from './autoLock'
import { useVaultStore } from './vaultStore'

/**
 * Locks the vault once it has been in the background longer than the configured delay.
 *
 * Only meaningful when a gate exists (`biometric`/`pin`): with "no lock" the app reopens
 * silently, so an auto-lock would just flash a pointless screen. Mounted once, while unlocked.
 */
export function useAutoLock(): void {
  const appLockMode = useVaultStore((s) => s.appLockMode)
  const lock = useVaultStore((s) => s.lock)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    if (appLockMode === 'none') return

    const onHide = () => {
      hiddenAt.current = Date.now()
    }
    const onShow = () => {
      const since = hiddenAt.current
      hiddenAt.current = null
      if (since === null) return
      const minutes = getAutoLockMinutes()
      if (minutes < 0) return
      if (Date.now() - since >= minutes * 60_000) lock()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
      else onShow()
    }

    document.addEventListener('visibilitychange', onVisibility)

    // Native webviews can stay "visible" while the app is backgrounded; the App plugin is the
    // reliable signal there. Both firing together is harmless because onShow clears the mark.
    let disposed = false
    let removeNative: (() => void) | undefined
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/app').then(({ App }) => {
        if (disposed) return
        const handle = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) onShow()
          else onHide()
        })
        removeNative = () => void handle.then((listener) => listener.remove())
      })
    }

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibility)
      removeNative?.()
    }
  }, [appLockMode, lock])
}
