import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RestoreFromDrive } from '@/features/sync/ui/RestoreFromDrive'
import { cn } from '@/lib/utils'

import { useVaultStore } from '../store/vaultStore'

const MIN_LENGTH = 8

type Mode = 'passphrase' | 'device'

export function CreateVaultForm() {
  const createVault = useVaultStore((s) => s.create)
  const createDevice = useVaultStore((s) => s.createDevice)
  const [mode, setMode] = useState<Mode>('passphrase')
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [remember, setRemember] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(undefined)

    if (mode === 'device') {
      if (!acknowledged) {
        setError('Devam etmek için uyarıyı onayla.')
        return
      }
      setBusy(true)
      try {
        await createDevice()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Vault oluşturulamadı.')
        setBusy(false)
      }
      return
    }

    if (passphrase.length < MIN_LENGTH) {
      setError(`Ana parola en az ${MIN_LENGTH} karakter olmalı.`)
      return
    }
    if (passphrase !== confirm) {
      setError('Parolalar eşleşmiyor.')
      return
    }
    setBusy(true)
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
            {mode === 'passphrase'
              ? 'Notların bu parolayla şifrelenir. Parolayı kaybedersen verilerine kimse erişemez — biz dahil. Kurtarma yolu yok.'
              : 'Bu cihazda parolasız çalışır. Kurtarma yolu yoktur ve başka cihazlarda açılamaz.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              aria-pressed={mode === 'passphrase'}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors',
                mode === 'passphrase' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
              onClick={() => setMode('passphrase')}
            >
              Parola ile
            </button>
            <button
              type="button"
              aria-pressed={mode === 'device'}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors',
                mode === 'device' ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
              onClick={() => setMode('device')}
            >
              Parolasız
            </button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {mode === 'passphrase' ? (
              <>
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
              </>
            ) : (
              <>
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">Kurtarma yok</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                    <li>Parola belirlemezsin; anahtar yalnızca bu cihazda tutulur.</li>
                    <li>Bu cihazı sıfırlar, tarayıcı verilerini silersen notlar gider.</li>
                    <li>Drive'a yedeklensen bile başka cihazda açılamaz.</li>
                  </ul>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    aria-label="Riski anladım"
                    checked={acknowledged}
                    onCheckedChange={(checked) => setAcknowledged(checked === true)}
                    className="mt-0.5"
                  />
                  <span>Riski anladım, parolasız kurulumu istiyorum.</span>
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? 'Anahtar türetiliyor…'
                : mode === 'device'
                  ? 'Parolasız oluştur'
                  : 'Vault oluştur'}
            </Button>
          </form>
          <RestoreFromDrive />
        </CardContent>
      </Card>
    </div>
  )
}
