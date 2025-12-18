import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Bell, ListOrdered } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { UrlInput } from "./components/UrlInput";
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
import { SettingsPanel } from "./components/SettingsPanel";
import { QueuePanel } from "./components/QueuePanel";
import { MissingExecutablesAlert } from "./components/MissingExecutablesAlert";
import { Button } from "./components/ui/button";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePreferences } from "./hooks/usePreferences";
import { useQueue } from "./hooks/useQueue";
import { validateUrl } from "./lib/validation";
import {
  fadeInVariants,
  containerVariants,
  itemVariants,
  buttonVariants,
  defaultTransition,
  springTransition,
} from "./lib/animations";
import type { DownloadState, Format, Quality, ProgressEvent, MediaInfo, FolderValidationResult, ExecutablesMissingEvent, DownloadConfig } from "./types";

function App() {
  // Form state
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("video-mp4");
  const [quality, setQuality] = useState<Quality>("best");
  const [outputFolder, setOutputFolder] = useState("");

  // Download state
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  
  // Media info state
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [isLoadingMediaInfo, setIsLoadingMediaInfo] = useState(false);

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const { 
    preferences, 
    setPreferences,
    setOutputFolder: saveOutputFolder,
    setFormat: saveFormat,
    setQuality: saveQuality,
  } = usePreferences();
  
  // Queue hook
  const { addToQueue, activeCount, pendingCount } = useQueue();
  
  // Track if preferences have been applied to form state
  const preferencesAppliedRef = useRef(false);
  
  // Debounce timeout ref for URL change
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Update notification state
  const [updateAvailable, setUpdateAvailable] = useState<{
    currentVersion: string;
    latestVersion: string | null;
  } | null>(null);
  
  // Missing executables state
  // **Validates: Requirements 6.1, 11.6**
  const [missingExecutables, setMissingExecutables] = useState<ExecutablesMissingEvent | null>(null);

  const isDownloading = downloadState === "downloading" || 
                        downloadState === "merging" || 
                        downloadState === "starting" ||
                        downloadState === "analyzing";
  const isIdle = downloadState === "idle" || 
                 downloadState === "completed" || 
                 downloadState === "cancelled" || 
                 downloadState === "failed";
  
  // Apply preferences to form state on load
  // **Validates: Requirements 9.3**
  useEffect(() => {
    if (preferences && !preferencesAppliedRef.current) {
      if (preferences.outputFolder) {
        setOutputFolder(preferences.outputFolder);
      }
      if (preferences.format) {
        setFormat(preferences.format);
      }
      if (preferences.quality) {
        setQuality(preferences.quality);
      }
      preferencesAppliedRef.current = true;
    }
  }, [preferences]);

  // Listen for download events from backend
  useEffect(() => {
    // State change event listener
    const unlistenStateChange = listen<{ state: DownloadState; filePath: string | null }>(
      "download-state-change",
      (event) => {
        setDownloadState(event.payload.state);
        if (event.payload.filePath) {
          setDownloadedFilePath(event.payload.filePath);
        }
      }
    );

    // Progress event listener
    const unlistenProgress = listen<ProgressEvent>(
      "download-progress",
      (event) => {
        setProgress(event.payload);
      }
    );

    // Error event listener
    const unlistenError = listen<string>(
      "download-error",
      (event) => {
        setError(event.payload);
      }
    );

    // Complete event listener
    const unlistenComplete = listen<{ success: boolean; filePath?: string; error?: string }>(
      "download-complete",
      (event) => {
        if (event.payload.filePath) {
          setDownloadedFilePath(event.payload.filePath);
        }
        if (event.payload.error) {
          setError(event.payload.error);
        }
      }
    );

    // Update available event listener
    const unlistenUpdateAvailable = listen<{ currentVersion: string; latestVersion: string | null }>(
      "ytdlp-update-available",
      (event) => {
        setUpdateAvailable(event.payload);
      }
    );

    // Missing executables event listener
    // **Validates: Requirements 6.1, 11.6**
    const unlistenExecutablesMissing = listen<ExecutablesMissingEvent>(
      "executables-missing",
      (event) => {
        setMissingExecutables(event.payload);
      }
    );

    // Cleanup listeners on unmount
    return () => {
      unlistenStateChange.then((unlisten) => unlisten());
      unlistenProgress.then((unlisten) => unlisten());
      unlistenError.then((unlisten) => unlisten());
      unlistenComplete.then((unlisten) => unlisten());
      unlistenUpdateAvailable.then((unlisten) => unlisten());
      unlistenExecutablesMissing.then((unlisten) => unlisten());
    };
  }, []);

  // Fetch media info when URL changes (with debounce)
  const fetchMediaInfo = useCallback(async (urlToFetch: string) => {
    const validation = validateUrl(urlToFetch);
    if (!validation.isValid) {
      setMediaInfo(null);
      return;
    }

    setIsLoadingMediaInfo(true);
    setError(null);
    
    try {
      const info = await invoke<MediaInfo>("fetch_media_info", { url: urlToFetch });
      setMediaInfo(info);
    } catch (err) {
      console.error("Failed to fetch media info:", err);
      // Don't show error for media info fetch - it's optional
      setMediaInfo(null);
    } finally {
      setIsLoadingMediaInfo(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    const validation = validateUrl(url);
    if (!validation.isValid) {
      return;
    }

    setError(null);
    setProgress(null);
    setDownloadedFilePath(null);
    
    // Determine output folder - use selected or default to Downloads
    const targetFolder = outputFolder || "";
    
    // Validate output folder if one is selected
    if (targetFolder) {
      try {
        const estimatedSize = mediaInfo?.filesizeApprox ?? undefined;
        const folderValidation = await invoke<FolderValidationResult>(
          "validate_folder_for_download",
          { 
            path: targetFolder, 
            estimatedSizeBytes: estimatedSize 
          }
        );
        
        if (!folderValidation.isAccessible) {
          setError("Cannot write to selected folder. Please choose a different location.");
          return;
        }
        
        if (folderValidation.warning) {
          // Show warning but allow user to continue
          console.warn("Folder validation warning:", folderValidation.warning);
          // For now, we'll show the warning as an error - in a future task we could add a confirmation dialog
          if (!folderValidation.diskSpace.hasEnoughSpace) {
            setError(`Warning: ${folderValidation.warning}. Download may fail.`);
            // Continue anyway - user can retry with different folder
          }
        }
      } catch (err) {
        console.error("Failed to validate folder:", err);
        setError("Failed to validate output folder");
        return;
      }
    }
    
    // If we don't have media info yet, fetch it first
    if (!mediaInfo && !isLoadingMediaInfo) {
      setDownloadState("analyzing");
      await fetchMediaInfo(url);
    }
    
    // Build download configuration
    // **Validates: Requirements 1.1, 2.1, 2.2, 2.3, 2.4, 12.1, 12.2, 13.1**
    const config: DownloadConfig = {
      url: url.trim(),
      format,
      quality,
      outputFolder: targetFolder,
      embedSubtitles: preferences?.embedSubtitles ?? false,
      cookiesFromBrowser: preferences?.cookiesFromBrowser ?? null,
    };
    
    try {
      // Start the download via Tauri command
      // State transitions are handled by event listeners
      await invoke("start_download", { config });
    } catch (err) {
      console.error("Failed to start download:", err);
      setError(err instanceof Error ? err.message : String(err));
      setDownloadState("failed");
    }
  }, [url, format, quality, outputFolder, mediaInfo, isLoadingMediaInfo, fetchMediaInfo, preferences]);

  const handleCancel = useCallback(async () => {
    if (downloadState === "cancelling") return;
    
    try {
      // Cancel the download via Tauri command
      // State transitions are handled by event listeners
      // **Validates: Requirements 1.4**
      await invoke("cancel_download");
    } catch (err) {
      console.error("Failed to cancel download:", err);
      // Even if cancel fails, try to reset state
      setDownloadState("cancelled");
    }
  }, [downloadState]);

  // Handle URL change with media info fetch (proper debounce with cleanup)
  const handleUrlChange = useCallback((newUrl: string) => {
    setUrl(newUrl);
    setMediaInfo(null);
    
    // Clear any existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    
    // Debounce media info fetch
    const trimmedUrl = newUrl.trim();
    if (trimmedUrl && validateUrl(trimmedUrl).isValid) {
      debounceTimeoutRef.current = setTimeout(() => {
        fetchMediaInfo(trimmedUrl);
        debounceTimeoutRef.current = null;
      }, 500);
    }
  }, [fetchMediaInfo]);
  
  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const trimmedText = text.trim();
        setUrl(trimmedText);
        setMediaInfo(null);
        // Immediately fetch media info on paste
        if (validateUrl(trimmedText).isValid) {
          fetchMediaInfo(trimmedText);
        }
      }
    } catch {
      // Clipboard access denied
    }
  }, [fetchMediaInfo]);

  // Handle format change with preference persistence
  // **Validates: Requirements 9.2**
  const handleFormatChange = useCallback((newFormat: Format) => {
    setFormat(newFormat);
    saveFormat(newFormat);
  }, [saveFormat]);

  // Handle quality change with preference persistence
  // **Validates: Requirements 9.2**
  const handleQualityChange = useCallback((newQuality: Quality) => {
    setQuality(newQuality);
    saveQuality(newQuality);
  }, [saveQuality]);

  const handlePickFolder = useCallback(async () => {
    try {
      const folder = await invoke<string | null>("pick_folder");
      if (folder) {
        setOutputFolder(folder);
        // Persist folder selection
        // **Validates: Requirements 9.1**
        saveOutputFolder(folder);
      }
    } catch (err) {
      console.error("Failed to pick folder:", err);
      setError("Failed to open folder picker");
    }
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPaste: handlePaste,
    onDownload: isIdle ? handleDownload : undefined,
    onCancel: isDownloading ? handleCancel : undefined,
    enabled: true,
  });

  // Handle copying debug info for missing executables alert
  const handleCopyDebugInfo = useCallback(async () => {
    try {
      await invoke("copy_debug_info");
    } catch (err) {
      console.error("Failed to copy debug info:", err);
    }
  }, []);

  return (
    <motion.main
      className="min-h-screen bg-background"
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={defaultTransition}
      role="main"
      aria-label="MediaGrab - Media Downloader"
    >
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm" role="banner">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">MediaGrab</h1>
          <nav className="flex items-center gap-2" aria-label="Application controls">
            <ThemeToggle />
            {/* Queue button */}
            <motion.div
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              transition={springTransition}
              className="relative"
            >
              <Button 
                variant="ghost" 
                size="icon" 
                title="Download Queue"
                aria-label="Open download queue"
                aria-haspopup="dialog"
                onClick={() => setIsQueueOpen(true)}
              >
                <ListOrdered className="h-4 w-4" aria-hidden="true" />
              </Button>
              {/* Active downloads indicator */}
              {(activeCount > 0 || pendingCount > 0) && (
                <span 
                  className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground" 
                  aria-label={`${activeCount + pendingCount} downloads in queue`}
                  role="status"
                >
                  {activeCount + pendingCount}
                </span>
              )}
            </motion.div>
            {/* Settings button */}
            <motion.div
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              transition={springTransition}
              className="relative"
            >
              <Button 
                variant="ghost" 
                size="icon" 
                title="Settings"
                aria-label="Open settings"
                aria-haspopup="dialog"
                onClick={() => setIsSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
              </Button>
              {/* Update available indicator */}
              {updateAvailable && (
                <span 
                  className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" 
                  aria-label="Update available"
                  role="status"
                />
              )}
            </motion.div>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <motion.div
        className="mx-auto max-w-3xl px-6 py-8"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        <div className="space-y-6">
          {/* URL Input */}
          <motion.div variants={itemVariants}>
            <label 
              htmlFor="url-input"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Video URL
            </label>
            <UrlInput
              id="url-input"
              value={url}
              onChange={handleUrlChange}
              onSubmit={handleDownload}
              disabled={isDownloading}
              {...(error ? { "aria-describedby": "url-error" } : {})}
            />
          </motion.div>

          {/* Media Info Preview */}
          {(mediaInfo || isLoadingMediaInfo) && (
            <motion.div variants={itemVariants}>
              <MediaInfoPreview 
                mediaInfo={mediaInfo} 
                isLoading={isLoadingMediaInfo} 
              />
            </motion.div>
          )}

          {/* Format and Quality selectors */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4" role="group" aria-label="Download options">
            <div>
              <label 
                htmlFor="format-selector"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Format
              </label>
              <FormatSelector
                id="format-selector"
                value={format}
                onChange={handleFormatChange}
                disabled={isDownloading}
              />
            </div>
            <div>
              <label 
                htmlFor="quality-selector"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Quality
              </label>
              <QualitySelector
                id="quality-selector"
                value={quality}
                onChange={handleQualityChange}
                disabled={isDownloading}
              />
            </div>
          </motion.div>

          {/* Folder picker */}
          <motion.div variants={itemVariants}>
            <label 
              htmlFor="folder-picker"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Save to
            </label>
            <FolderPicker
              id="folder-picker"
              value={outputFolder}
              onPick={handlePickFolder}
              disabled={isDownloading}
            />
          </motion.div>

          {/* Action buttons */}
          <motion.div variants={itemVariants} className="flex items-center gap-3" role="group" aria-label="Download actions">
            <DownloadButton
              onClick={handleDownload}
              state={downloadState}
              disabled={!validateUrl(url).isValid}
            />
            <Button
              variant="outline"
              onClick={async () => {
                const validation = validateUrl(url);
                if (!validation.isValid) return;
                
                const config: DownloadConfig = {
                  url: url.trim(),
                  format,
                  quality,
                  outputFolder: outputFolder || "",
                  embedSubtitles: preferences?.embedSubtitles ?? false,
                  cookiesFromBrowser: preferences?.cookiesFromBrowser ?? null,
                };
                
                await addToQueue(config);
                setUrl("");
                setMediaInfo(null);
              }}
              disabled={!validateUrl(url).isValid || isDownloading}
              aria-label="Add to download queue"
            >
              <ListOrdered className="mr-2 h-4 w-4" aria-hidden="true" />
              Add to Queue
            </Button>
            <CancelButton onClick={handleCancel} state={downloadState} />
          </motion.div>

          {/* Progress bar (visible during download) */}
          {/* **Validates: Requirements 4.1, 5.3** */}
          <AnimatePresence>
            {(downloadState === "downloading" || downloadState === "merging") && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <ProgressBar progress={progress} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status display */}
          {/* **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 6.2, 6.3** */}
          <motion.div variants={itemVariants}>
            <StatusDisplay 
              state={downloadState} 
              error={error}
              cookiesEnabled={!!preferences?.cookiesFromBrowser}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onRetry={handleDownload}
            />
          </motion.div>

          {/* Completion buttons - show after successful download */}
          {/* **Validates: Requirements 4.3, 5.3** */}
          <AnimatePresence>
            {downloadState === "completed" && (
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-center gap-3"
              >
                {downloadedFilePath && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.2 }}
                  >
                    <PlayButton filePath={downloadedFilePath} />
                  </motion.div>
                )}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.2 }}
                >
                  <OpenFolderButton 
                    folderPath={outputFolder || downloadedFilePath?.substring(0, downloadedFilePath.lastIndexOf('\\')) || ''} 
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Update available banner */}
      {updateAvailable && (
        <motion.div
          className="fixed top-16 left-0 right-0 z-30"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
        >
          <div className="mx-auto max-w-3xl px-6">
            <div className="flex items-center justify-between gap-4 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-primary" />
                <span>
                  yt-dlp update available
                  {updateAvailable.latestVersion && ` (${updateAvailable.latestVersion})`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setUpdateAvailable(null)}
                >
                  Dismiss
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    setIsSettingsOpen(true);
                    setUpdateAvailable(null);
                  }}
                >
                  Update
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Footer with keyboard shortcuts hint */}
      <footer 
        className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/50 backdrop-blur-sm"
        role="contentinfo"
        aria-label="Keyboard shortcuts"
      >
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-6 px-6 py-2 text-xs text-muted-foreground">
          <span><kbd className="rounded bg-muted px-1.5 py-0.5" aria-label="Control plus V">Ctrl+V</kbd> Paste</span>
          <span><kbd className="rounded bg-muted px-1.5 py-0.5" aria-label="Enter key">Enter</kbd> Download</span>
          <span><kbd className="rounded bg-muted px-1.5 py-0.5" aria-label="Escape key">Esc</kbd> Cancel</span>
        </div>
      </footer>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onPreferencesChange={setPreferences}
      />

      {/* Queue Panel */}
      <QueuePanel
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
      />

      {/* Missing Executables Alert */}
      {/* **Validates: Requirements 6.1, 11.6** */}
      <MissingExecutablesAlert
        missingInfo={missingExecutables}
        onDismiss={() => setMissingExecutables(null)}
        onCopyDebugInfo={handleCopyDebugInfo}
      />
    </motion.main>
  );
}

export default App;
