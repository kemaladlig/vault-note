import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useT } from '@/shared/i18n'

import { WrongPassphraseError } from '../crypto'
import { useVaultStore } from '../store/vaultStore'
import { VaultFrame } from './VaultFrame'

export function UnlockForm() {
  const t = useT()
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
      setError(err instanceof Error ? err.message : t('vault.unlock.quickFailed'))
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
          ? t('vault.unlock.wrongPass')
          : err instanceof Error
            ? err.message
            : t('vault.unlock.failed'),
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
          <CardTitle>{t('vault.unlock.title')}</CardTitle>
          <CardDescription>
            {brokenDevice
              ? t('vault.unlock.brokenDesc')
              : showQuick
                ? t('vault.unlock.quickDesc')
                : t('vault.unlock.passDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {brokenDevice ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-muted-foreground">
                {t('vault.unlock.brokenNote')}
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
                {t('vault.unlock.reset')}
              </Button>
            </div>
          ) : showQuick ? (
            <div className="space-y-4">
              <Button className="w-full" disabled={busy} onClick={() => void onQuickUnlock()}>
                {busy ? t('vault.unlock.opening') : t('vault.unlock.quick')}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {!isDevice && (
                <div className="flex justify-center gap-4 text-xs">
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setWithPassphrase(true)}
                  >
                    {t('vault.unlock.withPassphrase')}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => void forgetDevice()}
                  >
                    {t('vault.unlock.forget')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="passphrase">{t('vault.create.passphrase')}</Label>
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
                  aria-label={t('vault.unlock.remember')}
                  checked={remember}
                  onCheckedChange={(checked) => setRemember(checked === true)}
                  className="mt-0.5"
                />
                <span>{t('vault.unlock.remember')}</span>
              </div>
              <Button type="submit" className="w-full" disabled={busy || !passphrase}>
                {busy ? t('vault.unlock.verifying') : t('vault.unlock.title')}
              </Button>
              {quickAvailable && (
                <button
                  type="button"
                  className="mx-auto block text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setWithPassphrase(false)}
                >
                  {t('vault.unlock.backToQuick')}
                </button>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </VaultFrame>
  )
}
