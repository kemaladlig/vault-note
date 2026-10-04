import { FileText } from 'lucide-react'

import { Modal } from '@/components/ui/modal'
import { useShellStore } from '@/features/shell/store/shellStore'
import { useT } from '@/shared/i18n'

import { useNotesStore } from '../store/notesStore'
import { useTemplateStore } from '../store/templateStore'

/** Pick a template to create a note from. Opened from the command palette. */
export function TemplatePickerDialog() {
  const t = useT()
  const open = useShellStore((s) => s.templatePickerOpen)
  const setOpen = useShellStore((s) => s.setTemplatePickerOpen)
  const setListOpen = useShellStore((s) => s.setListOpen)
  const templates = useTemplateStore((s) => s.templates)
  const create = useNotesStore((s) => s.create)

  function applyTemplate(template: (typeof templates)[number]) {
    void create({
      title: template.title,
      body: template.body,
      tags: template.tags,
      folderId: template.folderId,
    })
    setListOpen(false)
    setOpen(false)
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={t('templates.newFromTemplate')}
      description={t('templates.pick')}
    >
      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('templates.pickerEmpty')}</p>
      ) : (
        <ul className="space-y-1">
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => applyTemplate(template)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{template.name}</span>
                {template.tags.length > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {template.tags.map((tag) => `#${tag}`).join(' ')}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
