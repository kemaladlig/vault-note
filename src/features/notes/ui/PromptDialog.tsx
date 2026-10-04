import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { useT } from '@/shared/i18n'

interface PromptDialogProps {
  open: boolean
  title: string
  description?: string
  initialValue?: string
  placeholder?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onClose: () => void
}

/** Small single-field dialog for naming notebooks (create/rename). */
export function PromptDialog({
  open,
  title,
  description,
  initialValue = '',
  placeholder,
  confirmLabel,
  onConfirm,
  onClose,
}: PromptDialogProps) {
  const t = useT()
  const [value, setValue] = useState(initialValue)
  const [wasOpen, setWasOpen] = useState(open)

  // Reset the field when the dialog reopens (render-time sync, not an effect).
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setValue(initialValue)
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
    onClose()
  }

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
          <Button disabled={!value.trim()} onClick={submit}>
            {confirmLabel ?? t('common.save')}
          </Button>
        </>
      }
    >
      <Input
        value={value}
        placeholder={placeholder}
        aria-label={title}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
        }}
      />
    </Modal>
  )
}
