import { Check, CloudOff, Download, KeyRound, LayoutTemplate, Lock, Monitor, Moon, Pencil, ShieldCheck, Sun, Trash2, Upload } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/spinner'
import { downloadAllJson, downloadAllMarkdown } from '@/features/notes/export'
import { PromptDialog } from '@/features/notes/ui/PromptDialog'
import { useNotesStore } from '@/features/notes/store/notesStore'
import { useTemplateStore } from '@/features/notes/store/templateStore'
import type { NoteTemplate } from '@/features/notes/templates'
import { useSyncStore } from '@/features/sync/store/syncStore'
import {
  MIN_PASSPHRASE_LENGTH,
  WrongPassphraseError,
  isAcceptablePassphrase,
  passphraseStrength,
} from '@/features/vault/crypto'
import { passphraseHintKey } from '@/shared/i18n'
import { PinDialog, type PinDialogMode } from '@/features/vault/ui/PinDialog'
import { biometricAvailable, type AppLockMode } from '@/features/vault/store/appLock'
import { AUTO_LOCK_OPTIONS, getAutoLockMinutes, setAutoLockMinutes } from '@/features/vault/store/autoLock'
import { useVaultStore } from '@/features/vault/store/vaultStore'
import { useI18nStore, useT, LOCALES, type MessageKey } from '@/shared/i18n'
import { cn } from '@/lib/utils'
import { ACCENTS, useAccentStore } from '@/shared/accent'
import { relativeTime } from '@/shared/time'
import { SCALES, useScaleStore } from '@/shared/scale'
import {
  getRevisionLimit,
  REVISION_LIMIT_OPTIONS,
  setRevisionLimit,
} from '@/shared/revisions'
import { useThemeStore, type ThemeMode } from '@/shared/theme'
import {
  getTrashRetentionDays,
  setTrashRetentionDays,
  TRASH_RETENTION_OPTIONS,
} from '@/shared/trash'
import { toast } from '@/shared/toast'

import { useShellStore } from '../store/shellStore'

const THEMES: { value: ThemeMode; labelKey: MessageKey; icon: typeof Sun }[] = [
  { value: 'system', labelKey: 'settings.theme.system', icon: Monitor },
  { value: 'light', labelKey: 'settings.theme.light', icon: Sun },
  { value: 'dark', labelKey: 'settings.theme.dark', icon: Moon },
]

const TABS: ReadonlyArray<{
  id: 'appearance' | 'security' | 'sync' | 'data'
  labelKey: MessageKey
}> = [
  { id: 'appearance', labelKey: 'settings.appearance' },
  { id: 'security', labelKey: 'settings.security' },
  { id: 'sync', labelKey: 'settings.syncSection' },
  { id: 'data', labelKey: 'settings.data' },
]

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
  const t = useT()
  const locale = useI18nStore((s) => s.locale)
  const setLocale = useI18nStore((s) => s.setLocale)
  const open = useShellStore((s) => s.settingsOpen)
  const setOpen = useShellStore((s) => s.setSettingsOpen)

  const notes = useNotesStore((s) => s.notes)
  const purgeTrash = useNotesStore((s) => s.purgeTrash)
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const accent = useAccentStore((s) => s.accent)
  const setAccent = useAccentStore((s) => s.setAccent)
  const scale = useScaleStore((s) => s.scale)
  const setScale = useScaleStore((s) => s.setScale)

  const vaultMode = useVaultStore((s) => s.settings?.mode)
  const quickAvailable = useVaultStore((s) => s.quickUnlockAvailable)
  const pinSet = useVaultStore((s) => s.pinSet)
  const forgetDevice = useVaultStore((s) => s.forgetDevice)
  const enablePin = useVaultStore((s) => s.enablePin)
  const disablePin = useVaultStore((s) => s.disablePin)
  const changePin = useVaultStore((s) => s.changePin)
  const appLockMode = useVaultStore((s) => s.appLockMode)
  const setAppLockNone = useVaultStore((s) => s.setAppLockNone)
  const setAppLockBiometric = useVaultStore((s) => s.setAppLockBiometric)
  const enableQuickHere = useVaultStore((s) => s.enableQuickHere)
  const changePassphrase = useVaultStore((s) => s.changePassphrase)
  const resetPassphrase = useVaultStore((s) => s.resetPassphrase)
  const reset = useVaultStore((s) => s.reset)

  const configured = useSyncStore((s) => s.configured)
  const syncStatus = useSyncStore((s) => s.status)
  const syncError = useSyncStore((s) => s.error)
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt)
  const pending = useSyncStore((s) => s.pending)
  const lastPulled = useSyncStore((s) => s.lastPulled)
  const lastPushed = useSyncStore((s) => s.lastPushed)
  const lastConflicts = useSyncStore((s) => s.lastConflicts)
  const sync = useSyncStore((s) => s.sync)
  const disconnect = useSyncStore((s) => s.disconnect)

  const setImportOpen = useShellStore((s) => s.setImportOpen)
  const pruneRevisions = useNotesStore((s) => s.pruneRevisions)
  const templates = useTemplateStore((s) => s.templates)
  const renameTemplate = useTemplateStore((s) => s.rename)
  const removeTemplate = useTemplateStore((s) => s.remove)

  const [rekeyMode, setRekeyMode] = useState<'change' | 'reset' | null>(null)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [rekeyError, setRekeyError] = useState<string>()
  const [rekeyBusy, setRekeyBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [retention, setRetention] = useState(() => getTrashRetentionDays())
  const [revisionLimit, setRevisionLimitState] = useState(() => getRevisionLimit())
  const [renameTarget, setRenameTarget] = useState<NoteTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NoteTemplate | null>(null)
  const [pinMode, setPinMode] = useState<PinDialogMode | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('appearance')
  const hintKey = next ? passphraseHintKey(passphraseStrength(next)) : undefined
  /** Target mode to apply once the current PIN has been verified and removed. */
  const [pendingLock, setPendingLock] = useState<'none' | 'biometric' | null>(null)
  const [autoLock, setAutoLockState] = useState(() => getAutoLockMinutes())

  const isDevice = vaultMode === 'device'
  const syncing = syncStatus === 'syncing'

  function close() {
    setOpen(false)
    setTab('appearance')
    setRekeyMode(null)
    setCurrent('')
    setNext('')
    setConfirm('')
    setRekeyError(undefined)
    setConfirmReset(false)
    setPendingLock(null)
  }

  /** Apply a no-PIN open mode, enabling device quick unlock first if it was off. */
  async function applyLock(target: 'none' | 'biometric') {
    if (!quickAvailable) {
      try {
        await enableQuickHere()
      } catch (err) {
        toast(err instanceof Error ? err.message : t('settings.appLockFailed'), 'error')
        return
      }
    }
    if (target === 'biometric') setAppLockBiometric()
    else setAppLockNone()
  }

  async function chooseLock(target: AppLockMode) {
    if (target === appLockMode) return
    if (target === 'pin') {
      if (!pinSet) setPinMode('set')
      return
    }
    // Switching off the PIN needs the current PIN to unwrap the device key first.
    if (pinSet) {
      setPendingLock(target)
      setPinMode('remove')
      return
    }
    await applyLock(target)
  }

  async function onRetention(days: number) {
    setRetention(days)
    setTrashRetentionDays(days)
    const purged = await purgeTrash()
    if (purged > 0) toast(t('settings.purged', { count: purged }), 'success')
  }

  async function onRevisionLimit(limit: number) {
    setRevisionLimitState(limit)
    setRevisionLimit(limit)
    await pruneRevisions()
  }

  async function onRekey() {
    if (!isAcceptablePassphrase(next)) {
      setRekeyError(t('settings.passphraseShort', { n: MIN_PASSPHRASE_LENGTH }))
      return
    }
    if (next !== confirm) {
      setRekeyError(t('settings.passphraseMismatch'))
      return
    }
    setRekeyBusy(true)
    setRekeyError(undefined)
    try {
      // Reset via this device: DEK is already in RAM, so no current passphrase check.
      // Change: verifies the current passphrase first (throws on mismatch).
      if (rekeyMode === 'reset') await resetPassphrase(next)
      else await changePassphrase(current, next)
      toast(t('settings.passphraseUpdated'), 'success')
      setRekeyMode(null)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setRekeyError(
        err instanceof WrongPassphraseError
          ? t('settings.passphraseWrong')
          : err instanceof Error
            ? err.message
            : t('settings.passphraseFailed'),
      )
    } finally {
      setRekeyBusy(false)
    }
  }

  async function onPinSubmit({ current, next }: { current?: string; next?: string }) {
    if (pinMode === 'set' && next) {
      await enablePin(next)
      toast(t('settings.pinAdded'), 'success')
    } else if (pinMode === 'change' && current && next) {
      await changePin(current, next)
      toast(t('settings.pinChanged'), 'success')
    } else if (pinMode === 'remove' && current) {
      await disablePin(current)
      toast(t('settings.pinRemoved'), 'success')
      if (pendingLock) {
        await applyLock(pendingLock)
        setPendingLock(null)
      }
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('settings.title')}
      description={t('settings.description')}
      className="w-[min(94vw,34rem)]"
    >
      <div role="tablist" aria-label={t('settings.title')} className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 text-[13px]">
        {TABS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-lg px-2 py-1.5 transition-colors',
              tab === id ? 'bg-background shadow-e1' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      <div key={tab} role="tabpanel" className="max-h-[60vh] min-h-48 space-y-5 overflow-y-auto pr-1 animate-fade-in">
        {tab === 'appearance' && (
          <>
        <Section title={t('settings.appearance')}>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('settings.theme')}</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm">
              {THEMES.map(({ value, labelKey, icon: Icon }) => (
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
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('settings.accent')}</p>
            <div className="-m-2 flex items-center gap-1.5 p-2" role="group" aria-label={t('settings.accent')}>
              {ACCENTS.map(({ id, labelKey, swatch }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={accent === id}
                  aria-label={t(labelKey)}
                  title={t(labelKey)}
                  onClick={() => setAccent(id)}
                  className="grid size-9 place-items-center rounded-full transition-transform duration-[var(--duration-fast)] hover:scale-110 active:scale-95"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-5 rounded-full',
                      accent === id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    )}
                    style={{ backgroundColor: swatch }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('settings.fontSize')}</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm">
              {SCALES.map(({ id, labelKey }) => (
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
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('settings.language')}</p>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm">
              {LOCALES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={locale === id}
                  onClick={() => setLocale(id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 transition-colors',
                    locale === id
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
          </>
        )}
        {tab === 'security' && (
          <>
        <Section title={t('settings.security')}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <span>{t('settings.quickUnlock')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={quickAvailable ? 'success' : 'default'}>
                {quickAvailable ? t('settings.enabled') : t('settings.disabled')}
              </Badge>
              {quickAvailable && !isDevice && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    void forgetDevice()
                    toast(t('settings.forgotten'), 'success')
                  }}
                >
                  {t('settings.forget')}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="size-4 text-muted-foreground" />
              <span>{t('settings.appLock')}</span>
            </div>
            <div
              className={cn(
                'grid gap-1 rounded-xl bg-muted p-1 text-sm',
                biometricAvailable() ? 'grid-cols-3' : 'grid-cols-2',
              )}
            >
              {(['none', 'pin', 'biometric'] as const)
                .filter((value) => value !== 'biometric' || biometricAvailable())
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={appLockMode === value}
                    onClick={() => void chooseLock(value)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 transition-colors',
                      appLockMode === value
                        ? 'bg-background shadow-e1'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {value === 'none'
                      ? t('settings.lockNone')
                      : value === 'pin'
                        ? t('settings.lockPin')
                        : t('settings.lockBiometric')}
                  </button>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {appLockMode === 'none'
                ? t('settings.lockNoneNote')
                : appLockMode === 'biometric'
                  ? t('settings.lockBiometricNote')
                  : t('settings.appLockDesc')}
            </p>
            {/* Auto-lock only guards something when a gate exists; with "no lock" the app reopens
                silently, so the delay would have no effect. */}
            {appLockMode !== 'none' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('settings.autoLock')}</p>
                <div className="grid grid-cols-5 gap-1 rounded-xl bg-muted p-1 text-xs">
                  {AUTO_LOCK_OPTIONS.map(({ minutes, labelKey, params }) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={autoLock === minutes}
                      onClick={() => {
                        setAutoLockState(minutes)
                        setAutoLockMinutes(minutes)
                      }}
                      className={cn(
                        'rounded-lg px-2 py-1.5 transition-colors',
                        autoLock === minutes
                          ? 'bg-background shadow-e1'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t(labelKey, params)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {pinSet && (
              <Button size="xs" variant="ghost" onClick={() => setPinMode('change')}>
                {t('settings.pinChange')}
              </Button>
            )}
          </div>

          {isDevice ? (
            <p className="text-xs text-muted-foreground">{t('settings.deviceModeNote')}</p>
          ) : rekeyMode ? (
            <form
              className="space-y-3 rounded-xl border p-3"
              onSubmit={(event) => {
                event.preventDefault()
                void onRekey()
              }}
            >
              {rekeyMode === 'reset' ? (
                <p className="text-xs text-muted-foreground">{t('settings.resetPassphraseDesc')}</p>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="rekey-current">{t('settings.currentPassphrase')}</Label>
                  <Input
                    id="rekey-current"
                    type="password"
                    autoComplete="current-password"
                    value={current}
                    onChange={(event) => setCurrent(event.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="rekey-next">{t('settings.newPassphrase')}</Label>
                <Input
                  id="rekey-next"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rekey-confirm">{t('settings.confirmPassphrase')}</Label>
                <Input
                  id="rekey-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>
              {hintKey && (
                <p className="text-xs text-muted-foreground">{t(hintKey)}</p>
              )}
              {rekeyError && <p className="text-sm text-destructive">{rekeyError}</p>}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" type="button" onClick={() => setRekeyMode(null)}>
                  {t('common.cancel')}
                </Button>
                <Button size="sm" type="submit" disabled={rekeyBusy}>
                  {rekeyBusy ? <Spinner /> : <Check />}
                  {t('common.save')}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setRekeyMode('change')}>
                  <KeyRound />
                  {t('settings.changePassphrase')}
                </Button>
                {quickAvailable && (
                  <Button size="sm" variant="ghost" onClick={() => setRekeyMode('reset')}>
                    {t('settings.resetPassphrase')}
                  </Button>
                )}
              </div>
              {quickAvailable && (
                <p className="text-xs text-muted-foreground">{t('settings.resetPassphraseDesc')}</p>
              )}
            </div>
          )}
        </Section>
          </>
        )}
        {tab === 'sync' && (
          <>
        <Section title={t('settings.syncSection')}>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={!configured || syncing} onClick={() => void sync()}>
              {syncing ? <Spinner /> : <CloudOff />}
              {t('settings.syncNow')}
            </Button>
            <Button size="sm" variant="ghost" onClick={disconnect}>
              {t('settings.disconnect')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {!configured
              ? t('settings.syncNotConfigured')
              : lastSyncedAt
                ? t('settings.syncLast', { time: relativeTime(lastSyncedAt) })
                : t('settings.syncNever')}
          </p>
          {configured && pending > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('sync.pending', { n: pending })}
            </p>
          )}
          {configured && lastSyncedAt && pending === 0 && lastConflicts === 0 && syncStatus !== 'error' && (
            <p className="text-xs text-muted-foreground">
              {t('sync.upToDate')}
              {(lastPulled > 0 || lastPushed > 0) && ` ${t('sync.summary', { pulled: lastPulled, pushed: lastPushed })}`}
            </p>
          )}
          {lastConflicts > 0 && (
            <p className="text-xs text-destructive">
              {t('sync.conflict', { n: lastConflicts })}
            </p>
          )}
          {syncStatus === 'error' && (
            <p className="text-xs text-destructive" title={syncError}>
              {t('sync.failedTitle')} {t('sync.failedHint')}
            </p>
          )}
        </Section>
          </>
        )}
        {tab === 'data' && (
          <>
        <Section title={t('settings.data')}>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { downloadAllJson(notes); toast(t('settings.exportedJson'), 'success') }}>
              <Download />
              JSON
            </Button>
            <Button size="sm" variant="outline" onClick={() => { downloadAllMarkdown(notes); toast(t('settings.exportedMd'), 'success') }}>
              <Download />
              Markdown
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                close()
                setImportOpen(true)
              }}
            >
              <Upload />
              {t('settings.import')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.exportWarnA')}
            <strong>{t('settings.exportWarnStrong')}</strong>
            {t('settings.exportWarnB')}
          </p>
          <p className="text-xs text-muted-foreground">{t('settings.importHint')}</p>
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm text-muted-foreground">{t('settings.trashRetention')}</p>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 text-sm">
              {TRASH_RETENTION_OPTIONS.map(({ days, labelKey, params }) => (
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
                  {t(labelKey, params)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('settings.trashNote')}</p>
          </div>
        </Section>

        <Section title={t('settings.revisionsSection')}>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm">
            {REVISION_LIMIT_OPTIONS.map(({ limit, labelKey, params }) => (
              <button
                key={limit}
                type="button"
                aria-pressed={revisionLimit === limit}
                onClick={() => void onRevisionLimit(limit)}
                className={cn(
                  'rounded-lg px-3 py-1.5 transition-colors',
                  revisionLimit === limit
                    ? 'bg-background shadow-e1'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(labelKey, params)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.revisionsNote')}</p>
        </Section>

        <Section title={t('settings.templatesSection')}>
          <p className="text-xs text-muted-foreground">{t('templates.sectionNote')}</p>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('templates.empty')}</p>
          ) : (
            <ul className="space-y-1">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center gap-2 rounded-lg border border-border/70 px-2.5 py-1.5"
                >
                  <LayoutTemplate className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{template.name}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('templates.rename')}
                    title={t('templates.rename')}
                    onClick={() => setRenameTarget(template)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('templates.deleteTitle')}
                    title={t('templates.deleteTitle')}
                    onClick={() => setDeleteTarget(template)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('settings.danger')}>
          {confirmReset ? (
            <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm">{t('settings.resetConfirm')}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void reset()
                    close()
                  }}
                >
                  {t('settings.resetDo')}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setConfirmReset(true)}>
              {t('settings.reset')}
            </Button>
          )}
        </Section>
          </>
        )}
      </div>

      <PromptDialog
        open={Boolean(renameTarget)}
        title={t('templates.rename')}
        initialValue={renameTarget?.name ?? ''}
        placeholder={t('templates.namePlaceholder')}
        confirmLabel={t('common.save')}
        onConfirm={(name) => {
          if (renameTarget) {
            void renameTemplate(renameTarget.id, name).then(() =>
              toast(t('templates.renamed'), 'success'),
            )
          }
        }}
        onClose={() => setRenameTarget(null)}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t('templates.deleteTitle')}
        description={deleteTarget ? t('templates.deleteDesc', { name: deleteTarget.name }) : undefined}
        icon={<Trash2 />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  void removeTemplate(deleteTarget.id).then(() =>
                    toast(t('templates.deleted'), 'success'),
                  )
                }
                setDeleteTarget(null)
              }}
            >
              {t('common.delete')}
            </Button>
          </>
        }
      />

      <PinDialog
        open={pinMode !== null}
        mode={pinMode ?? 'set'}
        onClose={() => {
          setPinMode(null)
          setPendingLock(null)
        }}
        onSubmit={onPinSubmit}
      />
    </Modal>
  )
}
