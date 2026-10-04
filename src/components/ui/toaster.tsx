import { CheckCircle2, Info, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useToastStore, type ToastTone } from '@/shared/toast'

const ICONS: Record<ToastTone, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
}

/** Bottom-centered transient status messages. Mount once, near the app root. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col items-stretch gap-2">
      {toasts.map((item) => {
        const Icon = ICONS[item.tone]
        return (
          <button
            key={item.id}
            type="button"
            role="status"
            onClick={() => dismiss(item.id)}
            className={cn(
              'pointer-events-auto flex items-center gap-2.5 rounded-full border border-border/60 bg-popover/95 px-4 py-2.5 text-left text-sm shadow-e3 backdrop-blur-md',
              item.leaving ? 'animate-toast-out' : 'animate-toast-in',
              item.tone === 'error' && 'border-destructive/40 text-destructive',
              item.tone === 'success' && 'border-success/40',
            )}
          >
            <Icon
              className={cn(
                'size-4 shrink-0',
                item.tone === 'success' && 'text-success',
                item.tone === 'error' && 'text-destructive',
                item.tone === 'default' && 'text-primary',
              )}
            />
            <span className="flex-1">{item.message}</span>
          </button>
        )
      })}
    </div>
  )
}
