import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Preferences, Format, Quality } from "../types";

/**
 * Hook for managing user preferences with persistence
 * Requirements: 9.1, 9.2 - Persist output folder, format, and quality selections
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track pending save to debounce
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefsRef = useRef<Preferences | null>(null);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const prefs = await invoke<Preferences>("load_preferences");
      setPreferences(prefs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      // Set default preferences on error
      setPreferences({
        outputFolder: "",
        format: "video-mp4",
        quality: "best",
        embedSubtitles: false,
        cookiesFromBrowser: null,
        checkUpdatesOnStartup: true,
        checkAppUpdatesOnStartup: true,
        proxyEnabled: false,
        proxyUrl: null,
        filenameTemplate: null,
        cookiesFilePath: null,
      });
    } finally {
      setLoading(false);
    }
  };


  // Debounced save function
  const debouncedSave = useCallback((prefs: Preferences) => {
    pendingPrefsRef.current = prefs;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      const toSave = pendingPrefsRef.current;
      if (!toSave) return;
      
      try {
        await invoke("save_preferences", { preferences: toSave });
        pendingPrefsRef.current = null;
      } catch (err) {
        console.error("Failed to save preferences:", err);
      }
    }, 500); // 500ms debounce
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Update a single preference field
  const updatePreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPreferences((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, [key]: value };
        debouncedSave(updated);
        return updated;
      });
    },
    [debouncedSave]
  );

  // Convenience setters
  const setOutputFolder = useCallback(
    (folder: string) => updatePreference("outputFolder", folder),
    [updatePreference]
  );

  const setFormat = useCallback(
    (format: Format) => updatePreference("format", format),
    [updatePreference]
  );

  const setQuality = useCallback(
    (quality: Quality) => updatePreference("quality", quality),
    [updatePreference]
  );

  const setEmbedSubtitles = useCallback(
    (embed: boolean) => updatePreference("embedSubtitles", embed),
    [updatePreference]
  );

  const setCookiesFromBrowser = useCallback(
    (browser: string | null) => updatePreference("cookiesFromBrowser", browser),
    [updatePreference]
  );

  const setCheckUpdatesOnStartup = useCallback(
    (check: boolean) => updatePreference("checkUpdatesOnStartup", check),
    [updatePreference]
  );

  // Full preferences setter (for external updates)
  const setFullPreferences = useCallback(
    (prefs: Preferences) => {
      setPreferences(prefs);
      debouncedSave(prefs);
    },
    [debouncedSave]
  );

  return {
    preferences,
    loading,
    error,
    setOutputFolder,
    setFormat,
    setQuality,
    setEmbedSubtitles,
    setCookiesFromBrowser,
    setCheckUpdatesOnStartup,
    setPreferences: setFullPreferences,
    reload: loadPreferences,
  };
}
