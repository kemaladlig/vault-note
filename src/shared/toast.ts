import { create } from 'zustand'

import { exitMotionMs } from './exitMotion'

export type ToastTone = 'default' | 'success' | 'error'

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
  /** Set while the exit animation plays; the row unmounts when it ends. */
  leaving: boolean
}

interface ToastState {
  toasts: ToastItem[]
  show: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}

const TTL_MS = 3200

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, tone = 'default') => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, message, tone, leaving: false }] }))
    window.setTimeout(() => get().dismiss(id), TTL_MS)
  },
  dismiss: (id) => {
    if (!get().toasts.some((t) => t.id === id && !t.leaving)) return
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    }))
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, exitMotionMs())
  },
}))

/** Imperative toast helper usable outside React. */
export function toast(message: string, tone?: ToastTone): void {
  useToastStore.getState().show(message, tone)
}
