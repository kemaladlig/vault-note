import { CloudDownload, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useT } from '@/shared/i18n'
import { toast } from '@/shared/toast'

import { useSyncStore } from '../store/syncStore'

/** New-device entry point: pull an existing vault header from the user's Drive. */
export function RestoreFromDrive() {
  const t = useT()
  const configured = useSyncStore((s) => s.configured)
  const restore = useSyncStore((s) => s.restore)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()

  async function onClick() {
    setBusy(true)
    setNotice(undefined)
    const restored = await restore()
    setBusy(false)
    // Success flips VaultGate to the passphrase screen; say what happens next so the
    // second device feels like one continuous step instead of two disconnected screens.
    if (restored) toast(t('sync.restore.found'), 'success')
    else setNotice(t('sync.restore.notFound'))
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t('common.or')}
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="text-xs text-muted-foreground">{t('sync.restore.desc')}</p>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={!configured || busy}
        onClick={() => void onClick()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <CloudDownload />}
        {t('sync.restore.button')}
      </Button>
      {!configured && (
        <p className="text-xs text-muted-foreground">{t('settings.syncNotConfigured')}</p>
      )}
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
    </div>
  )
}
