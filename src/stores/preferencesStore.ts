import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@/lib/tauri';
import type { Preferences, Format, Quality, ScheduledDownload } from '@/types';

const DEFAULT_PREFERENCES: Preferences = {
  outputFolder: '',
  format: 'video-mp4',
  quality: 'best',
  embedSubtitles: false,
  cookiesFromBrowser: null,
  checkUpdatesOnStartup: true,
  checkAppUpdatesOnStartup: true,
  proxyEnabled: false,
  proxyUrl: null,
  filenameTemplate: null,
  cookiesFilePath: null,
  bandwidthLimit: null,
  scheduledDownloads: null,
};

interface PreferencesState {
  preferences: Preferences;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  
  // Pending save state for debouncing
  _pendingSave: Preferences | null;
  _saveTimeout: ReturnType<typeof setTimeout> | null;
  
  // Actions
  initialize: () => Promise<void>;
  reload: () => Promise<void>;
  
  // Setters
  setPreferences: (prefs: Preferences) => void;
  setOutputFolder: (folder: string) => void;
  setFormat: (format: Format) => void;
  setQuality: (quality: Quality) => void;
  setEmbedSubtitles: (embed: boolean) => void;
  setCookiesFromBrowser: (browser: string | null) => void;
  setCheckUpdatesOnStartup: (check: boolean) => void;
  setProxyEnabled: (enabled: boolean) => void;
  setProxyUrl: (url: string | null) => void;
  setFilenameTemplate: (template: string | null) => void;
  setCookiesFilePath: (path: string | null) => void;
  setBandwidthLimit: (limit: number | null) => void;
  setScheduledDownloads: (downloads: ScheduledDownload[] | null) => void;
  
  // Internal
  _updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  _debouncedSave: (prefs: Preferences) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFERENCES,
      isLoading: false,
      isInitialized: false,
      error: null,
      _pendingSave: null,
      _saveTimeout: null,

      initialize: async () => {
        if (get().isInitialized) return;
        await get().reload();
        set({ isInitialized: true });
      },

      reload: async () => {
        set({ isLoading: true, error: null });
        try {
          const prefs = await invoke<Preferences>('load_preferences');
          set({ preferences: prefs });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set({ error: message });
          // Keep default preferences on error
        } finally {
          set({ isLoading: false });
        }
      },

      setPreferences: (prefs: Preferences) => {
        set({ preferences: prefs });
        get()._debouncedSave(prefs);
      },

      _updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
        set((state) => {
          const updated = { ...state.preferences, [key]: value };
          get()._debouncedSave(updated);
          return { preferences: updated };
        });
      },

      _debouncedSave: (prefs: Preferences) => {
        const state = get();
        
        // Clear existing timeout
        if (state._saveTimeout) {
          clearTimeout(state._saveTimeout);
        }
        
        // Set new timeout
        const timeout = setTimeout(async () => {
          try {
            await invoke('save_preferences', { preferences: prefs });
            set({ _pendingSave: null });
          } catch (err) {
            console.error('Failed to save preferences:', err);
          }
        }, 500);
        
        set({ _pendingSave: prefs, _saveTimeout: timeout });
      },

      // Convenience setters
      setOutputFolder: (folder) => get()._updatePreference('outputFolder', folder),
      setFormat: (format) => get()._updatePreference('format', format),
      setQuality: (quality) => get()._updatePreference('quality', quality),
      setEmbedSubtitles: (embed) => get()._updatePreference('embedSubtitles', embed),
      setCookiesFromBrowser: (browser) => get()._updatePreference('cookiesFromBrowser', browser),
      setCheckUpdatesOnStartup: (check) => get()._updatePreference('checkUpdatesOnStartup', check),
      setProxyEnabled: (enabled) => get()._updatePreference('proxyEnabled', enabled),
      setProxyUrl: (url) => get()._updatePreference('proxyUrl', url),
      setFilenameTemplate: (template) => get()._updatePreference('filenameTemplate', template),
      setCookiesFilePath: (path) => get()._updatePreference('cookiesFilePath', path),
      setBandwidthLimit: (limit) => get()._updatePreference('bandwidthLimit', limit),
      setScheduledDownloads: (downloads) => get()._updatePreference('scheduledDownloads', downloads),
    }),
    {
      name: 'mediagrab-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Persist preferences locally as backup
        preferences: state.preferences,
      }),
    }
  )
);
