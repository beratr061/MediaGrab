import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke, listen } from '@/lib/tauri';
import type { QueueItem, QueueEvent, DownloadConfig } from '@/types';

interface QueueState {
  items: QueueItem[];
  isLoading: boolean;
  isInitialized: boolean;
  
  // Computed values (cached)
  pendingCount: number;
  activeCount: number;
  completedCount: number;
  failedCount: number;
  
  // Actions
  initialize: () => Promise<void>;
  addToQueue: (config: DownloadConfig) => Promise<QueueItem>;
  cancelItem: (id: number) => Promise<void>;
  removeItem: (id: number) => Promise<void>;
  clearCompleted: () => Promise<void>;
  moveUp: (id: number) => Promise<void>;
  moveDown: (id: number) => Promise<void>;
  reorderItems: (ids: number[]) => Promise<void>;
  pauseAll: () => Promise<void>;
  resumeAll: () => Promise<void>;
  reload: () => Promise<void>;
  
  // Internal actions
  _setItems: (items: QueueItem[]) => void;
  _updateItem: (item: QueueItem) => void;
  _removeItemById: (id: number) => void;
  _clearCompletedItems: () => void;
  _recalculateCounts: () => void;
}

// Helper to calculate counts
const calculateCounts = (items: QueueItem[]) => ({
  pendingCount: items.filter((i) => i.status === 'pending').length,
  activeCount: items.filter((i) => i.status === 'downloading' || i.status === 'merging').length,
  completedCount: items.filter((i) => i.status === 'completed').length,
  failedCount: items.filter((i) => i.status === 'failed').length,
});

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      items: [],
      isLoading: false,
      isInitialized: false,
      pendingCount: 0,
      activeCount: 0,
      completedCount: 0,
      failedCount: 0,

      initialize: async () => {
        if (get().isInitialized) return;
        
        // Load from backend
        await get().reload();
        
        // Setup event listener
        listen<QueueEvent>('queue-update', (event) => {
          const queueEvent = event.payload;
          
          switch (queueEvent.type) {
            case 'itemAdded':
              set((state) => {
                const newItems = [...state.items, queueEvent.item];
                return { items: newItems, ...calculateCounts(newItems) };
              });
              break;
            case 'itemUpdated':
              get()._updateItem(queueEvent.item);
              break;
            case 'itemRemoved':
              get()._removeItemById(queueEvent.id);
              break;
            case 'queueCleared':
              get()._clearCompletedItems();
              break;
          }
        });
        
        set({ isInitialized: true });
      },

      reload: async () => {
        set({ isLoading: true });
        try {
          const queueItems = await invoke<QueueItem[]>('queue_get_all');
          set({ items: queueItems, ...calculateCounts(queueItems) });
        } catch (err) {
          console.error('Failed to load queue:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      addToQueue: async (config: DownloadConfig) => {
        // Optimistic update - add placeholder
        const tempId = Date.now();
        const optimisticItem: QueueItem = {
          id: tempId,
          config,
          status: 'pending',
          progress: 0,
          speed: '--',
          etaSeconds: null,
          error: null,
          filePath: null,
          title: config.url,
          thumbnail: null,
        };
        
        set((state) => {
          const newItems = [...state.items, optimisticItem];
          return { items: newItems, ...calculateCounts(newItems) };
        });
        
        try {
          const item = await invoke<QueueItem>('queue_add', { config });
          // Replace optimistic item with real one
          set((state) => {
            const newItems = state.items.map((i) => (i.id === tempId ? item : i));
            return { items: newItems, ...calculateCounts(newItems) };
          });
          return item;
        } catch (err) {
          // Rollback optimistic update
          set((state) => {
            const newItems = state.items.filter((i) => i.id !== tempId);
            return { items: newItems, ...calculateCounts(newItems) };
          });
          throw err;
        }
      },

      cancelItem: async (id: number) => {
        // Optimistic update
        set((state) => {
          const newItems = state.items.map((i) =>
            i.id === id ? { ...i, status: 'cancelling' as const } : i
          );
          return { items: newItems };
        });
        
        try {
          await invoke('queue_cancel', { id });
        } catch (err) {
          // Reload on error
          await get().reload();
          throw err;
        }
      },

      removeItem: async (id: number) => {
        // Optimistic update
        const previousItems = get().items;
        set((state) => {
          const newItems = state.items.filter((i) => i.id !== id);
          return { items: newItems, ...calculateCounts(newItems) };
        });
        
        try {
          await invoke('queue_remove', { id });
        } catch (err) {
          // Rollback
          set({ items: previousItems, ...calculateCounts(previousItems) });
          throw err;
        }
      },

      clearCompleted: async () => {
        // Optimistic update
        const previousItems = get().items;
        set((state) => {
          const newItems = state.items.filter(
            (i) => i.status !== 'completed' && i.status !== 'failed' && i.status !== 'cancelled'
          );
          return { items: newItems, ...calculateCounts(newItems) };
        });
        
        try {
          await invoke('queue_clear_completed');
        } catch (err) {
          // Rollback
          set({ items: previousItems, ...calculateCounts(previousItems) });
          throw err;
        }
      },

      moveUp: async (id: number) => {
        const items = get().items;
        const index = items.findIndex((i) => i.id === id);
        if (index <= 0) return;
        
        // Optimistic update
        const newItems = [...items];
        const temp = newItems[index - 1]!;
        newItems[index - 1] = newItems[index]!;
        newItems[index] = temp;
        set({ items: newItems });
        
        try {
          await invoke('queue_move_up', { id });
        } catch (err) {
          // Rollback
          set({ items });
          throw err;
        }
      },

      moveDown: async (id: number) => {
        const items = get().items;
        const index = items.findIndex((i) => i.id === id);
        if (index < 0 || index >= items.length - 1) return;
        
        // Optimistic update
        const newItems = [...items];
        const temp = newItems[index]!;
        newItems[index] = newItems[index + 1]!;
        newItems[index + 1] = temp;
        set({ items: newItems });
        
        try {
          await invoke('queue_move_down', { id });
        } catch (err) {
          // Rollback
          set({ items });
          throw err;
        }
      },

      reorderItems: async (ids: number[]) => {
        const previousItems = get().items;
        
        // Optimistic update
        const itemMap = new Map(previousItems.map((item) => [item.id, item]));
        const reordered = ids.map((id) => itemMap.get(id)).filter(Boolean) as QueueItem[];
        const rest = previousItems.filter((item) => !ids.includes(item.id));
        set({ items: [...reordered, ...rest] });
        
        try {
          await invoke('queue_reorder', { ids });
        } catch (err) {
          // Rollback
          set({ items: previousItems });
          throw err;
        }
      },

      pauseAll: async () => {
        await invoke('queue_pause_all');
      },

      resumeAll: async () => {
        await invoke('queue_resume_all');
      },

      // Internal actions
      _setItems: (items) => set({ items, ...calculateCounts(items) }),
      
      _updateItem: (item) => set((state) => {
        const newItems = state.items.map((i) => (i.id === item.id ? item : i));
        return { items: newItems, ...calculateCounts(newItems) };
      }),
      
      _removeItemById: (id) => set((state) => {
        const newItems = state.items.filter((i) => i.id !== id);
        return { items: newItems, ...calculateCounts(newItems) };
      }),
      
      _clearCompletedItems: () => set((state) => {
        const newItems = state.items.filter(
          (i) => i.status !== 'completed' && i.status !== 'failed' && i.status !== 'cancelled'
        );
        return { items: newItems, ...calculateCounts(newItems) };
      }),
      
      _recalculateCounts: () => set((state) => calculateCounts(state.items)),
    }),
    {
      name: 'mediagrab-queue',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist pending items (not completed/failed)
        items: state.items.filter((i) => i.status === 'pending'),
      }),
    }
  )
);
