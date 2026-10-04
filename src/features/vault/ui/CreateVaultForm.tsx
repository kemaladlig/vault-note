import { Capacitor } from '@capacitor/core'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RestoreFromDrive } from '@/features/sync/ui/RestoreFromDrive'
import { cn } from '@/lib/utils'
import { useT } from '@/shared/i18n'

import { biometricAvailable } from '../store/appLock'
import { useVaultStore } from '../store/vaultStore'
import { VaultFrame } from './VaultFrame'

const MIN_LENGTH = 8

type Mode = 'passphrase' | 'device'
type OpenMode = 'none' | 'biometric' | 'passphrase'

export function CreateVaultForm() {
  const t = useT()
  const createVault = useVaultStore((s) => s.create)
  const createDevice = useVaultStore((s) => s.createDevice)
  const setAppLockNone = useVaultStore((s) => s.setAppLockNone)
  const setAppLockBiometric = useVaultStore((s) => s.setAppLockBiometric)
  // Native ships device-first: the OS secure store already holds the key, so a passphrase on
  // first run is pure friction. The web has no such store (IndexedDB is exposed to same-origin
  // code), so there the passphrase stays the default.
  const isNative = Capacitor.isNativePlatform()
  const [mode, setMode] = useState<Mode>(isNative ? 'device' : 'passphrase')
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [openMode, setOpenMode] = useState<OpenMode>(
    isNative && biometricAvailable() ? 'biometric' : 'none',
  )
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  // "Passphrase every time" only makes sense when there is a passphrase to ask for.
  const openOptions: OpenMode[] = [
    'none',
    ...(biometricAvailable() ? (['biometric'] as const) : []),
    ...(mode === 'passphrase' ? (['passphrase'] as const) : []),
  ]

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
        // The open-mode choice was previously dropped in device mode; apply it like the
        // passphrase path does so biometric/none actually takes effect.
        if (openMode === 'biometric') setAppLockBiometric()
        else setAppLockNone()
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
      await createVault(passphrase, { remember: openMode !== 'passphrase' })
      if (openMode === 'biometric') setAppLockBiometric()
      else if (openMode === 'none') setAppLockNone()
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
              onClick={() => {
                setMode('device')
                if (openMode === 'passphrase') setOpenMode('none')
              }}
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

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('vault.create.openLabel')}</p>
              <div
                className="space-y-1"
                role="radiogroup"
                aria-label={t('vault.create.openLabel')}
              >
                {openOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={openMode === value}
                    onClick={() => setOpenMode(value)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      openMode === value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                        openMode === value ? 'border-primary' : 'border-muted-foreground/40',
                      )}
                    >
                      {openMode === value && <span className="size-2 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {value === 'none'
                          ? t('vault.create.openNone')
                          : value === 'biometric'
                            ? t('vault.create.openBiometric')
                            : t('vault.create.openPassphrase')}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {value === 'none'
                          ? t('vault.create.openNoneHint')
                          : value === 'biometric'
                            ? t('vault.create.openBiometricHint')
                            : t('vault.create.openPassphraseHint')}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

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
