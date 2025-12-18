/**
 * useMediaInfo hook - Manages media info fetching and playlist detection
 * Includes LRU cache for media info to avoid redundant API calls
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { validateUrl } from "@/lib/validation";
import type { MediaInfo, PlaylistInfo } from "@/types";

// LRU Cache for media info
const CACHE_MAX_SIZE = 50;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  data: MediaInfo;
  timestamp: number;
}

class MediaInfoCache {
  private cache = new Map<string, CacheEntry>();

  private normalizeUrl(url: string): string {
    // Normalize YouTube URLs to consistent format
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
        const videoId = urlObj.searchParams.get("v") || urlObj.pathname.split("/").pop();
        if (videoId) return `youtube:${videoId}`;
      }
      return url.trim().toLowerCase();
    } catch {
      return url.trim().toLowerCase();
    }
  }

  get(url: string): MediaInfo | null {
    const key = this.normalizeUrl(url);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  set(url: string, data: MediaInfo): void {
    const key = this.normalizeUrl(url);

    // Remove oldest entries if at capacity
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton cache instance
const mediaInfoCache = new MediaInfoCache();

interface UseMediaInfoReturn {
  mediaInfo: MediaInfo | null;
  isLoadingMediaInfo: boolean;
  isPlaylist: boolean;
  playlistInfo: PlaylistInfo | null;
  isLoadingPlaylist: boolean;
  fetchMediaInfo: (url: string) => Promise<void>;
  handleUrlChange: (newUrl: string, setUrl: (url: string) => void) => void;
  handlePaste: (setUrl: (url: string) => void) => Promise<void>;
  clearMediaInfo: () => void;
  clearCache: () => void;
}

export function useMediaInfo(): UseMediaInfoReturn {
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [isLoadingMediaInfo, setIsLoadingMediaInfo] = useState(false);
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const fetchMediaInfo = useCallback(async (urlToFetch: string) => {
    const validation = validateUrl(urlToFetch);
    if (!validation.isValid) {
      setMediaInfo(null);
      return;
    }

    // Check cache first
    const cached = mediaInfoCache.get(urlToFetch);
    if (cached) {
      setMediaInfo(cached);
      return;
    }

    setIsLoadingMediaInfo(true);

    try {
      const info = await invoke<MediaInfo>("fetch_media_info", { url: urlToFetch });
      setMediaInfo(info);
      // Store in cache
      mediaInfoCache.set(urlToFetch, info);
    } catch (err) {
      console.error("Failed to fetch media info:", err);
      setMediaInfo(null);
    } finally {
      setIsLoadingMediaInfo(false);
    }
  }, []);

  const checkPlaylist = useCallback(async (urlToCheck: string) => {
    try {
      const isPlaylistUrl = await invoke<boolean>("check_is_playlist", { url: urlToCheck });
      setIsPlaylist(isPlaylistUrl);
      if (isPlaylistUrl) {
        setIsLoadingPlaylist(true);
        try {
          const info = await invoke<PlaylistInfo>("fetch_playlist_info", { url: urlToCheck });
          setPlaylistInfo(info);
        } catch (err) {
          console.error("Failed to fetch playlist info:", err);
          setPlaylistInfo(null);
        } finally {
          setIsLoadingPlaylist(false);
        }
      } else {
        setPlaylistInfo(null);
      }
    } catch (err) {
      console.error("Failed to check playlist:", err);
      setIsPlaylist(false);
      setPlaylistInfo(null);
    }
  }, []);

  const handleUrlChange = useCallback(
    (newUrl: string, setUrl: (url: string) => void) => {
      setUrl(newUrl);
      setMediaInfo(null);
      setIsPlaylist(false);
      setPlaylistInfo(null);

      // Clear any existing debounce timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }

      // Debounce media info fetch and playlist check
      const trimmedUrl = newUrl.trim();
      if (trimmedUrl && validateUrl(trimmedUrl).isValid) {
        debounceTimeoutRef.current = setTimeout(() => {
          checkPlaylist(trimmedUrl);
          fetchMediaInfo(trimmedUrl);
          debounceTimeoutRef.current = null;
        }, 500);
      }
    },
    [fetchMediaInfo, checkPlaylist]
  );

  const handlePaste = useCallback(
    async (setUrl: (url: string) => void) => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const trimmedText = text.trim();
          setUrl(trimmedText);
          setMediaInfo(null);
          if (validateUrl(trimmedText).isValid) {
            fetchMediaInfo(trimmedText);
          }
        }
      } catch {
        // Clipboard access denied
      }
    },
    [fetchMediaInfo]
  );

  const clearMediaInfo = useCallback(() => {
    setMediaInfo(null);
    setIsPlaylist(false);
    setPlaylistInfo(null);
  }, []);

  const clearCache = useCallback(() => {
    mediaInfoCache.clear();
  }, []);

  return {
    mediaInfo,
    isLoadingMediaInfo,
    isPlaylist,
    playlistInfo,
    isLoadingPlaylist,
    fetchMediaInfo,
    handleUrlChange,
    handlePaste,
    clearMediaInfo,
    clearCache,
  };
}
