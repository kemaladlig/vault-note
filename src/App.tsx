import { NotesShell } from '@/features/notes/ui/NotesShell'
import { VaultGate } from '@/features/vault/ui/VaultGate'

export default function App() {
  return (
    <VaultGate>
      <NotesShell />
    </VaultGate>
  )
}
