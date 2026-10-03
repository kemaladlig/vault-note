import { Check, FolderIcon, Inbox } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'
import { flattenFolders, folderColorVar, folderSubtree, type Folder } from '@/shared/folders'

import { useFolderStore } from '../store/folderStore'

interface MoveFolderDialogProps {
  open: boolean
  folder: Folder | null
  onMove: (parentId?: string) => void
  onClose: () => void
}

/** Pick a new parent for a notebook (a mobile/keyboard-friendly fallback to drag-and-drop). */
export function MoveFolderDialog({ open, folder, onMove, onClose }: MoveFolderDialogProps) {
  const folders = useFolderStore((s) => s.folders)
  // Never offer the folder's own subtree as a destination.
  const excluded = folder ? folderSubtree(folders, folder.id) : new Set<string>()
  const rows = flattenFolders(folders).filter(({ folder: item }) => !excluded.has(item.id))

  function choose(parentId?: string) {
    onMove(parentId)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Not defterini taşı"
      description="Bu not defterini başka bir not defterinin altına taşı."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Vazgeç
        </Button>
      }
    >
      <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => choose(undefined)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted',
            folder?.parentId === undefined && 'bg-accent text-accent-foreground',
          )}
        >
          <Inbox className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">En üst düzey</span>
          {folder?.parentId === undefined && <Check className="size-4 shrink-0" />}
        </button>
        {rows.map(({ folder: item, depth }) => {
          const active = item.id === folder?.parentId
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => choose(item.id)}
              style={{ paddingLeft: `${10 + depth * 16}px` }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg py-2 pr-2.5 text-left text-sm transition-colors hover:bg-muted',
                active && 'bg-accent text-accent-foreground',
              )}
            >
              <FolderIcon
                className={cn('size-4 shrink-0', !item.color && 'text-muted-foreground')}
                style={item.color ? { color: folderColorVar(item.color) } : undefined}
              />
              <span className="flex-1 truncate">{item.name}</span>
              {active && <Check className="size-4 shrink-0" />}
            </button>
          )
        })}
        {rows.length === 0 && (
          <p className="px-2.5 py-3 text-sm text-muted-foreground">Başka not defteri yok.</p>
        )}
      </div>
    </Modal>
  )
}
