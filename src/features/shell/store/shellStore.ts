import { create } from 'zustand'

const PANELS_KEY = 'vaultnote.panelMode'
const LEGACY_PANELS_KEY = 'vaultnote.panelsHidden'

/** Desktop layout: both panes, nav folded away, or editor only. Cycled in this order. */
export type PanelMode = 'full' | 'list' | 'editor'
const PANEL_ORDER: readonly PanelMode[] = ['full', 'list', 'editor']

/** Desktop pane collapse is kept across sessions; mobile uses the drawer flags instead. */
function readPanelMode(): PanelMode {
  if (typeof localStorage === 'undefined') return 'full'
  const value = localStorage.getItem(PANELS_KEY)
  if (value === 'full' || value === 'list' || value === 'editor') return value
  // Pre-mode builds stored a boolean collapse; that maps to editor-only.
  return localStorage.getItem(LEGACY_PANELS_KEY) === '1' ? 'editor' : 'full'
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
  /** Desktop: which panes are shown; Ctrl+B cycles full → list → editor. Persisted. */
  panelMode: PanelMode
  /** Desktop split view: the note shown in the secondary pane, if any. */
  splitId?: string
  setCommandOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setTemplatePickerOpen: (open: boolean) => void
  setImportOpen: (open: boolean) => void
  setListOpen: (open: boolean) => void
  setNavOpen: (open: boolean) => void
  setPanelMode: (mode: PanelMode) => void
  cyclePanels: () => void
  setSplitId: (id?: string) => void
}

export const useShellStore = create<ShellState>((set) => ({
  commandOpen: false,
  settingsOpen: false,
  templatePickerOpen: false,
  importOpen: false,
  listOpen: true,
  navOpen: false,
  panelMode: readPanelMode(),
  splitId: undefined,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setTemplatePickerOpen: (templatePickerOpen) => set({ templatePickerOpen }),
  setImportOpen: (importOpen) => set({ importOpen }),
  setListOpen: (listOpen) => set({ listOpen }),
  setNavOpen: (navOpen) => set({ navOpen }),
  setPanelMode: (panelMode) => {
    localStorage.setItem(PANELS_KEY, panelMode)
    localStorage.removeItem(LEGACY_PANELS_KEY)
    set({ panelMode })
  },
  cyclePanels: () => {
    const { panelMode, setPanelMode } = useShellStore.getState()
    const next = PANEL_ORDER[(PANEL_ORDER.indexOf(panelMode) + 1) % PANEL_ORDER.length]
    setPanelMode(next)
  },
  setSplitId: (splitId) => set({ splitId }),
}))
