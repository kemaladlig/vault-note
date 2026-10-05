import { useBoot } from '@/features/shell/useBoot'
import { AppShell } from '@/features/shell/ui/AppShell'
import { LegalPage } from '@/features/legal/LegalPage'
import { VaultGate } from '@/features/vault/ui/VaultGate'

export default function App() {
  // Public legal pages for the OAuth branding links; they open without a vault.
  const path = window.location.pathname
  if (path === '/privacy' || path.startsWith('/privacy/')) return <LegalPage kind="privacy" />
  if (path === '/terms' || path.startsWith('/terms/')) return <LegalPage kind="terms" />

  return <GatedApp />
}

function GatedApp() {
  useBoot()

  return (
    <VaultGate>
      <AppShell />
    </VaultGate>
  )
}
