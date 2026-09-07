import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppMode = "docker" | "kubernetes" | "microvms";
export type ThemeMode = "system" | "light" | "dark";

type UIState = {
  mode: AppMode;
  theme: ThemeMode;
  namespace: string;
  composeRoots: string[];
  /** Default for Run container “Start after create”. */
  startAfterCreate: boolean;
  /** When false, container list hides non-running by default. */
  showStoppedContainers: boolean;
  /** When false, prune runs without the confirm dialog. */
  confirmPrune: boolean;
  /** When false, icon-rail hover labels are hidden. */
  sidebarTooltips: boolean;
  commandPaletteOpen: boolean;
  runSheetOpen: boolean;
  runSheetImage?: string;
  pruneSheetOpen: boolean;
  pendingContainerId?: string;
  pendingImageId?: string;
  pendingVolumeName?: string;
  setMode: (mode: AppMode) => void;
  setTheme: (theme: ThemeMode) => void;
  setNamespace: (ns: string) => void;
  setStartAfterCreate: (v: boolean) => void;
  setShowStoppedContainers: (v: boolean) => void;
  setConfirmPrune: (v: boolean) => void;
  setSidebarTooltips: (v: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  addComposeRoot: (root: string) => void;
  removeComposeRoot: (root: string) => void;
  openRunSheet: (image?: string) => void;
  closeRunSheet: () => void;
  openPruneSheet: () => void;
  closePruneSheet: () => void;
  setPendingContainerId: (id?: string) => void;
  setPendingImageId: (id?: string) => void;
  setPendingVolumeName: (name?: string) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      mode: "docker",
      theme: "system",
      namespace: "default",
      composeRoots: [],
      startAfterCreate: true,
      showStoppedContainers: true,
      confirmPrune: true,
      sidebarTooltips: true,
      commandPaletteOpen: false,
      runSheetOpen: false,
      runSheetImage: undefined,
      pruneSheetOpen: false,
      pendingContainerId: undefined,
      pendingImageId: undefined,
      pendingVolumeName: undefined,
      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setNamespace: (namespace) => set({ namespace }),
      setStartAfterCreate: (startAfterCreate) => set({ startAfterCreate }),
      setShowStoppedContainers: (showStoppedContainers) => set({ showStoppedContainers }),
      setConfirmPrune: (confirmPrune) => set({ confirmPrune }),
      setSidebarTooltips: (sidebarTooltips) => set({ sidebarTooltips }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      addComposeRoot: (root) =>
        set((s) => {
          const trimmed = root.trim();
          if (!trimmed || s.composeRoots.includes(trimmed)) return s;
          return { composeRoots: [...s.composeRoots, trimmed] };
        }),
      removeComposeRoot: (root) =>
        set((s) => ({ composeRoots: s.composeRoots.filter((r) => r !== root) })),
      openRunSheet: (image) => set({ runSheetOpen: true, runSheetImage: image }),
      closeRunSheet: () => set({ runSheetOpen: false, runSheetImage: undefined }),
      openPruneSheet: () => set({ pruneSheetOpen: true }),
      closePruneSheet: () => set({ pruneSheetOpen: false }),
      setPendingContainerId: (pendingContainerId) => set({ pendingContainerId }),
      setPendingImageId: (pendingImageId) => set({ pendingImageId }),
      setPendingVolumeName: (pendingVolumeName) => set({ pendingVolumeName }),
    }),
    {
      name: "deckhand-ui",
      partialize: (s) => ({
        mode: s.mode,
        theme: s.theme,
        namespace: s.namespace,
        composeRoots: s.composeRoots,
        startAfterCreate: s.startAfterCreate,
        showStoppedContainers: s.showStoppedContainers,
        confirmPrune: s.confirmPrune,
        sidebarTooltips: s.sidebarTooltips,
      }),
    },
  ),
);
