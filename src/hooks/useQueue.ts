import { useEffect } from 'react';
import { useQueueStore } from '@/stores/queueStore';

/**
 * Hook for managing the download queue
 * Now uses Zustand store for global state management
 */
export function useQueue() {
  const store = useQueueStore();

  // Initialize store on first use
  useEffect(() => {
    store.initialize();
  }, []);

  return {
    items: store.items,
    isLoading: store.isLoading,
    addToQueue: store.addToQueue,
    cancelItem: store.cancelItem,
    removeItem: store.removeItem,
    clearCompleted: store.clearCompleted,
    moveUp: store.moveUp,
    moveDown: store.moveDown,
    reorderItems: store.reorderItems,
    pauseAll: store.pauseAll,
    resumeAll: store.resumeAll,
    reload: store.reload,
    pendingCount: store.pendingCount,
    activeCount: store.activeCount,
    completedCount: store.completedCount,
    failedCount: store.failedCount,
  };
}

// Direct store access for components that need it
export { useQueueStore };
