import { useBoot } from '@/features/shell/useBoot'
import { AppShell } from '@/features/shell/ui/AppShell'
import { VaultGate } from '@/features/vault/ui/VaultGate'

export default function App() {
  useBoot()

  return (
    <VaultGate>
      <AppShell />
    </VaultGate>
  )
}
