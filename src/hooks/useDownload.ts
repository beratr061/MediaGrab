/**
 * useDownload hook - Manages download state and operations
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { validateUrl } from "@/lib/validation";
import type {
  DownloadState,
  Format,
  Quality,
  ProgressEvent,
  MediaInfo,
  FolderValidationResult,
  DownloadConfig,
  RetryEvent,
  Preferences,
} from "@/types";

interface UseDownloadOptions {
  url: string;
  format: Format;
  quality: Quality;
  outputFolder: string;
  mediaInfo: MediaInfo | null;
  isLoadingMediaInfo: boolean;
  preferences: Preferences | null;
  fetchMediaInfo: (url: string) => Promise<void>;
  addToHistory: (
    config: DownloadConfig,
    title: string,
    thumbnail: string | null,
    filePath: string | null,
    fileSize: number | null,
    duration: number | null,
    status: "completed" | "failed",
    error: string | null
  ) => Promise<unknown>;
}

interface UseDownloadReturn {
  downloadState: DownloadState;
  progress: ProgressEvent | null;
  error: string | null;
  downloadedFilePath: string | null;
  retryInfo: RetryEvent | null;
  isDownloading: boolean;
  isIdle: boolean;
  handleDownload: () => Promise<void>;
  handleCancel: () => Promise<void>;
  setError: (error: string | null) => void;
  setDownloadState: (state: DownloadState) => void;
}

export function useDownload({
  url,
  format,
  quality,
  outputFolder,
  mediaInfo,
  isLoadingMediaInfo,
  preferences,
  fetchMediaInfo,
  addToHistory,
}: UseDownloadOptions): UseDownloadReturn {
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState<RetryEvent | null>(null);

  // Refs to capture current values for event listeners
  const urlRef = useRef(url);
  const formatRef = useRef(format);
  const qualityRef = useRef(quality);
  const outputFolderRef = useRef(outputFolder);
  const mediaInfoRef = useRef(mediaInfo);
  const preferencesRef = useRef(preferences);

  // Update refs when values change
  useEffect(() => {
    urlRef.current = url;
    formatRef.current = format;
    qualityRef.current = quality;
    outputFolderRef.current = outputFolder;
    mediaInfoRef.current = mediaInfo;
    preferencesRef.current = preferences;
  }, [url, format, quality, outputFolder, mediaInfo, preferences]);

  const isDownloading =
    downloadState === "downloading" ||
    downloadState === "merging" ||
    downloadState === "starting" ||
    downloadState === "analyzing";

  const isIdle =
    downloadState === "idle" ||
    downloadState === "completed" ||
    downloadState === "cancelled" ||
    downloadState === "failed";

  // Listen for download events from backend
  useEffect(() => {
    const unlistenStateChange = listen<{ state: DownloadState; filePath: string | null }>(
      "download-state-change",
      (event) => {
        setDownloadState(event.payload.state);
        if (event.payload.filePath) {
          setDownloadedFilePath(event.payload.filePath);
        }
      }
    );

    const unlistenProgress = listen<ProgressEvent>("download-progress", (event) => {
      setProgress(event.payload);
    });

    const unlistenError = listen<string>("download-error", (event) => {
      setError(event.payload);
    });

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

    // History tracking for completed downloads
    const unlistenHistoryComplete = listen<{ success: boolean; filePath?: string; error?: string }>(
      "download-complete",
      async (event) => {
        const currentUrl = urlRef.current;
        const currentFormat = formatRef.current;
        const currentQuality = qualityRef.current;
        const currentOutputFolder = outputFolderRef.current;
        const currentMediaInfo = mediaInfoRef.current;
        const currentPreferences = preferencesRef.current;

        if (currentUrl) {
          try {
            await addToHistory(
              {
                url: currentUrl,
                format: currentFormat,
                quality: currentQuality,
                outputFolder: currentOutputFolder || "",
                embedSubtitles: currentPreferences?.embedSubtitles ?? false,
                cookiesFromBrowser: currentPreferences?.cookiesFromBrowser ?? null,
              },
              currentMediaInfo?.title || "Unknown",
              currentMediaInfo?.thumbnail || null,
              event.payload.filePath || null,
              currentMediaInfo?.filesizeApprox || null,
              currentMediaInfo?.duration || null,
              event.payload.success ? "completed" : "failed",
              event.payload.error || null
            );
          } catch (err) {
            console.error("Failed to add to history:", err);
          }
        }
      }
    );

    const unlistenRetry = listen<RetryEvent>("download-retry", (event) => {
      setRetryInfo(event.payload);
    });

    return () => {
      unlistenStateChange.then((unlisten) => unlisten());
      unlistenProgress.then((unlisten) => unlisten());
      unlistenError.then((unlisten) => unlisten());
      unlistenComplete.then((unlisten) => unlisten());
      unlistenHistoryComplete.then((unlisten) => unlisten());
      unlistenRetry.then((unlisten) => unlisten());
    };
  }, [addToHistory]);

  const handleDownload = useCallback(async () => {
    const validation = validateUrl(url);
    if (!validation.isValid) {
      return;
    }

    setError(null);
    setProgress(null);
    setDownloadedFilePath(null);
    setRetryInfo(null);

    // Reset backend download state if in terminal state (completed, failed, cancelled)
    if (downloadState === "completed" || downloadState === "failed" || downloadState === "cancelled") {
      try {
        await invoke("reset_download");
      } catch (err) {
        console.error("Failed to reset download state:", err);
      }
    }

    const targetFolder = outputFolder || "";

    // Validate output folder if one is selected
    if (targetFolder) {
      try {
        const estimatedSize = mediaInfo?.filesizeApprox ?? undefined;
        const folderValidation = await invoke<FolderValidationResult>(
          "validate_folder_for_download",
          {
            path: targetFolder,
            estimatedSizeBytes: estimatedSize,
          }
        );

        if (!folderValidation.isAccessible) {
          setError("Cannot write to selected folder. Please choose a different location.");
          return;
        }

        if (folderValidation.warning) {
          console.warn("Folder validation warning:", folderValidation.warning);
          if (!folderValidation.diskSpace.hasEnoughSpace) {
            setError(`Warning: ${folderValidation.warning}. Download may fail.`);
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

    const config: DownloadConfig = {
      url: url.trim(),
      format,
      quality,
      outputFolder: targetFolder,
      embedSubtitles: preferences?.embedSubtitles ?? false,
      cookiesFromBrowser: preferences?.cookiesFromBrowser ?? null,
    };

    try {
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
      await invoke("cancel_download");
    } catch (err) {
      console.error("Failed to cancel download:", err);
      setDownloadState("cancelled");
    }
  }, [downloadState]);

  return {
    downloadState,
    progress,
    error,
    downloadedFilePath,
    retryInfo,
    isDownloading,
    isIdle,
    handleDownload,
    handleCancel,
    setError,
    setDownloadState,
  };
}
