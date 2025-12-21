/**
 * useSchedule hook - Manages scheduled downloads
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/Toast";
import { useQueue } from "@/hooks/useQueue";
import { usePreferences } from "@/hooks/usePreferences";
import type { ScheduledDownload, DownloadConfig } from "@/types";

interface UseScheduleOptions {
    outputFolder: string;
}

interface UseScheduleReturn {
    scheduledDownloads: ScheduledDownload[];
    addScheduledDownload: (download: Omit<ScheduledDownload, "id">) => void;
    removeScheduledDownload: (id: string) => void;
    toggleScheduledDownload: (id: string) => void;
}

export function useSchedule({ outputFolder }: UseScheduleOptions): UseScheduleReturn {
    const { t } = useTranslation();
    const { success, info } = useToast();
    const { addToQueue } = useQueue();
    const { preferences, setPreferences } = usePreferences();

    const [scheduledDownloads, setScheduledDownloads] = useState<ScheduledDownload[]>([]);

    // Track if we've loaded from preferences
    const loadedFromPrefs = useRef(false);

    // Load scheduled downloads from preferences
    useEffect(() => {
        if (preferences?.scheduledDownloads && !loadedFromPrefs.current) {
            setScheduledDownloads(preferences.scheduledDownloads);
            loadedFromPrefs.current = true;
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
                    removeScheduledDownload(download.id);
                    info(t("schedule.started", "Scheduled download started"));
                }
            });
        };

        const interval = setInterval(checkScheduled, 60000); // Check every minute
        checkScheduled(); // Check immediately on mount
        return () => clearInterval(interval);
    }, [scheduledDownloads, outputFolder, preferences, addToQueue, info, t]);

    // Persist to preferences whenever scheduledDownloads changes
    const persistToPreferences = useCallback((downloads: ScheduledDownload[]) => {
        if (preferences) {
            setPreferences({ ...preferences, scheduledDownloads: downloads });
        }
    }, [preferences, setPreferences]);

    const addScheduledDownload = useCallback((download: Omit<ScheduledDownload, "id">) => {
        const newDownload: ScheduledDownload = {
            ...download,
            id: crypto.randomUUID(),
        };
        const updated = [...scheduledDownloads, newDownload];
        setScheduledDownloads(updated);
        persistToPreferences(updated);
        success(t("schedule.added", "Download scheduled"));
    }, [scheduledDownloads, persistToPreferences, success, t]);

    const removeScheduledDownload = useCallback((id: string) => {
        const updated = scheduledDownloads.filter(d => d.id !== id);
        setScheduledDownloads(updated);
        persistToPreferences(updated);
    }, [scheduledDownloads, persistToPreferences]);

    const toggleScheduledDownload = useCallback((id: string) => {
        const updated = scheduledDownloads.map(d =>
            d.id === id ? { ...d, enabled: !d.enabled } : d
        );
        setScheduledDownloads(updated);
        persistToPreferences(updated);
    }, [scheduledDownloads, persistToPreferences]);

    return {
        scheduledDownloads,
        addScheduledDownload,
        removeScheduledDownload,
        toggleScheduledDownload,
    };
}
