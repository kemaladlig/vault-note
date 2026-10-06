import type { ReactNode } from 'react'

import { VaultNoteIcon } from '@/components/ui/vault-note-icon'
import { useT } from '@/shared/i18n'

/**
 * Brand stage for the pre-unlock screens (create / unlock). The footer carries a
 * public app description plus policy links, so the home page is informative without
 * logging in (OAuth branding review requires this).
 */
export function VaultFrame({ children }: { children: ReactNode }) {
  const t = useT()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-7 overflow-y-auto bg-shell-gradient p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
      <p className="max-w-md text-center text-xs text-muted-foreground">
        {t('vault.create.publicTagline')}{' '}
        <a className="underline-offset-4 hover:underline" href="/privacy">
          {t('settings.privacy')}
        </a>
        {' · '}
        <a className="underline-offset-4 hover:underline" href="/terms">
          {t('settings.terms')}
        </a>
      </p>
    </div>
  )
}
