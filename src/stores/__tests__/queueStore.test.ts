import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useQueueStore } from '../queueStore';
import type { DownloadConfig } from '@/types';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

describe('queueStore', () => {
  beforeEach(() => {
    // Reset store state
    useQueueStore.setState({
      items: [],
      isLoading: false,
      isInitialized: false,
      pendingCount: 0,
      activeCount: 0,
      completedCount: 0,
      failedCount: 0,
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('has correct initial state', () => {
    const state = useQueueStore.getState();
    expect(state.items).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.pendingCount).toBe(0);
    expect(state.activeCount).toBe(0);
  });

  it('calculates counts correctly', () => {
    useQueueStore.setState({
      items: [
        { id: 1, status: 'pending', config: {} as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: null, filePath: null, title: null, thumbnail: null },
        { id: 2, status: 'pending', config: {} as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: null, filePath: null, title: null, thumbnail: null },
        { id: 3, status: 'downloading', config: {} as DownloadConfig, progress: 50, speed: '1MB/s', etaSeconds: 60, error: null, filePath: null, title: null, thumbnail: null },
        { id: 4, status: 'completed', config: {} as DownloadConfig, progress: 100, speed: '--', etaSeconds: null, error: null, filePath: '/path/to/file', title: 'Test', thumbnail: null },
        { id: 5, status: 'failed', config: {} as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: 'Network error', filePath: null, title: null, thumbnail: null },
      ],
      pendingCount: 2,
      activeCount: 1,
      completedCount: 1,
      failedCount: 1,
    });

    const state = useQueueStore.getState();
    expect(state.pendingCount).toBe(2);
    expect(state.activeCount).toBe(1);
    expect(state.completedCount).toBe(1);
    expect(state.failedCount).toBe(1);
  });

  it('updates item correctly', () => {
    useQueueStore.setState({
      items: [
        { id: 1, status: 'pending', config: {} as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: null, filePath: null, title: null, thumbnail: null },
      ],
      pendingCount: 1,
      activeCount: 0,
      completedCount: 0,
      failedCount: 0,
    });

    act(() => {
      useQueueStore.getState()._updateItem({
        id: 1,
        status: 'downloading',
        config: {} as DownloadConfig,
        progress: 50,
        speed: '2MB/s',
        etaSeconds: 30,
        error: null,
        filePath: null,
        title: 'Updated Title',
        thumbnail: null,
      });
    });

    const state = useQueueStore.getState();
    expect(state.items[0].status).toBe('downloading');
    expect(state.items[0].progress).toBe(50);
    expect(state.items[0].title).toBe('Updated Title');
    expect(state.activeCount).toBe(1);
    expect(state.pendingCount).toBe(0);
  });

  it('removes item correctly', () => {
    useQueueStore.setState({
      items: [
        { id: 1, status: 'pending', config: {} as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: null, filePath: null, title: null, thumbnail: null },
        { id: 2, status: 'pending', config: {} as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: null, filePath: null, title: null, thumbnail: null },
      ],
      pendingCount: 2,
      activeCount: 0,
      completedCount: 0,
      failedCount: 0,
    });

    act(() => {
      useQueueStore.getState()._removeItemById(1);
    });

    const state = useQueueStore.getState();
    expect(state.items.length).toBe(1);
    expect(state.items[0].id).toBe(2);
    expect(state.pendingCount).toBe(1);
  });

  it('clears completed items correctly', () => {
    useQueueStore.setState({
      items: [
        { id: 1, status: 'pending', config: {} as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: null, filePath: null, title: null, thumbnail: null },
        { id: 2, status: 'completed', config: {} as DownloadConfig, progress: 100, speed: '--', etaSeconds: null, error: null, filePath: '/path', title: null, thumbnail: null },
        { id: 3, status: 'failed', config: {} as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: 'Error', filePath: null, title: null, thumbnail: null },
        { id: 4, status: 'cancelled', config: {} as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: null, filePath: null, title: null, thumbnail: null },
      ],
      pendingCount: 1,
      activeCount: 0,
      completedCount: 1,
      failedCount: 1,
    });

    act(() => {
      useQueueStore.getState()._clearCompletedItems();
    });

    const state = useQueueStore.getState();
    expect(state.items.length).toBe(1);
    expect(state.items[0].id).toBe(1);
    expect(state.pendingCount).toBe(1);
    expect(state.completedCount).toBe(0);
    expect(state.failedCount).toBe(0);
  });

  it('persists pending items to localStorage', () => {
    useQueueStore.setState({
      items: [
        { id: 1, status: 'pending', config: { url: 'https://example.com' } as DownloadConfig, progress: 0, speed: '--', etaSeconds: null, error: null, filePath: null, title: null, thumbnail: null },
        { id: 2, status: 'completed', config: { url: 'https://example2.com' } as DownloadConfig, progress: 100, speed: '--', etaSeconds: null, error: null, filePath: '/path', title: null, thumbnail: null },
      ],
      pendingCount: 1,
      activeCount: 0,
      completedCount: 1,
      failedCount: 0,
    });

    // Trigger persist
    useQueueStore.persist.rehydrate();

    const stored = localStorage.getItem('mediagrab-queue');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only pending items should be persisted
      expect(parsed.state.items.length).toBe(1);
      expect(parsed.state.items[0].status).toBe('pending');
    }
  });
});
