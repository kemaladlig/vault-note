import { VaultNoteIcon } from '@/components/ui/vault-note-icon'
import { Spinner } from '@/components/ui/spinner'

/**
 * Brand screen shown while the vault lifecycle boots (`status === 'loading'`). The inline
 * splash in index.html covers the pre-bundle phase and is dismissed once React mounts, so this
 * only takes over for the (short) IndexedDB read — it keeps the top-bar height so the handover
 * into the real chrome does not jump.
 */
export function Splash() {
  return (
    <div className="flex h-full flex-col bg-shell-gradient">
      <div className="h-14 shrink-0" />
      <div
        role="status"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-8"
      >
        <span className="relative grid size-20 place-items-center animate-brand-in">
          <span aria-hidden className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
          <VaultNoteIcon size={72} className="size-16 rounded-2xl shadow-e2" />
        </span>
        <div className="flex animate-brand-in items-center gap-2 text-sm text-muted-foreground [animation-delay:90ms]">
          <Spinner />
          <span className="font-medium tracking-tight">
            Vault<span className="text-primary">Note</span>
          </span>
        </div>
      </div>
    </div>
  )
}
