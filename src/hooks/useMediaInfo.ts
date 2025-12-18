/**
 * useMediaInfo hook - Manages media info fetching and playlist detection
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { validateUrl } from "@/lib/validation";
import type { MediaInfo, PlaylistInfo } from "@/types";

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

    setIsLoadingMediaInfo(true);

    try {
      const info = await invoke<MediaInfo>("fetch_media_info", { url: urlToFetch });
      setMediaInfo(info);
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
  };
}
