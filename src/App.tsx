/**
 * App.tsx - Main application component
 * 
 * Refactored for better separation of concerns:
 * - Layout components: AppHeader, AppFooter
 * - Form management: DownloadFormSection
 * - Panel management: PanelManager
 * - Hooks: useSchedule, useDownloadForm, useDragDrop
 */

import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

// Layout components
import { AppHeader, AppFooter } from "@/components/layout";
import { DragOverlay } from "@/components/DragOverlay";
import { UpdateBanner } from "@/components/UpdateBanner";
import { DownloadFormSection } from "@/components/DownloadFormSection";
import { PanelManager } from "@/components/PanelManager";
import { useToast } from "@/components/Toast";

// Hooks
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePreferences } from "@/hooks/usePreferences";
import { useQueue } from "@/hooks/useQueue";
import { useHistory } from "@/hooks/useHistory";
import { useDownload } from "@/hooks/useDownload";
import { useMediaInfo } from "@/hooks/useMediaInfo";
import { usePanels } from "@/hooks/usePanels";
import { useUpdateNotification } from "@/hooks/useUpdateNotification";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSchedule } from "@/hooks/useSchedule";
import { useDownloadForm } from "@/hooks/useDownloadForm";
import { useDragDrop } from "@/hooks/useDragDrop";

// Utilities
import { fadeInVariants, containerVariants, defaultTransition } from "@/lib/animations";

// Types
import type { DownloadConfig, PlaylistEntry } from "@/types";

function App() {
  const { t } = useTranslation();
  const { success, info } = useToast();

  // Form state management
  const {
    url,
    setUrl,
    format,
    quality,
    outputFolder,
    setOutputFolder,
    handleFormatChange,
    handleQualityChange,
    handlePickFolder,
  } = useDownloadForm();

  // Preferences
  const { preferences } = usePreferences();

  // Queue & History
  const { addToQueue, activeCount, pendingCount } = useQueue();
  const { addToHistory } = useHistory();

  // Media info & playlist
  const {
    mediaInfo,
    isLoadingMediaInfo,
    isPlaylist,
    playlistInfo,
    isLoadingPlaylist,
    fetchMediaInfo,
    handleUrlChange: onMediaUrlChange,
    handlePaste: onPaste,
    clearMediaInfo
  } = useMediaInfo();

  // Network status
  const networkStatus = useNetworkStatus();

  // Show toast when coming back online
  const wasOfflineRef = useRef(!networkStatus.isOnline || !networkStatus.isConnected);
  useEffect(() => {
    const isCurrentlyOffline = !networkStatus.isOnline || !networkStatus.isConnected;
    if (wasOfflineRef.current && !isCurrentlyOffline) {
      success(t("network.reconnected"));
    }
    wasOfflineRef.current = isCurrentlyOffline;
  }, [networkStatus.isOnline, networkStatus.isConnected, success, t]);

  // Schedule management
  const {
    scheduledDownloads,
    addScheduledDownload,
    removeScheduledDownload,
    toggleScheduledDownload
  } = useSchedule({ outputFolder });

  // Download state
  const {
    downloadState,
    progress,
    error,
    downloadedFilePath,
    retryInfo,
    isDownloading,
    isIdle,
    handleDownload,
    handleCancel,
  } = useDownload({
    url,
    format,
    quality,
    outputFolder,
    mediaInfo,
    isLoadingMediaInfo,
    preferences,
    fetchMediaInfo,
    addToHistory,
    isOffline: !networkStatus.isOnline || !networkStatus.isConnected,
  });

  // Panels
  const { openSettings, openQueue, openHistory } = usePanels();

  // Update notification
  const { updateAvailable, dismissUpdate } = useUpdateNotification();

  // URL change handler that updates both form and media info
  const handleUrlChange = useCallback((newUrl: string) => {
    onMediaUrlChange(newUrl, setUrl);
  }, [onMediaUrlChange, setUrl]);

  // Paste handler
  const handlePaste = useCallback(() => {
    onPaste(setUrl);
  }, [onPaste, setUrl]);

  // Drag & drop
  const { isGlobalDragOver, handleDragOver, handleDragLeave, handleDrop } = useDragDrop({
    isDownloading,
    onUrlDrop: setUrl,
  });

  // Handle multiple URLs pasted at once
  const handleMultipleUrls = useCallback(async (urls: string[]) => {
    for (const u of urls) {
      const config: DownloadConfig = {
        url: u,
        format,
        quality,
        outputFolder: outputFolder || "",
        embedSubtitles: preferences?.embedSubtitles ?? false,
        cookiesFromBrowser: preferences?.cookiesFromBrowser ?? null,
        filenameTemplate: preferences?.filenameTemplate ?? null,
        proxyUrl: preferences?.proxyEnabled ? preferences?.proxyUrl : null,
        cookiesFilePath: preferences?.cookiesFilePath ?? null,
      };
      await addToQueue(config);
    }
    info(t("toast.urlsAdded", { count: urls.length }));
    openQueue();
  }, [format, quality, outputFolder, preferences, addToQueue, info, t, openQueue]);

  // Playlist download handler
  const handlePlaylistDownload = useCallback(async (entries: PlaylistEntry[], config: Omit<DownloadConfig, "url">) => {
    for (const entry of entries) {
      try {
        await addToQueue({ ...config, url: entry.url });
      } catch (err) {
        console.error(`Failed to add ${entry.title} to queue:`, err);
      }
    }
    setUrl("");
    clearMediaInfo();
    openQueue();
  }, [addToQueue, clearMediaInfo, openQueue, setUrl]);

  // Redownload handler
  const handleRedownload = useCallback((config: DownloadConfig) => {
    setUrl(config.url);
    handleFormatChange(config.format);
    handleQualityChange(config.quality);
    if (config.outputFolder) setOutputFolder(config.outputFolder);
  }, [handleFormatChange, handleQualityChange, setOutputFolder, setUrl]);

  // Batch import handler
  const handleBatchImport = useCallback(async (urls: string[]) => {
    for (const u of urls) {
      const config: DownloadConfig = {
        url: u,
        format,
        quality,
        outputFolder: outputFolder || "",
        embedSubtitles: preferences?.embedSubtitles ?? false,
        cookiesFromBrowser: preferences?.cookiesFromBrowser ?? null,
        filenameTemplate: preferences?.filenameTemplate ?? null,
        proxyUrl: preferences?.proxyEnabled ? preferences?.proxyUrl : null,
        cookiesFilePath: preferences?.cookiesFilePath ?? null,
      };
      await addToQueue(config);
    }
    info(t("toast.urlsAdded", { count: urls.length }));
    openQueue();
  }, [format, quality, outputFolder, preferences, addToQueue, info, t, openQueue]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPaste: handlePaste,
    onDownload: isIdle ? handleDownload : undefined,
    onCancel: isDownloading ? handleCancel : undefined,
    enabled: true,
  });

  // Update handler (opens settings then dismisses banner)
  const handleUpdateClick = useCallback(() => {
    openSettings();
    dismissUpdate();
  }, [openSettings, dismissUpdate]);

  return (
    <motion.main
      className="min-h-screen bg-background"
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={defaultTransition}
      role="main"
      aria-label="MediaGrab - Media Downloader"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('url-input')?.focus();
        }}
      >
        {t("a11y.skipToContent", "Skip to main content")}
      </a>

      {/* Global drag overlay */}
      <DragOverlay isVisible={isGlobalDragOver} />

      {/* Header */}
      <AppHeader
        activeCount={activeCount}
        pendingCount={pendingCount}
        updateAvailable={!!updateAvailable}
        onHistoryClick={openHistory}
        onQueueClick={openQueue}
        onSettingsClick={openSettings}
        t={t}
      />

      {/* Update available banner */}
      <UpdateBanner
        updateInfo={updateAvailable}
        onDismiss={dismissUpdate}
        onUpdate={handleUpdateClick}
      />

      {/* Main content */}
      <motion.div
        id="main-content"
        className="mx-auto max-w-3xl px-6 py-8"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <div className="space-y-6">
          <DownloadFormSection
            url={url}
            onUrlChange={handleUrlChange}
            format={format}
            onFormatChange={handleFormatChange}
            quality={quality}
            onQualityChange={handleQualityChange}
            outputFolder={outputFolder}
            onPickFolder={handlePickFolder}
            mediaInfo={mediaInfo}
            isLoadingMediaInfo={isLoadingMediaInfo}
            isPlaylist={isPlaylist}
            playlistInfo={playlistInfo}
            isLoadingPlaylist={isLoadingPlaylist}
            downloadState={downloadState}
            progress={progress}
            error={error}
            downloadedFilePath={downloadedFilePath}
            retryInfo={retryInfo}
            isDownloading={isDownloading}
            networkStatus={networkStatus}
            scheduledDownloadsCount={scheduledDownloads.length}
            onDownload={handleDownload}
            onCancel={handleCancel}
            onMultipleUrls={handleMultipleUrls}
            clearMediaInfo={clearMediaInfo}
          />
        </div>
      </motion.div>

      {/* Footer */}
      <AppFooter t={t} />

      {/* Panel Manager */}
      <PanelManager
        playlistInfo={playlistInfo}
        isLoadingPlaylist={isLoadingPlaylist}
        onPlaylistDownload={handlePlaylistDownload}
        format={format}
        quality={quality}
        outputFolder={outputFolder}
        onRedownload={handleRedownload}
        onBatchImport={handleBatchImport}
        scheduledDownloads={scheduledDownloads}
        onSchedule={addScheduledDownload}
        onRemoveScheduled={removeScheduledDownload}
        onToggleScheduled={toggleScheduledDownload}
      />
    </motion.main>
  );
}

export default App;
