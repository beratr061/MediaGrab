/**
 * DownloadFormSection - Main download form with URL input, selectors, and actions
 */

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ListOrdered, ListVideo, FileText, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UrlInput, saveRecentUrl } from "@/components/UrlInput";
import { FormatSelector } from "@/components/FormatSelector";
import { QualitySelector } from "@/components/QualitySelector";
import { FolderPicker } from "@/components/FolderPicker";
import { DownloadButton } from "@/components/DownloadButton";
import { CancelButton } from "@/components/CancelButton";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusDisplay } from "@/components/StatusDisplay";
import { MediaInfoPreview } from "@/components/MediaInfoPreview";
import { OpenFolderButton } from "@/components/OpenFolderButton";
import { PlayButton } from "@/components/PlayButton";
import { EmptyState } from "@/components/EmptyState";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/uiStore";
import { useQueue } from "@/hooks/useQueue";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/components/Toast";
import { validateUrl } from "@/lib/validation";
import { itemVariants } from "@/lib/animations";
import type { NetworkStatus } from "@/hooks/useNetworkStatus";
import type {
    Format,
    Quality,
    MediaInfo,
    DownloadState,
    ProgressEvent,
    PlaylistInfo,
    RetryEvent,
    DownloadConfig
} from "@/types";

interface DownloadFormNetworkStatus extends NetworkStatus {
    isDegraded: boolean;
    checkConnectivity: () => Promise<boolean>;
}

interface DownloadFormSectionProps {
    // Form state
    url: string;
    onUrlChange: (url: string) => void;
    format: Format;
    onFormatChange: (format: Format) => void;
    quality: Quality;
    onQualityChange: (quality: Quality) => void;
    outputFolder: string;
    onPickFolder: () => void;

    // Media info
    mediaInfo: MediaInfo | null;
    isLoadingMediaInfo: boolean;

    // Playlist
    isPlaylist: boolean;
    playlistInfo: PlaylistInfo | null;
    isLoadingPlaylist: boolean;

    // Download state
    downloadState: DownloadState;
    progress: ProgressEvent | null;
    error: string | null;
    downloadedFilePath: string | null;
    retryInfo: RetryEvent | null;
    isDownloading: boolean;

    // Network status
    networkStatus: DownloadFormNetworkStatus;

    // Scheduled downloads count
    scheduledDownloadsCount: number;

    // Handlers
    onDownload: () => void;
    onCancel: () => void;
    onMultipleUrls: (urls: string[]) => void;

    // Clear media info (for after adding to queue)
    clearMediaInfo: () => void;
}

export function DownloadFormSection({
    url,
    onUrlChange,
    format,
    onFormatChange,
    quality,
    onQualityChange,
    outputFolder,
    onPickFolder,
    mediaInfo,
    isLoadingMediaInfo,
    isPlaylist,
    playlistInfo,
    isLoadingPlaylist,
    downloadState,
    progress,
    error,
    downloadedFilePath,
    retryInfo,
    isDownloading,
    networkStatus,
    scheduledDownloadsCount,
    onDownload,
    onCancel,
    onMultipleUrls,
    clearMediaInfo,
}: DownloadFormSectionProps) {
    const { t } = useTranslation();
    const { success } = useToast();
    const { addToQueue } = useQueue();
    const { preferences } = usePreferences();
    const { openSettings, openPlaylist, openBatchImport, openSchedule } = useUIStore();

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
        onUrlChange("");
        clearMediaInfo();
    }, [url, format, quality, outputFolder, preferences, addToQueue, clearMediaInfo, success, t, onUrlChange]);

    const isOffline = !networkStatus.isOnline || !networkStatus.isConnected;

    return (
        <>
            {/* URL Input */}
            <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-2">
                    <label htmlFor="url-input" className="block text-sm font-medium text-foreground">
                        {t("form.videoUrl")}
                    </label>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={openBatchImport} title={t("batch.title", "Batch Import")}>
                            <FileText className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={openSchedule} title={t("schedule.title", "Schedule")}>
                            <Clock className="h-4 w-4" />
                            {scheduledDownloadsCount > 0 && (
                                <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5">
                                    {scheduledDownloadsCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
                <UrlInput
                    id="url-input"
                    value={url}
                    onChange={onUrlChange}
                    onSubmit={onDownload}
                    onMultipleUrls={onMultipleUrls}
                    disabled={isDownloading}
                />
            </motion.div>

            {/* Network Status Banner */}
            {(isOffline || networkStatus.isDegraded) && (
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
                                {playlistInfo && (
                                    <p className="text-sm text-muted-foreground">
                                        {playlistInfo.title} • {t("playlist.videoCount", { count: playlistInfo.videoCount })}
                                    </p>
                                )}
                                {isLoadingPlaylist && (
                                    <p className="text-sm text-muted-foreground">{t("playlist.loading")}</p>
                                )}
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
                    <label htmlFor="format-selector" className="mb-2 block text-sm font-medium text-foreground">
                        {t("form.format")}
                    </label>
                    <FormatSelector id="format-selector" value={format} onChange={onFormatChange} disabled={isDownloading} />
                </div>
                <div>
                    <label htmlFor="quality-selector" className="mb-2 block text-sm font-medium text-foreground">
                        {t("form.quality")}
                    </label>
                    <QualitySelector
                        id="quality-selector"
                        value={quality}
                        onChange={onQualityChange}
                        disabled={isDownloading}
                        duration={mediaInfo?.duration}
                    />
                </div>
            </motion.div>

            {/* Folder picker */}
            <motion.div variants={itemVariants}>
                <label htmlFor="folder-picker" className="mb-2 block text-sm font-medium text-foreground">
                    {t("form.saveTo")}
                </label>
                <FolderPicker id="folder-picker" value={outputFolder} onPick={onPickFolder} disabled={isDownloading} />
            </motion.div>

            {/* Action buttons */}
            <motion.div variants={itemVariants} className="flex items-center gap-3">
                <DownloadButton onClick={onDownload} state={downloadState} disabled={!validateUrl(url).isValid} />
                <Button variant="outline" onClick={handleAddToQueue} disabled={!validateUrl(url).isValid || isDownloading}>
                    <ListOrdered className="mr-2 h-4 w-4" />{t("buttons.addToQueue")}
                </Button>
                <CancelButton onClick={onCancel} state={downloadState} />
            </motion.div>

            {/* Progress bar */}
            <AnimatePresence>
                {isDownloading && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                    >
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
                    onRetry={onDownload}
                    retryInfo={retryInfo}
                    isOffline={isOffline}
                />
            </motion.div>

            {/* Completion buttons */}
            <AnimatePresence>
                {downloadState === "completed" && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-3"
                    >
                        {downloadedFilePath && <PlayButton filePath={downloadedFilePath} />}
                        <OpenFolderButton folderPath={outputFolder || downloadedFilePath?.substring(0, downloadedFilePath.lastIndexOf("\\")) || ""} />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
