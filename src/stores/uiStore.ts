import { create } from 'zustand';

interface UIState {
  // Panels
  isSettingsOpen: boolean;
  isQueueOpen: boolean;
  isHistoryOpen: boolean;
  isPlaylistOpen: boolean;
  
  // Modals
  isBatchImportOpen: boolean;
  isScheduleOpen: boolean;
  
  // Global states
  isGlobalDragOver: boolean;
  
  // Panel actions
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  
  openQueue: () => void;
  closeQueue: () => void;
  toggleQueue: () => void;
  
  openHistory: () => void;
  closeHistory: () => void;
  toggleHistory: () => void;
  
  openPlaylist: () => void;
  closePlaylist: () => void;
  togglePlaylist: () => void;
  
  // Modal actions
  openBatchImport: () => void;
  closeBatchImport: () => void;
  
  openSchedule: () => void;
  closeSchedule: () => void;
  
  // Global state actions
  setGlobalDragOver: (isDragOver: boolean) => void;
  
  // Close all panels
  closeAllPanels: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  // Initial state
  isSettingsOpen: false,
  isQueueOpen: false,
  isHistoryOpen: false,
  isPlaylistOpen: false,
  isBatchImportOpen: false,
  isScheduleOpen: false,
  isGlobalDragOver: false,

  // Settings panel
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  // Queue panel
  openQueue: () => set({ isQueueOpen: true }),
  closeQueue: () => set({ isQueueOpen: false }),
  toggleQueue: () => set((state) => ({ isQueueOpen: !state.isQueueOpen })),

  // History panel
  openHistory: () => set({ isHistoryOpen: true }),
  closeHistory: () => set({ isHistoryOpen: false }),
  toggleHistory: () => set((state) => ({ isHistoryOpen: !state.isHistoryOpen })),

  // Playlist panel
  openPlaylist: () => set({ isPlaylistOpen: true }),
  closePlaylist: () => set({ isPlaylistOpen: false }),
  togglePlaylist: () => set((state) => ({ isPlaylistOpen: !state.isPlaylistOpen })),

  // Batch import modal
  openBatchImport: () => set({ isBatchImportOpen: true }),
  closeBatchImport: () => set({ isBatchImportOpen: false }),

  // Schedule modal
  openSchedule: () => set({ isScheduleOpen: true }),
  closeSchedule: () => set({ isScheduleOpen: false }),

  // Global drag over
  setGlobalDragOver: (isDragOver) => set({ isGlobalDragOver: isDragOver }),

  // Close all
  closeAllPanels: () => set({
    isSettingsOpen: false,
    isQueueOpen: false,
    isHistoryOpen: false,
    isPlaylistOpen: false,
    isBatchImportOpen: false,
    isScheduleOpen: false,
  }),
}));
