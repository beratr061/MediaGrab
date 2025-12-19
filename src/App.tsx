import { useState, useCallback, useEffect, useRef, memo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Bell, ListOrdered, History, ListVideo, FileText, Clock, Upload } from "lucide-react";
import { invoke } from "./lib/tauri";
// Note: Notification support requires @tauri-apps/plugin-notification to be installed
// import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { useTranslation } from "react-i18next";
import { UrlInput, saveRecentUrl } from "./components/UrlInput";
import { FormatSelector } from "./components/FormatSelector";
import { QualitySelector } from "./components/QualitySelector";
import { FolderPicker } from "./components/FolderPicker";
import { DownloadButton } from "./components/DownloadButton";
import { CancelButton } from "./components/CancelButton";
import { ProgressBar } from "./components/ProgressBar";
import { StatusDisplay } from "./components/StatusDisplay";
import { MediaInfoPreview } from "./components/MediaInfoPreview";
import { ThemeToggle } from "./components/ThemeToggle";
import { OpenFolderButton } from "./components/OpenFolderButton";
import { PlayButton } from "./components/PlayButton";
import { EmptyState } from "./components/EmptyState";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { useToast } from "./components/Toast";
import { Button } from "./components/ui/button";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePreferences } from "./hooks/usePreferences";
import { useQueue } from "./hooks/useQueue";
import { useHistory } from "./hooks/useHistory";
import { useDownload } from "./hooks/useDownload";
import { useMediaInfo } from "./hooks/useMediaInfo";
import { usePanels } from "./hooks/usePanels";
import { useUpdateNotification } from "./hooks/useUpdateNotification";
import { useExecutables } from "./hooks/useExecutables";
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { validateUrl, sanitizeUrl } from "./lib/validation";
import {
  fadeInVariants,
  containerVariants,
  itemVariants,
  buttonVariants,
  defaultTransition,
  springTransition,
} from "./lib/animations";
import type { Format, Quality, DownloadConfig, PlaylistEntry, ScheduledDownload } from "./types";

// Lazy loaded components for code splitting
const SettingsPanel = lazy(() => import("./components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));
const QueuePanel = lazy(() => import("./components/QueuePanel").then(m => ({ default: m.QueuePanel })));
const HistoryPanel = lazy(() => import("./components/HistoryPanel").then(m => ({ default: m.HistoryPanel })));
const PlaylistPanel = lazy(() => import("./components/PlaylistPanel").then(m => ({ default: m.PlaylistPanel })));
const MissingExecutablesAlert = lazy(() => import("./components/MissingExecutablesAlert").then(m => ({ default: m.MissingExecutablesAlert })));
const OnboardingTour = lazy(() => import("./components/OnboardingTour").then(m => ({ default: m.OnboardingTour })));
const BatchUrlImport = lazy(() => import("./components/BatchUrlImport").then(m => ({ default: m.BatchUrlImport })));
const ScheduleDownload = lazy(() => import("./components/ScheduleDownload").then(m => ({ default: m.ScheduleDownload })));

// Loading fallback for lazy components
function PanelFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

// Memoized header component
const Header = memo(function Header({
  activeCount,
  pendingCount,
  updateAvailable,
  onHistoryClick,
  onQueueClick,
  onSettingsClick,
  t,
}: {
  activeCount: number;
  pendingCount: number;
  updateAvailable: boolean;
  onHistoryClick: () => void;
  onQueueClick: () => void;
  onSettingsClick: () => void;
  t: (key: string) => string;
}) {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm" role="banner">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">{t("app.title")}</h1>
        <nav className="flex items-center gap-2" aria-label="Application controls">
          <ThemeToggle />
          <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap" transition={springTransition}>
            <Button variant="ghost" size="icon" title={t("header.history")} onClick={onHistoryClick}>
              <History className="h-4 w-4" aria-hidden="true" />
            </Button>
          </motion.div>
          <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap" transition={springTransition} className="relative">
            <Button variant="ghost" size="icon" title={t("header.queue")} onClick={onQueueClick}>
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
            </Button>
            {(activeCount > 0 || pendingCount > 0) && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {activeCount + pendingCount}
              </span>
            )}
          </motion.div>
          <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap" transition={springTransition} className="relative">
            <Button variant="ghost" size="icon" title={t("header.settings")} onClick={onSettingsClick}>
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
            {updateAvailable && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" />}
          </motion.div>
        </nav>
      </div>
    </header>
  );
});

// Memoized footer component
const Footer = memo(function Footer({ t }: { t: (key: string) => string }) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/50 backdrop-blur-sm" role="contentinfo">
      <div className="mx-auto flex max-w-3xl items-center justify-center gap-6 px-6 py-2 text-xs text-muted-foreground">
        <span><kbd className="rounded bg-muted px-1.5 py-0.5">Ctrl+V</kbd> {t("shortcuts.paste")}</span>
        <span><kbd className="rounded bg-muted px-1.5 py-0.5">Enter</kbd> {t("shortcuts.download")}</span>
        <span><kbd className="rounded bg-muted px-1.5 py-0.5">Esc</kbd> {t("shortcuts.cancel")}</span>
      </div>
    </footer>
  );
});

function App() {
  const { t } = useTranslation();
  const { success, info } = useToast();
  
  // Form state
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("video-mp4");
  const [quality, setQuality] = useState<Quality>("best");
  const [outputFolder, setOutputFolder] = useState("");

  // Global drag & drop state
  const [isGlobalDragOver, setIsGlobalDragOver] = useState(false);
  
  // Batch import & schedule modals
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduledDownloads, setScheduledDownloads] = useState<ScheduledDownload[]>([]);

  // Preferences
  const { preferences, setPreferences, setOutputFolder: saveOutputFolder, setFormat: saveFormat, setQuality: saveQuality } = usePreferences();
  
  // Queue & History
  const { addToQueue, activeCount, pendingCount } = useQueue();
  const { addToHistory } = useHistory();
  
  // Note: Notification support can be added with @tauri-apps/plugin-notification
  // useEffect(() => {
  //   (async () => {
  //     const permitted = await isPermissionGranted();
  //     if (!permitted) {
  //       await requestPermission();
  //     }
  //   })();
  // }, []);
  
  // Media info & playlist
  const { mediaInfo, isLoadingMediaInfo, isPlaylist, playlistInfo, isLoadingPlaylist, fetchMediaInfo, handleUrlChange: onUrlChange, handlePaste: onPaste, clearMediaInfo } = useMediaInfo();
  
  // Network status (must be before useDownload to pass isOffline)
  const networkStatus = useNetworkStatus();

  // Show toast when coming back online
  const wasOfflineRef = useRef(!networkStatus.isOnline || !networkStatus.isConnected);
  useEffect(() => {
    const isCurrentlyOffline = !networkStatus.isOnline || !networkStatus.isConnected;
    if (wasOfflineRef.current && !isCurrentlyOffline) {
      // Just came back online
      success(t("network.reconnected"));
    }
    wasOfflineRef.current = isCurrentlyOffline;
  }, [networkStatus.isOnline, networkStatus.isConnected, success, t]);

  // Load scheduled downloads from preferences
  useEffect(() => {
    if (preferences?.scheduledDownloads) {
      setScheduledDownloads(preferences.scheduledDownloads);
    }
  }, [preferences?.scheduledDownloads]);

  // Check scheduled downloads every minute
  useEffect(() => {
    const checkScheduled = () => {
      const now = Date.now();
      scheduledDownloads.forEach(async (download) => {
        if (download.enabled && download.scheduledTime <= now) {
          // Time to start this download
          const config: DownloadConfig = {
            url: download.url,
            format: download.format,
            quality: download.quality,
            outputFolder: outputFolder || "",
            embedSubtitles: preferences?.embedSubtitles ?? false,
            cookiesFromBrowser: preferences?.cookiesFromBrowser ?? null,
            filenameTemplate: preferences?.filenameTemplate ?? null,
            proxyUrl: preferences?.proxyEnabled ? preferences?.proxyUrl : null,
            cookiesFilePath: preferences?.cookiesFilePath ?? null,
          };
          await addToQueue(config);
          // Remove from scheduled
          handleRemoveScheduled(download.id);
          info(t("schedule.started", "Scheduled download started"));
        }
      });
    };

    const interval = setInterval(checkScheduled, 60000); // Check every minute
    checkScheduled(); // Check immediately on mount
    return () => clearInterval(interval);
  }, [scheduledDownloads, outputFolder, preferences, addToQueue, info, t]);

  // Download state
  const { downloadState, progress, error, downloadedFilePath, retryInfo, isDownloading, isIdle, handleDownload, handleCancel, setError } = useDownload({
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
  const { isSettingsOpen, isQueueOpen, isHistoryOpen, isPlaylistOpen, openSettings, closeSettings, openQueue, closeQueue, openHistory, closeHistory, openPlaylist, closePlaylist } = usePanels();
  
  // Update notification
  const { updateAvailable, dismissUpdate } = useUpdateNotification();
  
  // Executables
  const { missingExecutables, dismissMissingExecutables, copyDebugInfo } = useExecutables();

  // Track if preferences have been applied
  const preferencesAppliedRef = useRef(false);

  // Apply preferences to form state on load
  useEffect(() => {
    if (preferences && !preferencesAppliedRef.current) {
      if (preferences.outputFolder) setOutputFolder(preferences.outputFolder);
      if (preferences.format) setFormat(preferences.format);
      if (preferences.quality) setQuality(preferences.quality);
      preferencesAppliedRef.current = true;
    }
  }, [preferences]);

  // Handlers
  const handleUrlChange = useCallback((newUrl: string) => onUrlChange(newUrl, setUrl), [onUrlChange]);
  const handlePaste = useCallback(() => onPaste(setUrl), [onPaste]);
  
  const handleFormatChange = useCallback((newFormat: Format) => {
    setFormat(newFormat);
    saveFormat(newFormat);
  }, [saveFormat]);

  const handleQualityChange = useCallback((newQuality: Quality) => {
    setQuality(newQuality);
    saveQuality(newQuality);
  }, [saveQuality]);

  const handlePickFolder = useCallback(async () => {
    try {
      const folder = await invoke<string | null>("pick_folder");
      if (folder) {
        setOutputFolder(folder);
        saveOutputFolder(folder);
      }
    } catch (err) {
      console.error("Failed to pick folder:", err);
      setError("Failed to open folder picker");
    }
  }, [saveOutputFolder, setError]);

  const handleAddToQueue = useCallback(async () => {
    const validation = validateUrl(url);
    if (!validation.isValid || !validation.sanitizedUrl) return;

    const sanitizedUrl = validation.sanitizedUrl;
    const config: DownloadConfig = {
      url: sanitizedUrl,
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
    saveRecentUrl(sanitizedUrl);
    success(t("toast.addedToQueue"));
    setUrl("");
    clearMediaInfo();
  }, [url, format, quality, outputFolder, preferences, addToQueue, clearMediaInfo, success, t]);

  // Handle multiple URLs pasted at once (already sanitized by UrlInput)
  const handleMultipleUrls = useCallback(
    async (urls: string[]) => {
      for (const u of urls) {
        const config: DownloadConfig = {
          url: u, // Already sanitized
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
    },
    [format, quality, outputFolder, preferences, addToQueue, info, t, openQueue]
  );

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
  }, [addToQueue, clearMediaInfo, openQueue]);

  const handleRedownload = useCallback((config: DownloadConfig) => {
    setUrl(config.url);
    setFormat(config.format);
    setQuality(config.quality);
    if (config.outputFolder) setOutputFolder(config.outputFolder);
  }, []);

  // Global drag & drop handlers
  const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isDownloading) {
      setIsGlobalDragOver(true);
    }
  }, [isDownloading]);

  const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only hide if leaving the window
    if (e.relatedTarget === null) {
      setIsGlobalDragOver(false);
    }
  }, []);

  const handleGlobalDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsGlobalDragOver(false);
    if (isDownloading) return;

    // Handle dropped text (URL)
    const text = e.dataTransfer.getData("text/plain");
    if (text) {
      const sanitized = sanitizeUrl(text);
      const validation = validateUrl(sanitized);
      if (validation.isValid && validation.sanitizedUrl) {
        setUrl(validation.sanitizedUrl);
        return;
      }
    }

    // Handle dropped file (.txt with URLs)
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/plain" || file.name.endsWith(".txt"))) {
      file.text().then((content) => {
        const lines = content.split("\n").filter(line => line.trim().length > 0);
        if (lines.length === 1 && lines[0]) {
          const validation = validateUrl(lines[0]);
          if (validation.isValid && validation.sanitizedUrl) {
            setUrl(validation.sanitizedUrl);
          }
        } else if (lines.length > 1) {
          // Multiple URLs - open batch import
          setIsBatchImportOpen(true);
        }
      });
    }
  }, [isDownloading]);

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

  // Schedule handlers
  const handleScheduleDownload = useCallback((download: Omit<ScheduledDownload, "id">) => {
    const newDownload: ScheduledDownload = {
      ...download,
      id: crypto.randomUUID(),
    };
    const updated = [...scheduledDownloads, newDownload];
    setScheduledDownloads(updated);
    if (preferences) {
      setPreferences({ ...preferences, scheduledDownloads: updated });
    }
    success(t("schedule.added", "Download scheduled"));
  }, [scheduledDownloads, preferences, setPreferences, success, t]);

  const handleRemoveScheduled = useCallback((id: string) => {
    const updated = scheduledDownloads.filter(d => d.id !== id);
    setScheduledDownloads(updated);
    if (preferences) {
      setPreferences({ ...preferences, scheduledDownloads: updated });
    }
  }, [scheduledDownloads, preferences, setPreferences]);

  const handleToggleScheduled = useCallback((id: string) => {
    const updated = scheduledDownloads.map(d => 
      d.id === id ? { ...d, enabled: !d.enabled } : d
    );
    setScheduledDownloads(updated);
    if (preferences) {
      setPreferences({ ...preferences, scheduledDownloads: updated });
    }
  }, [scheduledDownloads, preferences, setPreferences]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPaste: handlePaste,
    onDownload: isIdle ? handleDownload : undefined,
    onCancel: isDownloading ? handleCancel : undefined,
    enabled: true,
  });

  return (
    <motion.main
      className="min-h-screen bg-background"
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={defaultTransition}
      role="main"
      aria-label="MediaGrab - Media Downloader"
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
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
      <AnimatePresence>
        {isGlobalDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="drag-overlay"
            role="presentation"
            aria-hidden="true"
          >
            <div className="drag-overlay-content">
              <Upload className="h-12 w-12 text-primary" aria-hidden="true" />
              <p className="text-lg font-medium">{t("dragDrop.dropUrl", "Drop URL or .txt file here")}</p>
              <p className="text-sm text-muted-foreground">{t("dragDrop.hint", "Drop a video URL or a text file with multiple URLs")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Header
        activeCount={activeCount}
        pendingCount={pendingCount}
        updateAvailable={!!updateAvailable}
        onHistoryClick={openHistory}
        onQueueClick={openQueue}
        onSettingsClick={openSettings}
        t={t}
      />

      <motion.div id="main-content" className="mx-auto max-w-3xl px-6 py-8" variants={containerVariants} initial="initial" animate="animate">
        <div className="space-y-6">
          {/* URL Input */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="url-input" className="block text-sm font-medium text-foreground">{t("form.videoUrl")}</label>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setIsBatchImportOpen(true)} title={t("batch.title", "Batch Import")}>
                  <FileText className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsScheduleOpen(true)} title={t("schedule.title", "Schedule")}>
                  <Clock className="h-4 w-4" />
                  {scheduledDownloads.length > 0 && (
                    <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">{scheduledDownloads.length}</span>
                  )}
                </Button>
              </div>
            </div>
            <UrlInput id="url-input" value={url} onChange={handleUrlChange} onSubmit={handleDownload} onMultipleUrls={handleMultipleUrls} disabled={isDownloading} />
          </motion.div>
          
          {/* Network Status Banner */}
          {(!networkStatus.isOnline || !networkStatus.isConnected || networkStatus.isDegraded) && (
            <motion.div variants={itemVariants}>
              <NetworkStatusBanner
                status={networkStatus}
                isDegraded={networkStatus.isDegraded}
                onRetryConnection={networkStatus.checkConnectivity}
              />
            </motion.div>
          )}

          {/* Empty State when no URL */}
          {!url && !mediaInfo && !isLoadingMediaInfo && !isPlaylist && (
            <motion.div variants={itemVariants}>
              <EmptyState />
            </motion.div>
          )}

          {/* Media Info Preview */}
          {(mediaInfo || isLoadingMediaInfo) && !isPlaylist && (
            <motion.div variants={itemVariants}>
              <MediaInfoPreview mediaInfo={mediaInfo} isLoading={isLoadingMediaInfo} />
            </motion.div>
          )}

          {/* Playlist Detected Banner */}
          {isPlaylist && (
            <motion.div variants={itemVariants} className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ListVideo className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{t("playlist.detected")}</p>
                    {playlistInfo && <p className="text-sm text-muted-foreground">{playlistInfo.title} • {t("playlist.videoCount", { count: playlistInfo.videoCount })}</p>}
                    {isLoadingPlaylist && <p className="text-sm text-muted-foreground">{t("playlist.loading")}</p>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={openPlaylist} disabled={isLoadingPlaylist || !playlistInfo}>
                  <ListVideo className="mr-2 h-4 w-4" />{t("buttons.showVideos")}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Format and Quality selectors */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="format-selector" className="mb-2 block text-sm font-medium text-foreground">{t("form.format")}</label>
              <FormatSelector id="format-selector" value={format} onChange={handleFormatChange} disabled={isDownloading} />
            </div>
            <div>
              <label htmlFor="quality-selector" className="mb-2 block text-sm font-medium text-foreground">{t("form.quality")}</label>
              <QualitySelector id="quality-selector" value={quality} onChange={handleQualityChange} disabled={isDownloading} duration={mediaInfo?.duration} />
            </div>
          </motion.div>

          {/* Folder picker */}
          <motion.div variants={itemVariants}>
            <label htmlFor="folder-picker" className="mb-2 block text-sm font-medium text-foreground">{t("form.saveTo")}</label>
            <FolderPicker id="folder-picker" value={outputFolder} onPick={handlePickFolder} disabled={isDownloading} />
          </motion.div>

          {/* Action buttons */}
          <motion.div variants={itemVariants} className="flex items-center gap-3">
            <DownloadButton onClick={handleDownload} state={downloadState} disabled={!validateUrl(url).isValid} />
            <Button variant="outline" onClick={handleAddToQueue} disabled={!validateUrl(url).isValid || isDownloading}>
              <ListOrdered className="mr-2 h-4 w-4" />{t("buttons.addToQueue")}
            </Button>
            <CancelButton onClick={handleCancel} state={downloadState} />
          </motion.div>

          {/* Progress bar */}
          <AnimatePresence>
            {(downloadState === "downloading" || downloadState === "merging") && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                <ProgressBar progress={progress} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status display */}
          <motion.div variants={itemVariants}>
            <StatusDisplay 
              state={downloadState} 
              error={error} 
              cookiesEnabled={!!preferences?.cookiesFromBrowser} 
              onOpenSettings={openSettings} 
              onRetry={handleDownload} 
              retryInfo={retryInfo}
              isOffline={!networkStatus.isOnline || !networkStatus.isConnected}
            />
          </motion.div>

          {/* Completion buttons */}
          <AnimatePresence>
            {downloadState === "completed" && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center gap-3">
                {downloadedFilePath && <PlayButton filePath={downloadedFilePath} />}
                <OpenFolderButton folderPath={outputFolder || downloadedFilePath?.substring(0, downloadedFilePath.lastIndexOf("\\")) || ""} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Update available banner */}
      {updateAvailable && (
        <motion.div className="fixed top-16 left-0 right-0 z-30" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="mx-auto max-w-3xl px-6">
            <div className="flex items-center justify-between gap-4 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-primary" />
                <span>{t("update.available")}{updateAvailable.latestVersion && ` ${t("update.version", { version: updateAvailable.latestVersion })}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={dismissUpdate}>{t("buttons.dismiss")}</Button>
                <Button size="sm" onClick={() => { openSettings(); dismissUpdate(); }}>{t("buttons.update")}</Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <Footer t={t} />

      {/* Lazy loaded panels with Suspense */}
      <Suspense fallback={<PanelFallback />}>
        {isSettingsOpen && <SettingsPanel isOpen={isSettingsOpen} onClose={closeSettings} preferences={preferences} onPreferencesChange={setPreferences} />}
        {isQueueOpen && <QueuePanel isOpen={isQueueOpen} onClose={closeQueue} />}
        {isHistoryOpen && <HistoryPanel isOpen={isHistoryOpen} onClose={closeHistory} onRedownload={handleRedownload} />}
        {isPlaylistOpen && (
          <PlaylistPanel
            isOpen={isPlaylistOpen}
            onClose={closePlaylist}
            playlistInfo={playlistInfo}
            isLoading={isLoadingPlaylist}
            onDownloadSelected={handlePlaylistDownload}
            format={format}
            quality={quality}
            outputFolder={outputFolder}
            embedSubtitles={preferences?.embedSubtitles ?? false}
            cookiesFromBrowser={preferences?.cookiesFromBrowser ?? null}
          />
        )}
        {isBatchImportOpen && (
          <BatchUrlImport
            isOpen={isBatchImportOpen}
            onClose={() => setIsBatchImportOpen(false)}
            onImport={handleBatchImport}
          />
        )}
        {isScheduleOpen && (
          <ScheduleDownload
            isOpen={isScheduleOpen}
            onClose={() => setIsScheduleOpen(false)}
            scheduledDownloads={scheduledDownloads}
            onSchedule={handleScheduleDownload}
            onRemove={handleRemoveScheduled}
            onToggle={handleToggleScheduled}
            currentFormat={format}
            currentQuality={quality}
          />
        )}
        {missingExecutables && <MissingExecutablesAlert missingInfo={missingExecutables} onDismiss={dismissMissingExecutables} onCopyDebugInfo={copyDebugInfo} />}
        <OnboardingTour />
      </Suspense>
    </motion.main>
  );
}

export default App;
