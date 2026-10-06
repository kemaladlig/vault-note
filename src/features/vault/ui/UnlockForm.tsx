import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useT } from '@/shared/i18n'

import { WrongPassphraseError } from '../crypto'
import { PinLockedError, isValidPin } from '../store/pinGate'
import { useVaultStore } from '../store/vaultStore'
import { VaultFrame } from './VaultFrame'

export function UnlockForm() {
  const t = useT()
  const unlock = useVaultStore((s) => s.unlock)
  const unlockWithDevice = useVaultStore((s) => s.unlockWithDevice)
  const unlockWithPin = useVaultStore((s) => s.unlockWithPin)
  const forgetDevice = useVaultStore((s) => s.forgetDevice)
  const reset = useVaultStore((s) => s.reset)
  const quickAvailable = useVaultStore((s) => s.quickUnlockAvailable)
  const pinSet = useVaultStore((s) => s.pinSet)
  const mode = useVaultStore((s) => s.settings?.mode)

  const isDevice = mode === 'device'
  const [withPassphrase, setWithPassphrase] = useState(!quickAvailable)
  const [passphrase, setPassphrase] = useState('')
  const [pin, setPin] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [confirmStartOver, setConfirmStartOver] = useState(false)

  const pinRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)

  // PIN is digits-only (4–8); password masking + numeric inputMode keeps it
  // masked while opening the numeric keyboard on mobile.
  function onPinInput(value: string) {
    setPin(value.replace(/\D/g, ''))
  }

  // Keyboard opened by the OS can cover a centered card; let the focused
  // field pull itself above it once the resize settles.
  function revealOnFocus(element: HTMLInputElement) {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        try {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' })
        } catch {
          /* older webviews — the viewport resize still moves the card up */
        }
      }, 250)
    })
  }

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

  async function onPinUnlock(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await unlockWithPin(pin)
    } catch (err) {
      if (err instanceof PinLockedError) {
        setError(t('vault.unlock.pinLocked', { s: Math.ceil(err.remainingMs / 1000) }))
      } else if (err instanceof WrongPassphraseError) {
        setError(t('vault.unlock.pinWrong'))
      } else {
        setError(err instanceof Error ? err.message : t('vault.unlock.failed'))
      }
      setPin('')
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

  // PIN gate takes priority: it is the current device's configured gate.
  const showPin = pinSet && !withPassphrase
  // Device mode with the key still present: only quick unlock exists.
  const showQuick = quickAvailable && !pinSet && (isDevice || !withPassphrase)
  // Device mode with neither the key nor a PIN: nothing can recover it.
  const brokenDevice = isDevice && !quickAvailable && !pinSet

  // autoFocus only fires reliably on first mount; the PIN / passphrase forms
  // swap without remounting the screen, so focus the visible field explicitly.
  // (Mobile browsers still need a user gesture for the keyboard itself —
  // the cursor lands in the field either way.)
  useEffect(() => {
    const target = showPin ? pinRef.current : showQuick || brokenDevice ? null : passRef.current
    if (!target) return
    const frame = requestAnimationFrame(() => target.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [showPin, showQuick, brokenDevice])

  return (
    <VaultFrame>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('vault.unlock.title')}</CardTitle>
          <CardDescription>
            {brokenDevice
              ? t('vault.unlock.brokenDesc')
              : showPin
                ? t('vault.unlock.pinDesc')
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
          ) : showPin ? (
            <form className="space-y-4" onSubmit={onPinUnlock}>
              <div className="space-y-2">
                <Label htmlFor="pin">{t('vault.unlock.pinLabel')}</Label>
                <Input
                  id="pin"
                  ref={pinRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  enterKeyHint="go"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => onPinInput(e.target.value)}
                  onFocus={(e) => revealOnFocus(e.currentTarget)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || !isValidPin(pin)}>
                {busy ? t('vault.unlock.opening') : t('vault.unlock.openPin')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('vault.unlock.forgotDesc')}</p>
              {!isDevice && (
                <button
                  type="button"
                  className="mx-auto block text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setWithPassphrase(true)
                    setError(undefined)
                  }}
                >
                  {t('vault.unlock.withPassphrase')}
                </button>
              )}
            </form>
          ) : showQuick ? (
            <div className="space-y-4">
              <Button className="w-full" disabled={busy} onClick={() => void onQuickUnlock()}>
                {busy ? t('vault.unlock.opening') : t('vault.unlock.quick')}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">{t('vault.unlock.forgotDesc')}</p>
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
                  ref={passRef}
                  type="password"
                  autoComplete="current-password"
                  enterKeyHint="go"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  onFocus={(e) => revealOnFocus(e.currentTarget)}
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
              {(quickAvailable || pinSet) ? (
                <div className="space-y-1 text-center">
                  <button
                    type="button"
                    className="mx-auto block text-xs text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => {
                      setWithPassphrase(false)
                      setError(undefined)
                    }}
                  >
                    {t('vault.unlock.forgot')}
                  </button>
                  <p className="text-xs text-muted-foreground">{t('vault.unlock.forgotDesc')}</p>
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  {t('vault.unlock.forgotNoDevice')}
                </p>
              )}
              {confirmStartOver ? (
                <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-xs text-muted-foreground">{t('vault.unlock.startOverDesc')}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="flex-1"
                      onClick={() => setConfirmStartOver(false)}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      type="button"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true)
                        void reset()
                      }}
                    >
                      {t('vault.unlock.startOver')}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="mx-auto block text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setConfirmStartOver(true)}
                >
                  {t('vault.unlock.startOver')}
                </button>
              )}
              {pinSet && (
                <button
                  type="button"
                  className="mx-auto block text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setWithPassphrase(false)
                    setError(undefined)
                  }}
                >
                  {t('vault.unlock.backToPin')}
                </button>
              )}
              {quickAvailable && !pinSet && (
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
