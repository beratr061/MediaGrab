import { useEffect } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';

/**
 * Hook for managing user preferences with persistence
 * Now uses Zustand store for global state management
 * Requirements: 9.1, 9.2 - Persist output folder, format, and quality selections
 */
export function usePreferences() {
  const store = usePreferencesStore();

  // Initialize store on first use
  useEffect(() => {
    store.initialize();
  }, []);

  return {
    preferences: store.preferences,
    loading: store.isLoading,
    error: store.error,
    setOutputFolder: store.setOutputFolder,
    setFormat: store.setFormat,
    setQuality: store.setQuality,
    setEmbedSubtitles: store.setEmbedSubtitles,
    setCookiesFromBrowser: store.setCookiesFromBrowser,
    setCheckUpdatesOnStartup: store.setCheckUpdatesOnStartup,
    setPreferences: store.setPreferences,
    reload: store.reload,
  };
}

// Direct store access for components that need it
export { usePreferencesStore };
