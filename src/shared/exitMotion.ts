import { useEffect, useState } from 'react'

const msCache = new Map<string, number>()

/**
 * Resolve a CSS duration token (e.g. --duration-fast) to milliseconds, read once
 * from the stylesheet so JS unmount timing stays in lockstep with CSS.
 */
export function motionMs(varName: string): number {
  const cached = msCache.get(varName)
  if (cached !== undefined) return cached
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const value = Number.parseFloat(raw)
  const ms = Number.isFinite(value) ? (raw.endsWith('ms') ? value : value * 1000) : 160
  msCache.set(varName, ms)
  return ms
}

/** Duration of the exit animations; keeps portal unmounts aligned with pop-out/toast-out. */
export function exitMotionMs(): number {
  return motionMs('--duration-fast')
}

interface Phase {
  open: boolean
  mounted: boolean
  closing: boolean
}

function nextPhase(prev: Phase, open: boolean): Phase {
  if (open) return { open, mounted: true, closing: false }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || !prev.mounted) return { open, mounted: false, closing: false }
  return { open, mounted: true, closing: true }
}

/**
 * Keeps an element mounted through its exit animation.
 * `mounted` gates rendering; `closing` selects the exit (vs enter) animation class.
 */
export function useExitMotion(open: boolean): { mounted: boolean; closing: boolean } {
  // Prop changes are folded into the phase during render ("adjust state while
  // rendering"), so no extra commit is spent in the open→closing handoff.
  const [phase, setPhase] = useState<Phase>({ open, mounted: open, closing: false })
  let current = phase
  if (phase.open !== open) {
    current = nextPhase(phase, open)
    setPhase(current)
  }

  useEffect(() => {
    if (!phase.closing) return
    const timer = window.setTimeout(
      () => setPhase((latest) => (latest.closing ? { ...latest, mounted: false, closing: false } : latest)),
      exitMotionMs(),
    )
    return () => window.clearTimeout(timer)
  }, [phase.closing])

  return current
}
