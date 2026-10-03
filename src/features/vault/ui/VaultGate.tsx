import { useEffect, type ReactNode } from 'react'

import { useVaultStore } from '../store/vaultStore'
import { CreateVaultForm } from './CreateVaultForm'
import { UnlockForm } from './UnlockForm'

function Splash({ message }: { message: string }) {
  return (
    <div className="flex min-h-full items-center justify-center p-8 text-muted-foreground">
      {message}
    </div>
  )
}

/** Routes the app by vault lifecycle: loading → setup → unlock → app. */
export function VaultGate({ children }: { children: ReactNode }) {
  const status = useVaultStore((s) => s.status)
  const init = useVaultStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (status === 'loading') return <Splash message="Yükleniyor…" />
  if (status === 'uninitialized') return <CreateVaultForm />
  if (status === 'locked') return <UnlockForm />
  return <>{children}</>
}
