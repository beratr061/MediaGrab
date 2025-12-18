import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { HistoryItem, DownloadStats, DownloadConfig } from '@/types';

/**
 * Hook for managing download history
 */
export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<DownloadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load history and stats on mount
  useEffect(() => {
    loadHistory();
    loadStats();
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const historyItems = await invoke<HistoryItem[]>('history_get_all');
      setItems(historyItems);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const downloadStats = await invoke<DownloadStats>('history_get_stats');
      setStats(downloadStats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const addToHistory = useCallback(
    async (
      config: DownloadConfig,
      title: string,
      thumbnail: string | null,
      filePath: string | null,
      fileSize: number | null,
      duration: number | null,
      status: 'completed' | 'failed',
      error: string | null
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

      try {
        await invoke('history_add', { item });
        setItems((prev) => [item, ...prev]);
        // Reload stats after adding
        loadStats();
        return item;
      } catch (err) {
        console.error('Failed to add to history:', err);
        throw err;
      }
    },
    []
  );

  const removeItem = useCallback(async (id: string) => {
    try {
      await invoke('history_remove', { id });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to remove history item:', err);
      throw err;
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await invoke('history_clear');
      setItems([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
      throw err;
    }
  }, []);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Format duration to human readable
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return {
    items,
    stats,
    isLoading,
    addToHistory,
    removeItem,
    clearHistory,
    reload: loadHistory,
    reloadStats: loadStats,
    formatBytes,
    formatDuration,
  };
}
