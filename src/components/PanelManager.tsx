/**
 * PanelManager - Lazy loaded panel management component
 */

import { lazy, Suspense } from "react";
import { usePanels, useUIStore } from "@/hooks/usePanels";
import { usePreferences } from "@/hooks/usePreferences";
import { useExecutables } from "@/hooks/useExecutables";
import type {
    Format,
    Quality,
    PlaylistInfo,
    DownloadConfig,
    PlaylistEntry,
    ScheduledDownload
} from "@/types";

// Lazy loaded components for code splitting
const SettingsPanel = lazy(() => import("@/components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));
const QueuePanel = lazy(() => import("@/components/QueuePanel").then(m => ({ default: m.QueuePanel })));
const HistoryPanel = lazy(() => import("@/components/HistoryPanel").then(m => ({ default: m.HistoryPanel })));
const PlaylistPanel = lazy(() => import("@/components/PlaylistPanel").then(m => ({ default: m.PlaylistPanel })));
const MissingExecutablesAlert = lazy(() => import("@/components/MissingExecutablesAlert").then(m => ({ default: m.MissingExecutablesAlert })));
const OnboardingTour = lazy(() => import("@/components/OnboardingTour").then(m => ({ default: m.OnboardingTour })));
const BatchUrlImport = lazy(() => import("@/components/BatchUrlImport").then(m => ({ default: m.BatchUrlImport })));
const ScheduleDownload = lazy(() => import("@/components/ScheduleDownload").then(m => ({ default: m.ScheduleDownload })));

// Loading fallback for lazy components
function PanelFallback() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
    );
}

interface PanelManagerProps {
    // Playlist
    playlistInfo: PlaylistInfo | null;
    isLoadingPlaylist: boolean;
    onPlaylistDownload: (entries: PlaylistEntry[], config: Omit<DownloadConfig, "url">) => void;

    // Form state for panels
    format: Format;
    quality: Quality;
    outputFolder: string;

    // Redownload handler
    onRedownload: (config: DownloadConfig) => void;

    // Batch import
    onBatchImport: (urls: string[]) => void;

    // Schedule
    scheduledDownloads: ScheduledDownload[];
    onSchedule: (download: Omit<ScheduledDownload, "id">) => void;
    onRemoveScheduled: (id: string) => void;
    onToggleScheduled: (id: string) => void;
}

export function PanelManager({
    playlistInfo,
    isLoadingPlaylist,
    onPlaylistDownload,
    format,
    quality,
    outputFolder,
    onRedownload,
    onBatchImport,
    scheduledDownloads,
    onSchedule,
    onRemoveScheduled,
    onToggleScheduled,
}: PanelManagerProps) {
    const {
        isSettingsOpen, closeSettings,
        isQueueOpen, closeQueue,
        isHistoryOpen, closeHistory,
        isPlaylistOpen, closePlaylist
    } = usePanels();

    const { isBatchImportOpen, closeBatchImport, isScheduleOpen, closeSchedule } = useUIStore();
    const { preferences, setPreferences } = usePreferences();
    const { missingExecutables, dismissMissingExecutables, copyDebugInfo } = useExecutables();

    return (
        <Suspense fallback={<PanelFallback />}>
            {isSettingsOpen && (
                <SettingsPanel
                    isOpen={isSettingsOpen}
                    onClose={closeSettings}
                    preferences={preferences}
                    onPreferencesChange={setPreferences}
                />
            )}

            {isQueueOpen && (
                <QueuePanel
                    isOpen={isQueueOpen}
                    onClose={closeQueue}
                />
            )}

            {isHistoryOpen && (
                <HistoryPanel
                    isOpen={isHistoryOpen}
                    onClose={closeHistory}
                    onRedownload={onRedownload}
                />
            )}

            {isPlaylistOpen && (
                <PlaylistPanel
                    isOpen={isPlaylistOpen}
                    onClose={closePlaylist}
                    playlistInfo={playlistInfo}
                    isLoading={isLoadingPlaylist}
                    onDownloadSelected={onPlaylistDownload}
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
                    onClose={closeBatchImport}
                    onImport={onBatchImport}
                />
            )}

            {isScheduleOpen && (
                <ScheduleDownload
                    isOpen={isScheduleOpen}
                    onClose={closeSchedule}
                    scheduledDownloads={scheduledDownloads}
                    onSchedule={onSchedule}
                    onRemove={onRemoveScheduled}
                    onToggle={onToggleScheduled}
                    currentFormat={format}
                    currentQuality={quality}
                />
            )}

            {missingExecutables && (
                <MissingExecutablesAlert
                    missingInfo={missingExecutables}
                    onDismiss={dismissMissingExecutables}
                    onCopyDebugInfo={copyDebugInfo}
                />
            )}

            <OnboardingTour />
        </Suspense>
    );
}
