import type { ReactNode } from 'react'

import { VaultNoteIcon } from '@/components/ui/vault-note-icon'

/** Brand stage for the pre-unlock screens (create / unlock). */
export function VaultFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-7 bg-shell-gradient p-6">
      <div className="flex flex-col items-center gap-3 animate-brand-in">
        <span className="relative grid size-16 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-3xl bg-primary/25 blur-2xl" />
          <VaultNoteIcon size={56} className="size-14 rounded-2xl shadow-e2" />
        </span>
        <span className="text-lg font-semibold tracking-tight">
          Vault<span className="text-primary">Note</span>
        </span>
      </div>
      <div className="w-full max-w-md animate-rise [animation-delay:90ms]">{children}</div>
    </div>
  )
}
