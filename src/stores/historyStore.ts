import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@/lib/tauri';
import type { HistoryItem, DownloadStats, DownloadConfig } from '@/types';

interface HistoryState {
  items: HistoryItem[];
  stats: DownloadStats | null;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  addToHistory: (
    config: DownloadConfig,
    title: string,
    thumbnail: string | null,
    filePath: string | null,
    fileSize: number | null,
    duration: number | null,
    status: 'completed' | 'failed',
    error: string | null
  ) => Promise<HistoryItem>;
  removeItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  reload: () => Promise<void>;
  reloadStats: () => Promise<void>;
  
  // Utilities
  formatBytes: (bytes: number) => string;
  formatDuration: (seconds: number) => string;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      stats: null,
      isLoading: false,
      isInitialized: false,

      initialize: async () => {
        if (get().isInitialized) return;
        await get().reload();
        await get().reloadStats();
        set({ isInitialized: true });
      },

      reload: async () => {
        set({ isLoading: true });
        try {
          const historyItems = await invoke<HistoryItem[]>('history_get_all');
          set({ items: historyItems });
        } catch (err) {
          console.error('Failed to load history:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      reloadStats: async () => {
        try {
          const downloadStats = await invoke<DownloadStats>('history_get_stats');
          set({ stats: downloadStats });
        } catch (err) {
          console.error('Failed to load stats:', err);
        }
      },

      addToHistory: async (
        config,
        title,
        thumbnail,
        filePath,
        fileSize,
        duration,
        status,
        error
      ) => {
        const item: HistoryItem = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url: config.url,
          title,
          thumbnail,
          format: config.format,
          quality: config.quality,
          filePath,
          fileSize,
          duration,
          downloadedAt: Math.floor(Date.now() / 1000),
          status,
          error,
        };

        // Optimistic update
        set((state) => ({ items: [item, ...state.items] }));

        try {
          await invoke('history_add', { item });
          // Reload stats after adding
          get().reloadStats();
          return item;
        } catch (err) {
          // Rollback on error
          set((state) => ({
            items: state.items.filter((i) => i.id !== item.id),
          }));
          throw err;
        }
      },

      removeItem: async (id: string) => {
        const previousItems = get().items;
        
        // Optimistic update
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));

        try {
          await invoke('history_remove', { id });
        } catch (err) {
          // Rollback
          set({ items: previousItems });
          throw err;
        }
      },

      clearHistory: async () => {
        const previousItems = get().items;
        
        // Optimistic update
        set({ items: [] });

        try {
          await invoke('history_clear');
        } catch (err) {
          // Rollback
          set({ items: previousItems });
          throw err;
        }
      },

      formatBytes: (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
      },

      formatDuration: (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
          return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
      },
    }),
    {
      name: 'mediagrab-history',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist last 100 history items locally as backup
        items: state.items.slice(0, 100),
      }),
    }
  )
);
