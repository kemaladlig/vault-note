import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RestoreFromDrive } from '@/features/sync/ui/RestoreFromDrive'
import { cn } from '@/lib/utils'
import { useT } from '@/shared/i18n'

import { useVaultStore } from '../store/vaultStore'
import { VaultFrame } from './VaultFrame'

const MIN_LENGTH = 8

type Mode = 'passphrase' | 'device'

export function CreateVaultForm() {
  const t = useT()
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
        setError(t('vault.create.ackRequired'))
        return
      }
      setBusy(true)
      try {
        await createDevice()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('vault.create.failed'))
        setBusy(false)
      }
      return
    }

    if (passphrase.length < MIN_LENGTH) {
      setError(t('vault.create.passShort', { n: MIN_LENGTH }))
      return
    }
    if (passphrase !== confirm) {
      setError(t('vault.create.passMismatch'))
      return
    }
    setBusy(true)
    try {
      await createVault(passphrase, { remember })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('vault.create.failed'))
      setBusy(false)
    }
  }

  return (
    <VaultFrame>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('vault.create.title')}</CardTitle>
          <CardDescription>
            {mode === 'passphrase' ? t('vault.create.descPass') : t('vault.create.descDevice')}
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
              {t('vault.create.withPassphrase')}
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
              {t('vault.create.passwordless')}
            </button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {mode === 'passphrase' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="passphrase">{t('vault.create.passphrase')}</Label>
                  <Input
                    id="passphrase"
                    type="password"
                    autoComplete="new-password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">{t('vault.create.confirm')}</Label>
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
                    aria-label={t('vault.create.remember')}
                    checked={remember}
                    onCheckedChange={(checked) => setRemember(checked === true)}
                    className="mt-0.5"
                  />
                  <span>
                    {t('vault.create.remember')}
                    <span className="block text-xs text-muted-foreground">
                      {t('vault.create.rememberHint')}
                    </span>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">{t('vault.create.noRecovery')}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                    <li>{t('vault.create.noRecovery1')}</li>
                    <li>{t('vault.create.noRecovery2')}</li>
                    <li>{t('vault.create.noRecovery3')}</li>
                  </ul>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    aria-label={t('vault.create.acknowledge')}
                    checked={acknowledged}
                    onCheckedChange={(checked) => setAcknowledged(checked === true)}
                    className="mt-0.5"
                  />
                  <span>{t('vault.create.acknowledgeLabel')}</span>
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? t('vault.create.deriving')
                : mode === 'device'
                  ? t('vault.create.deviceSubmit')
                  : t('vault.create.submit')}
            </Button>
          </form>
          <RestoreFromDrive />
        </CardContent>
      </Card>
    </VaultFrame>
  )
}
