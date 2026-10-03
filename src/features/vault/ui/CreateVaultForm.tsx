import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RestoreFromDrive } from '@/features/sync/ui/RestoreFromDrive'

import { useVaultStore } from '../store/vaultStore'

const MIN_LENGTH = 8

export function CreateVaultForm() {
  const createVault = useVaultStore((s) => s.create)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (passphrase.length < MIN_LENGTH) {
      setError(`Ana parola en az ${MIN_LENGTH} karakter olmalı.`)
      return
    }
    if (passphrase !== confirm) {
      setError('Parolalar eşleşmiyor.')
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await createVault(passphrase, { remember })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vault oluşturulamadı.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Vault oluştur</CardTitle>
          <CardDescription>
            Notların bu parolayla şifrelenir. Parolayı kaybedersen verilerine kimse erişemez —
            biz dahil. Kurtarma yolu yok.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="passphrase">Ana parola</Label>
              <Input
                id="passphrase"
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Parolayı doğrula</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex items-start gap-2.5 text-sm">
              <Checkbox
                aria-label="Bu cihazda hatırla"
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
                className="mt-0.5"
              />
              <span>
                Bu cihazda hatırla
                <span className="block text-xs text-muted-foreground">
                  Bu cihazda parolasız hızlı açma. Başka cihazları etkilemez.
                </span>
              </span>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Anahtar türetiliyor…' : 'Vault oluştur'}
            </Button>
          </form>
          <RestoreFromDrive />
        </CardContent>
      </Card>
    </div>
  )
}
