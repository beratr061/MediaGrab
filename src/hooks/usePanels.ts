import { useUIStore } from '@/stores/uiStore';

/**
 * Hook for managing panel visibility
 * Now uses Zustand store for global state management
 */
export function usePanels() {
  const store = useUIStore();

  return {
    // Settings
    isSettingsOpen: store.isSettingsOpen,
    openSettings: store.openSettings,
    closeSettings: store.closeSettings,
    toggleSettings: store.toggleSettings,
    
    // Queue
    isQueueOpen: store.isQueueOpen,
    openQueue: store.openQueue,
    closeQueue: store.closeQueue,
    toggleQueue: store.toggleQueue,
    
    // History
    isHistoryOpen: store.isHistoryOpen,
    openHistory: store.openHistory,
    closeHistory: store.closeHistory,
    toggleHistory: store.toggleHistory,
    
    // Playlist
    isPlaylistOpen: store.isPlaylistOpen,
    openPlaylist: store.openPlaylist,
    closePlaylist: store.closePlaylist,
    togglePlaylist: store.togglePlaylist,
    
    // Close all
    closeAllPanels: store.closeAllPanels,
  };
}

// Direct store access for components that need it
export { useUIStore };
