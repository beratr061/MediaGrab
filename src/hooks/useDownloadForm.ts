/**
 * useDownloadForm hook - Manages download form state
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@/lib/tauri";
import { usePreferences } from "@/hooks/usePreferences";
import type { Format, Quality } from "@/types";

interface UseDownloadFormReturn {
    // Form state
    url: string;
    setUrl: (url: string) => void;
    format: Format;
    setFormat: (format: Format) => void;
    quality: Quality;
    setQuality: (quality: Quality) => void;
    outputFolder: string;
    setOutputFolder: (folder: string) => void;

    // Handlers
    handleFormatChange: (format: Format) => void;
    handleQualityChange: (quality: Quality) => void;
    handlePickFolder: () => Promise<void>;

    // Error state
    folderError: string | null;
    setFolderError: (error: string | null) => void;

    // Reset
    resetForm: () => void;
}

export function useDownloadForm(): UseDownloadFormReturn {
    const {
        preferences,
        setOutputFolder: saveOutputFolder,
        setFormat: saveFormat,
        setQuality: saveQuality
    } = usePreferences();

    // Form state
    const [url, setUrl] = useState("");
    const [format, setFormat] = useState<Format>("video-mp4");
    const [quality, setQuality] = useState<Quality>("best");
    const [outputFolder, setOutputFolder] = useState("");
    const [folderError, setFolderError] = useState<string | null>(null);

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
                setFolderError(null);
            }
        } catch (err) {
            console.error("Failed to pick folder:", err);
            setFolderError("Failed to open folder picker");
        }
    }, [saveOutputFolder]);

    const resetForm = useCallback(() => {
        setUrl("");
        setFolderError(null);
    }, []);

    return {
        url,
        setUrl,
        format,
        setFormat,
        quality,
        setQuality,
        outputFolder,
        setOutputFolder,
        handleFormatChange,
        handleQualityChange,
        handlePickFolder,
        folderError,
        setFolderError,
        resetForm,
    };
}
