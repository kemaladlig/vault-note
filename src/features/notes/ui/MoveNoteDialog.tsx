import { Check, FolderIcon, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { flattenFolders, folderColorVar } from '@/shared/folders'
import { useT } from '@/shared/i18n'

import { useFolderStore } from '../store/folderStore'

interface MoveNoteDialogProps {
  open: boolean
  currentFolderId?: string
  onSelect: (folderId?: string) => void
  onClose: () => void
}

/** Pick which notebook a note belongs to. */
export function MoveNoteDialog({ open, currentFolderId, onSelect, onClose }: MoveNoteDialogProps) {
  const t = useT()
  const folders = useFolderStore((s) => s.folders)
  const rows = flattenFolders(folders)

  function choose(folderId?: string) {
    onSelect(folderId)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('notes.moveNote.title')}
      description={t('notes.moveNote.desc')}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      }
    >
      <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => choose(undefined)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted',
            !currentFolderId && 'bg-accent text-accent-foreground',
          )}
        >
          <Inbox className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">{t('notes.moveNote.none')}</span>
          {!currentFolderId && <Check className="size-4 shrink-0" />}
        </button>
        {rows.map(({ folder, depth }) => {
          const active = folder.id === currentFolderId
          return (
            <button
              key={folder.id}
              type="button"
              onClick={() => choose(folder.id)}
              style={{ paddingLeft: `${10 + depth * 16}px` }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg py-2 pr-2.5 text-left text-sm transition-colors hover:bg-muted',
                active && 'bg-accent text-accent-foreground',
              )}
            >
              <FolderIcon
                className={cn('size-4 shrink-0', !folder.color && 'text-muted-foreground')}
                style={folder.color ? { color: folderColorVar(folder.color) } : undefined}
              />
              <span className="flex-1 truncate">{folder.name}</span>
              {active && <Check className="size-4 shrink-0" />}
            </button>
          )
        })}
        {rows.length === 0 && (
          <p className="px-2.5 py-3 text-sm text-muted-foreground">
            {t('notes.moveNote.empty')}
          </p>
        )}
      </div>
    </Modal>
  )
}
