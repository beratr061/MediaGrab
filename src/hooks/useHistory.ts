import { useEffect } from 'react';
import { useHistoryStore } from '@/stores/historyStore';

/**
 * Hook for managing download history
 * Now uses Zustand store for global state management
 */
export function useHistory() {
  const store = useHistoryStore();

  // Initialize store on first use
  useEffect(() => {
    store.initialize();
  }, []);

  return {
    items: store.items,
    stats: store.stats,
    isLoading: store.isLoading,
    addToHistory: store.addToHistory,
    removeItem: store.removeItem,
    clearHistory: store.clearHistory,
    reload: store.reload,
    reloadStats: store.reloadStats,
    formatBytes: store.formatBytes,
    formatDuration: store.formatDuration,
  };
}

// Direct store access for components that need it
export { useHistoryStore };
