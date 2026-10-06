import { useEffect, useRef, useState, type Ref } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { Spinner } from '@/components/ui/spinner'
import { useT } from '@/shared/i18n'

import { WrongPassphraseError } from '../crypto'
import { PinLockedError, isValidPin } from '../store/pinGate'

export type PinDialogMode = 'set' | 'change' | 'remove'

interface PinDialogProps {
  open: boolean
  mode: PinDialogMode
  onClose: () => void
  onSubmit: (values: { current?: string; next?: string }) => Promise<void>
}

function PinField({
  id,
  label,
  value,
  onChange,
  inputRef,
  last,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** First visible field: receives focus when the dialog opens. */
  inputRef?: Ref<HTMLInputElement>
  /** Last field: Enter submits via the form. */
  last?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint={last ? 'done' : 'next'}
        autoComplete={id === 'pin-new' ? 'new-password' : 'off'}
        maxLength={8}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        onFocus={(event) => {
          requestAnimationFrame(() => {
            window.setTimeout(() => {
              try {
                event.currentTarget.scrollIntoView({ block: 'nearest' })
              } catch {
                /* older webviews — the dialog resize still keeps it visible */
              }
            }, 250)
          })
        }}
      />
    </div>
  )
}

/** Single dialog for set / change / remove of the device-local unlock PIN. */
export function PinDialog({ open, mode, onClose, onSubmit }: PinDialogProps) {
  const t = useT()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)

  // Reset fields when the dialog reopens (render-time sync, not an effect).
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setCurrent('')
      setNext('')
      setConfirm('')
      setError(undefined)
      setBusy(false)
    }
  }

  const needsCurrent = mode !== 'set'
  const needsNext = mode !== 'remove'
  const canSubmit = (!needsCurrent || isValidPin(current)) && (!needsNext || (isValidPin(next) && next === confirm))

  const firstFieldRef = useRef<HTMLInputElement>(null)

  // The dialog content swaps with `mode` while staying open; land focus on
  // the first visible field each time it (re)opens. Modal also focuses the
  // first input generically — this is the explicit backup for mode switches.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => firstFieldRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [open, mode])

  async function submit() {
    if (needsNext && !isValidPin(next)) {
      setError(t('pin.invalid'))
      return
    }
    if (needsNext && next !== confirm) {
      setError(t('pin.mismatch'))
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await onSubmit({ current: needsCurrent ? current : undefined, next: needsNext ? next : undefined })
      onClose()
    } catch (err) {
      if (err instanceof PinLockedError) setError(t('pin.locked', { s: Math.ceil(err.remainingMs / 1000) }))
      else if (err instanceof WrongPassphraseError) setError(t('pin.wrong'))
      else setError(err instanceof Error ? err.message : t('vault.unlock.failed'))
      setBusy(false)
    }
  }

  const title =
    mode === 'set' ? t('pin.set.title') : mode === 'change' ? t('pin.change.title') : t('pin.remove.title')
  const description =
    mode === 'set' ? t('pin.set.desc') : mode === 'change' ? t('pin.change.desc') : t('pin.remove.desc')
  const confirmLabel =
    mode === 'set' ? t('settings.pinAdd') : mode === 'change' ? t('settings.pinChange') : t('settings.pinRemove')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={mode === 'remove' ? 'destructive' : 'default'}
            disabled={busy || !canSubmit}
            onClick={() => void submit()}
          >
            {busy && <Spinner />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {needsCurrent && (
          <PinField
            id="pin-current"
            label={t('pin.current')}
            value={current}
            onChange={setCurrent}
            inputRef={firstFieldRef}
          />
        )}
        {needsNext && (
          <PinField
            id="pin-new"
            label={t('pin.new')}
            value={next}
            onChange={setNext}
            inputRef={needsCurrent ? undefined : firstFieldRef}
          />
        )}
        {needsNext && (
          <PinField
            id="pin-confirm"
            label={t('pin.confirm')}
            value={confirm}
            onChange={setConfirm}
            last
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </Modal>
  )
}
