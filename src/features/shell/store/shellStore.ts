import { create } from 'zustand'

const PANELS_KEY = 'vaultnote.panelsHidden'

/** Desktop pane collapse is kept across sessions; mobile uses the drawer flags instead. */
function readPanelsHidden(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(PANELS_KEY) === '1'
}

/** App-chrome state: which overlays are open, the mobile pane, and the split editor. */
interface ShellState {
  commandOpen: boolean
  settingsOpen: boolean
  /** New-note-from-template picker. */
  templatePickerOpen: boolean
  /** Import dry-run / commit dialog. */
  importOpen: boolean
  /** Mobile: true shows the note list, false shows the editor. Desktop ignores this. */
  listOpen: boolean
  /** Below xl: the navigation sidebar renders as an overlay drawer when true. */
  navOpen: boolean
  /** Desktop: nav + note-list panes collapsed to the editor only. Persisted. */
  panelsHidden: boolean
  /** Desktop split view: the note shown in the secondary pane, if any. */
  splitId?: string
  setCommandOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setTemplatePickerOpen: (open: boolean) => void
  setImportOpen: (open: boolean) => void
  setListOpen: (open: boolean) => void
  setNavOpen: (open: boolean) => void
  setPanelsHidden: (hidden: boolean) => void
  togglePanels: () => void
  setSplitId: (id?: string) => void
}

export const useShellStore = create<ShellState>((set) => ({
  commandOpen: false,
  settingsOpen: false,
  templatePickerOpen: false,
  importOpen: false,
  listOpen: true,
  navOpen: false,
  panelsHidden: readPanelsHidden(),
  splitId: undefined,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setTemplatePickerOpen: (templatePickerOpen) => set({ templatePickerOpen }),
  setImportOpen: (importOpen) => set({ importOpen }),
  setListOpen: (listOpen) => set({ listOpen }),
  setNavOpen: (navOpen) => set({ navOpen }),
  setPanelsHidden: (panelsHidden) => {
    localStorage.setItem(PANELS_KEY, panelsHidden ? '1' : '0')
    set({ panelsHidden })
  },
  togglePanels: () => {
    const { panelsHidden, setPanelsHidden } = useShellStore.getState()
    setPanelsHidden(!panelsHidden)
  },
  setSplitId: (splitId) => set({ splitId }),
}))
