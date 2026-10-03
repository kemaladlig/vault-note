import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

import { WrongPassphraseError } from '../crypto'
import { useVaultStore } from '../store/vaultStore'

export function UnlockForm() {
  const unlock = useVaultStore((s) => s.unlock)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await unlock(passphrase)
    } catch (err) {
      setError(
        err instanceof WrongPassphraseError
          ? 'Parola hatalı.'
          : err instanceof Error
            ? err.message
            : 'Kilit açılamadı.',
      )
      setBusy(false)
      setPassphrase('')
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kilidi aç</CardTitle>
          <CardDescription>Notlarına erişmek için ana parolanı gir.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="passphrase">Ana parola</Label>
              <Input
                id="passphrase"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy || !passphrase}>
              {busy ? 'Doğrulanıyor…' : 'Kilidi aç'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
