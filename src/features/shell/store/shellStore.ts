import { create } from 'zustand'

/** App-chrome state: which overlays are open, the mobile pane, and the split editor. */
interface ShellState {
  commandOpen: boolean
  settingsOpen: boolean
  /** Mobile: true shows the note list, false shows the editor. Desktop ignores this. */
  listOpen: boolean
  /** Below xl: the navigation sidebar renders as an overlay drawer when true. */
  navOpen: boolean
  /** Desktop split view: the note shown in the secondary pane, if any. */
  splitId?: string
  setCommandOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setListOpen: (open: boolean) => void
  setNavOpen: (open: boolean) => void
  setSplitId: (id?: string) => void
}

export const useShellStore = create<ShellState>((set) => ({
  commandOpen: false,
  settingsOpen: false,
  listOpen: true,
  navOpen: false,
  splitId: undefined,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setListOpen: (listOpen) => set({ listOpen }),
  setNavOpen: (navOpen) => set({ navOpen }),
  setSplitId: (splitId) => set({ splitId }),
}))
