import { useSyncExternalStore } from 'react'

/**
 * Tracks the browser's PWA install affordance. Chromium fires `beforeinstallprompt` once the app
 * is installable; we stash it and replay it on demand. The listeners attach at module load so an
 * early event is never missed, and `useCanInstall` drives a button wherever it is shown.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferred: BeforeInstallPromptEvent | undefined
let installed = false
let snapshot = false
const listeners = new Set<() => void>()

function refresh() {
  snapshot = Boolean(deferred) && !installed
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Suppress the mini-infobar; the app decides when to ask.
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    refresh()
  })
  window.addEventListener('appinstalled', () => {
    deferred = undefined
    installed = true
    refresh()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): boolean {
  return snapshot
}

/** True when the browser has offered an install prompt we can still trigger. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/** Show the native install prompt. No-op when the browser has not offered one. */
export async function promptInstall(): Promise<void> {
  const event = deferred
  if (!event) return
  deferred = undefined
  refresh()
  await event.prompt()
  await event.userChoice
}
