import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RestoreFromDrive } from '@/features/sync/ui/RestoreFromDrive'
import { useT } from '@/shared/i18n'

import { useVaultStore } from '../store/vaultStore'
import { VaultFrame } from './VaultFrame'

const MIN_LENGTH = 8

export function CreateVaultForm() {
  const t = useT()
  const createVault = useVaultStore((s) => s.create)
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(undefined)

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
      // remember defaults on: this device gets quick unlock, so later opens skip the passphrase.
      await createVault(passphrase, { remember: true })
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
          <CardDescription>{t('vault.create.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
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
            <p className="text-xs text-muted-foreground">{t('vault.create.rememberHint')}</p>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? t('vault.create.deriving') : t('vault.create.submit')}
            </Button>
          </form>
          <RestoreFromDrive />
        </CardContent>
      </Card>
    </VaultFrame>
  )
}
