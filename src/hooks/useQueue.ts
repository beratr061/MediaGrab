import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { QueueItem, QueueEvent, DownloadConfig } from '@/types';

/**
 * Hook for managing the download queue
 */
export function useQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial queue state
  useEffect(() => {
    loadQueue();
  }, []);

  // Listen for queue events
  useEffect(() => {
    const unlisten = listen<QueueEvent>('queue-update', (event) => {
      const queueEvent = event.payload;

      switch (queueEvent.type) {
        case 'itemAdded':
          setItems((prev) => [...prev, queueEvent.item]);
          break;
        case 'itemUpdated':
          setItems((prev) =>
            prev.map((item) =>
              item.id === queueEvent.item.id ? queueEvent.item : item
            )
          );
          break;
        case 'itemRemoved':
          setItems((prev) => prev.filter((item) => item.id !== queueEvent.id));
          break;
        case 'queueCleared':
          setItems((prev) =>
            prev.filter(
              (item) =>
                item.status !== 'completed' &&
                item.status !== 'failed' &&
                item.status !== 'cancelled'
            )
          );
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const loadQueue = async () => {
    try {
      setIsLoading(true);
      const queueItems = await invoke<QueueItem[]>('queue_get_all');
      setItems(queueItems);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addToQueue = useCallback(async (config: DownloadConfig) => {
    try {
      const item = await invoke<QueueItem>('queue_add', { config });
      return item;
    } catch (err) {
      console.error('Failed to add to queue:', err);
      throw err;
    }
  }, []);

  const cancelItem = useCallback(async (id: number) => {
    try {
      await invoke('queue_cancel', { id });
    } catch (err) {
      console.error('Failed to cancel item:', err);
      throw err;
    }
  }, []);

  const removeItem = useCallback(async (id: number) => {
    try {
      await invoke('queue_remove', { id });
    } catch (err) {
      console.error('Failed to remove item:', err);
      throw err;
    }
  }, []);

  const clearCompleted = useCallback(async () => {
    try {
      await invoke('queue_clear_completed');
    } catch (err) {
      console.error('Failed to clear completed:', err);
      throw err;
    }
  }, []);

  const moveUp = useCallback(async (id: number) => {
    try {
      await invoke('queue_move_up', { id });
    } catch (err) {
      console.error('Failed to move item up:', err);
      throw err;
    }
  }, []);

  const moveDown = useCallback(async (id: number) => {
    try {
      await invoke('queue_move_down', { id });
    } catch (err) {
      console.error('Failed to move item down:', err);
      throw err;
    }
  }, []);

  // Computed values
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const activeCount = items.filter(
    (i) => i.status === 'downloading' || i.status === 'merging'
  ).length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;

  return {
    items,
    isLoading,
    addToQueue,
    cancelItem,
    removeItem,
    clearCompleted,
    moveUp,
    moveDown,
    reload: loadQueue,
    pendingCount,
    activeCount,
    completedCount,
    failedCount,
  };
}
