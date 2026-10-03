import { create } from 'zustand'

export type ToastTone = 'default' | 'success' | 'error'

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastState {
  toasts: ToastItem[]
  show: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}

const TTL_MS = 3200

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, tone = 'default') => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, TTL_MS)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/** Imperative toast helper usable outside React. */
export function toast(message: string, tone?: ToastTone): void {
  useToastStore.getState().show(message, tone)
}
