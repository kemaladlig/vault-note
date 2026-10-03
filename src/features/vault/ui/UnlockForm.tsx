import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { WrongPassphraseError } from '../crypto'
import { useVaultStore } from '../store/vaultStore'
import { VaultFrame } from './VaultFrame'

export function UnlockForm() {
  const unlock = useVaultStore((s) => s.unlock)
  const unlockWithDevice = useVaultStore((s) => s.unlockWithDevice)
  const forgetDevice = useVaultStore((s) => s.forgetDevice)
  const reset = useVaultStore((s) => s.reset)
  const quickAvailable = useVaultStore((s) => s.quickUnlockAvailable)
  const mode = useVaultStore((s) => s.settings?.mode)

  const isDevice = mode === 'device'
  const [withPassphrase, setWithPassphrase] = useState(!quickAvailable)
  const [passphrase, setPassphrase] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function onQuickUnlock() {
    setBusy(true)
    setError(undefined)
    try {
      await unlockWithDevice()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hızlı açma başarısız.')
      setBusy(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await unlock(passphrase, { remember })
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

  // Device mode with the key still present: only quick unlock exists.
  const showQuick = quickAvailable && (isDevice || !withPassphrase)
  // Device mode with the key gone: nothing can recover it.
  const brokenDevice = isDevice && !quickAvailable

  return (
    <VaultFrame>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kilidi aç</CardTitle>
          <CardDescription>
            {brokenDevice
              ? 'Bu parolasız vault bu cihazda açılamıyor.'
              : showQuick
                ? 'Bu cihazda hızlı açma etkin.'
                : 'Notlarına erişmek için ana parolanı gir.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brokenDevice ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-muted-foreground">
                Cihaz anahtarı bulunamadı. Parolasız modda kurtarma yolu yoktur: vault'u
                sıfırlayıp yeniden başlaman gerekir. Drive'daki yedek de bu cihazda açılamaz.
              </div>
              <Button
                variant="destructive"
                className="w-full"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void reset()
                }}
              >
                Vault'u sıfırla
              </Button>
            </div>
          ) : showQuick ? (
            <div className="space-y-4">
              <Button className="w-full" disabled={busy} onClick={() => void onQuickUnlock()}>
                {busy ? 'Açılıyor…' : 'Hızlı aç'}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {!isDevice && (
                <div className="flex justify-center gap-4 text-xs">
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setWithPassphrase(true)}
                  >
                    Parolayla aç
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => void forgetDevice()}
                  >
                    Bu cihazı unut
                  </button>
                </div>
              )}
            </div>
          ) : (
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
              <div className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  aria-label="Bu cihazda hatırla"
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                  className="mt-0.5"
                />
                <span>Bu cihazda hatırla</span>
              </div>
              <Button type="submit" className="w-full" disabled={busy || !passphrase}>
                {busy ? 'Doğrulanıyor…' : 'Kilidi aç'}
              </Button>
              {quickAvailable && (
                <button
                  type="button"
                  className="mx-auto block text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setWithPassphrase(false)}
                >
                  Hızlı açmaya dön
                </button>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </VaultFrame>
  )
}
