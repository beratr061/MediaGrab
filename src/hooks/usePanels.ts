/**
 * usePanels hook - Manages panel open/close states
 */

import { useState, useCallback } from "react";

interface UsePanelsReturn {
  isSettingsOpen: boolean;
  isQueueOpen: boolean;
  isHistoryOpen: boolean;
  isPlaylistOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  openQueue: () => void;
  closeQueue: () => void;
  openHistory: () => void;
  closeHistory: () => void;
  openPlaylist: () => void;
  closePlaylist: () => void;
}

export function usePanels(): UsePanelsReturn {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const openQueue = useCallback(() => setIsQueueOpen(true), []);
  const closeQueue = useCallback(() => setIsQueueOpen(false), []);
  const openHistory = useCallback(() => setIsHistoryOpen(true), []);
  const closeHistory = useCallback(() => setIsHistoryOpen(false), []);
  const openPlaylist = useCallback(() => setIsPlaylistOpen(true), []);
  const closePlaylist = useCallback(() => setIsPlaylistOpen(false), []);

  return {
    isSettingsOpen,
    isQueueOpen,
    isHistoryOpen,
    isPlaylistOpen,
    openSettings,
    closeSettings,
    openQueue,
    closeQueue,
    openHistory,
    closeHistory,
    openPlaylist,
    closePlaylist,
  };
}
