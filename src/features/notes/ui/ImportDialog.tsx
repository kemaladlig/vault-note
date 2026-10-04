import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useShellStore } from '@/features/shell/store/shellStore'
import { useT } from '@/shared/i18n'
import { toast } from '@/shared/toast'

import { parseImportFile, planImport, type ImportCandidate, type ImportPlan } from '../import'
import { useFolderStore } from '../store/folderStore'
import { useNotesStore } from '../store/notesStore'

/**
 * Import flow: choose files → parse → dry-run summary → confirm. Nothing is persisted until
 * the user confirms; duplicates (by content hash) are skipped and counted.
 */
export function ImportDialog() {
  const t = useT()
  const open = useShellStore((s) => s.importOpen)
  const setOpen = useShellStore((s) => s.setImportOpen)
  const notes = useNotesStore((s) => s.notes)
  const importNotes = useNotesStore((s) => s.importNotes)
  const folders = useFolderStore((s) => s.folders)

  const inputRef = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [folderId, setFolderId] = useState('')
  const [hadError, setHadError] = useState(false)
  const [busy, setBusy] = useState(false)

  function reset() {
    setPlan(null)
    setFolderId('')
    setHadError(false)
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function close() {
    reset()
    setOpen(false)
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const parsed: ImportCandidate[] = []
    let error = false
    for (const file of Array.from(files)) {
      try {
        parsed.push(...parseImportFile(file.name, await file.text()))
      } catch {
        error = true
      }
    }
    setHadError(error)
    setPlan(planImport(notes, parsed))
    setFolderId('')
  }

  async function confirm() {
    if (!plan || plan.fresh.length === 0) return
    setBusy(true)
    const contents = plan.fresh.map((candidate) => ({
      title: candidate.title,
      body: candidate.body,
      tags: candidate.tags,
      folderId: folderId || candidate.folderId,
      pinned: candidate.pinned,
      archived: candidate.archived,
    }))
    const count = await importNotes(contents)
    setBusy(false)
    toast(t('import.done', { count }), 'success')
    close()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('import.title')}
      description={t('import.description')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          {plan && plan.fresh.length > 0 && (
            <Button disabled={busy} onClick={() => void confirm()}>
              {t('import.confirm', { fresh: plan.fresh.length })}
            </Button>
          )}
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".md,.markdown,.mdown,.txt,.json,text/markdown,application/json"
        className="hidden"
        onChange={(event) => void onFiles(event.target.files)}
      />
      <div className="space-y-3">
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload />
          {t('import.choose')}
        </Button>

        {hadError && <p className="text-sm text-destructive">{t('import.errorJson')}</p>}

        {plan && (
          <div className="space-y-3">
            <p className="text-sm">
              {t('import.summary', {
                total: plan.total,
                fresh: plan.fresh.length,
                duplicates: plan.duplicates.length,
              })}
            </p>
            {plan.fresh.length > 0 && (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t('import.targetNotebook')}
                </span>
                <select
                  value={folderId}
                  onChange={(event) => setFolderId(event.target.value)}
                  className="h-9 w-full rounded-lg border border-border/70 bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">{t('import.noNotebook')}</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
