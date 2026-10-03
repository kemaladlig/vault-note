import { Check, CloudOff, Download, KeyRound, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/spinner'
import { downloadAllJson, downloadAllMarkdown } from '@/features/notes/export'
import { useNotesStore } from '@/features/notes/store/notesStore'
import { useSyncStore } from '@/features/sync/store/syncStore'
import { WrongPassphraseError } from '@/features/vault/crypto'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/shared/time'
import { SCALES, useScaleStore } from '@/shared/scale'
import { useThemeStore, type ThemeMode } from '@/shared/theme'
import {
  getTrashRetentionDays,
  setTrashRetentionDays,
  TRASH_RETENTION_OPTIONS,
} from '@/shared/trash'
import { toast } from '@/shared/toast'

import { useShellStore } from '../store/shellStore'

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Sistem', icon: Monitor },
  { value: 'light', label: 'Açık', icon: Sun },
  { value: 'dark', label: 'Koyu', icon: Moon },
]

const MIN_LENGTH = 8

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function SettingsDialog() {
  const open = useShellStore((s) => s.settingsOpen)
  const setOpen = useShellStore((s) => s.setSettingsOpen)

  const notes = useNotesStore((s) => s.notes)
  const purgeTrash = useNotesStore((s) => s.purgeTrash)
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const scale = useScaleStore((s) => s.scale)
  const setScale = useScaleStore((s) => s.setScale)

  const vaultMode = useVaultStore((s) => s.settings?.mode)
  const quickAvailable = useVaultStore((s) => s.quickUnlockAvailable)
  const forgetDevice = useVaultStore((s) => s.forgetDevice)
  const changePassphrase = useVaultStore((s) => s.changePassphrase)
  const reset = useVaultStore((s) => s.reset)

  const configured = useSyncStore((s) => s.configured)
  const syncStatus = useSyncStore((s) => s.status)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const sync = useSyncStore((s) => s.sync)
  const disconnect = useSyncStore((s) => s.disconnect)

  const [rekeying, setRekeying] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [rekeyError, setRekeyError] = useState<string>()
  const [rekeyBusy, setRekeyBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [retention, setRetention] = useState(() => getTrashRetentionDays())

  const isDevice = vaultMode === 'device'
  const syncing = syncStatus === 'syncing'

  function close() {
    setOpen(false)
    setRekeying(false)
    setCurrent('')
    setNext('')
    setConfirm('')
    setRekeyError(undefined)
    setConfirmReset(false)
  }

  async function onRetention(days: number) {
    setRetention(days)
    setTrashRetentionDays(days)
    const purged = await purgeTrash()
    if (purged > 0) toast(`${purged} not çöpten kalıcı olarak silindi.`, 'success')
  }

  async function onRekey() {
    if (next.length < MIN_LENGTH) {
      setRekeyError(`Yeni parola en az ${MIN_LENGTH} karakter olmalı.`)
      return
    }
    if (next !== confirm) {
      setRekeyError('Yeni parolalar eşleşmiyor.')
      return
    }
    setRekeyBusy(true)
    setRekeyError(undefined)
    try {
      await changePassphrase(current, next)
      toast('Parola güncellendi.', 'success')
      setRekeying(false)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setRekeyError(
        err instanceof WrongPassphraseError
          ? 'Mevcut parola hatalı.'
          : err instanceof Error
            ? err.message
            : 'Parola güncellenemedi.',
      )
    } finally {
      setRekeyBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Ayarlar"
      description="Görünüm, güvenlik ve veriler."
      className="w-[min(94vw,34rem)]"
    >
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        <Section title="Görünüm">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Tema</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm">
              {THEMES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors',
                    mode === value
                      ? 'bg-background shadow-e1'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Yazı boyutu</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm">
              {SCALES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={scale === id}
                  onClick={() => setScale(id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 transition-colors',
                    scale === id
                      ? 'bg-background shadow-e1'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Güvenlik">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <span>Bu cihazda hızlı açma</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={quickAvailable ? 'success' : 'default'}>
                {quickAvailable ? 'Etkin' : 'Kapalı'}
              </Badge>
              {quickAvailable && !isDevice && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    void forgetDevice()
                    toast('Bu cihaz unutuldu.', 'success')
                  }}
                >
                  Unut
                </Button>
              )}
            </div>
          </div>

          {isDevice ? (
            <p className="text-xs text-muted-foreground">
              Parolasız mod: kurtarma yoktur ve başka cihazda açılamaz.
            </p>
          ) : rekeying ? (
            <form
              className="space-y-3 rounded-xl border p-3"
              onSubmit={(event) => {
                event.preventDefault()
                void onRekey()
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="rekey-current">Mevcut parola</Label>
                <Input
                  id="rekey-current"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rekey-next">Yeni parola</Label>
                <Input
                  id="rekey-next"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rekey-confirm">Yeni parolayı doğrula</Label>
                <Input
                  id="rekey-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
              {rekeyError && <p className="text-sm text-destructive">{rekeyError}</p>}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" type="button" onClick={() => setRekeying(false)}>
                  İptal
                </Button>
                <Button size="sm" type="submit" disabled={rekeyBusy}>
                  {rekeyBusy ? <Spinner /> : <Check />}
                  Kaydet
                </Button>
              </div>
            </form>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setRekeying(true)}>
              <KeyRound />
              Parolayı değiştir
            </Button>
          )}
        </Section>

        <Section title="Senkronizasyon">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={!configured || syncing} onClick={() => void sync()}>
              {syncing ? <Spinner /> : <CloudOff />}
              Şimdi senkronize et
            </Button>
            <Button size="sm" variant="ghost" onClick={disconnect}>
              Bağlantıyı kes
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {!configured
              ? 'Google istemci kimliği ayarlı değil (bkz. .env.example).'
              : lastSyncedAt
                ? `Son senkron: ${relativeTime(lastSyncedAt)}`
                : 'Henüz senkronize edilmedi. Yalnızca şifreli veri Drive appDataFolder’a gider.'}
          </p>
        </Section>

        <Section title="Veri">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { downloadAllJson(notes); toast('JSON indirildi (şifresiz).', 'success') }}>
              <Download />
              JSON
            </Button>
            <Button size="sm" variant="outline" onClick={() => { downloadAllMarkdown(notes); toast('Markdown indirildi (şifresiz).', 'success') }}>
              <Download />
              Markdown
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Dışa aktarılan dosya <strong>şifresizdir</strong>; güvenli bir yerde saklayın.
          </p>
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm text-muted-foreground">Çöpü otomatik boşalt</p>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 text-sm">
              {TRASH_RETENTION_OPTIONS.map(({ days, label }) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={retention === days}
                  onClick={() => void onRetention(days)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 transition-colors',
                    retention === days
                      ? 'bg-background shadow-e1'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Çöpteki notlar bu süre sonunda uygulama açıldığında kalıcı silinir. “Asla” seçiliyse
              yalnızca elle boşaltılır.
            </p>
          </div>
        </Section>

        <Section title="Tehlikeli alan">
          {confirmReset ? (
            <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm">Tüm notlar ve vault bu cihazdan silinecek. Bu işlem geri alınamaz.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                  Vazgeç
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void reset()
                    close()
                  }}
                >
                  Kalıcı olarak sil
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setConfirmReset(true)}>
              Vault’u sıfırla
            </Button>
          )}
        </Section>
      </div>
    </Modal>
  )
}
