import { useEffect, type ReactNode } from 'react'

import { Splash } from '@/features/shell/ui/Splash'

import { useVaultStore } from '../store/vaultStore'
import { CreateVaultForm } from './CreateVaultForm'
import { UnlockForm } from './UnlockForm'

/** Routes the app by vault lifecycle: loading → setup → unlock → app. */
export function VaultGate({ children }: { children: ReactNode }) {
  const status = useVaultStore((s) => s.status)
  const init = useVaultStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (status === 'loading') return <Splash />
  if (status === 'uninitialized') return <CreateVaultForm />
  if (status === 'locked') return <UnlockForm />
  return <>{children}</>
}
