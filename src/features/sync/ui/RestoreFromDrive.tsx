import { CloudDownload, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

import { useSyncStore } from '../store/syncStore'

/** New-device entry point: pull an existing vault header from the user's Drive. */
export function RestoreFromDrive() {
  const configured = useSyncStore((s) => s.configured)
  const restore = useSyncStore((s) => s.restore)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()

  async function onClick() {
    setBusy(true)
    setNotice(undefined)
    const restored = await restore()
    setBusy(false)
    if (!restored) setNotice("Bu Drive hesabında bir VaultNote vault'u bulunamadı.")
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        veya
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={!configured || busy}
        onClick={() => void onClick()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <CloudDownload />}
        Drive'dan geri yükle
      </Button>
      {!configured && (
        <p className="text-xs text-muted-foreground">
          Google istemci kimliği ayarlı değil (bkz. .env.example).
        </p>
      )}
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
    </div>
  )
}
