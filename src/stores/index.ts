/**
 * Zustand stores for global state management
 * 
 * Features:
 * - Centralized state management (no props drilling)
 * - Optimistic updates for better UX
 * - State persistence with localStorage backup
 * - TypeScript support
 */

export { useQueueStore } from './queueStore';
export { useHistoryStore } from './historyStore';
export { usePreferencesStore } from './preferencesStore';
export { useUIStore } from './uiStore';

// Re-export types for convenience
export type { QueueItem, HistoryItem, Preferences } from '@/types';
