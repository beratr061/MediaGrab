/**
 * useDragDrop hook - Manages global drag and drop for URLs
 */

import { useCallback } from "react";
import { useUIStore } from "@/stores/uiStore";
import { validateUrl, sanitizeUrl } from "@/lib/validation";

interface UseDragDropOptions {
    isDownloading: boolean;
    onUrlDrop: (url: string) => void;
    onMultipleUrlsDrop?: () => void;
}

interface UseDragDropReturn {
    isGlobalDragOver: boolean;
    handleDragOver: (e: React.DragEvent) => void;
    handleDragLeave: (e: React.DragEvent) => void;
    handleDrop: (e: React.DragEvent) => void;
}

export function useDragDrop({
    isDownloading,
    onUrlDrop,
    onMultipleUrlsDrop,
}: UseDragDropOptions): UseDragDropReturn {
    const { isGlobalDragOver, setGlobalDragOver, openBatchImport } = useUIStore();

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!isDownloading) {
            setGlobalDragOver(true);
        }
    }, [isDownloading, setGlobalDragOver]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        // Only hide if leaving the window
        if (e.relatedTarget === null) {
            setGlobalDragOver(false);
        }
    }, [setGlobalDragOver]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setGlobalDragOver(false);
        if (isDownloading) return;

        // Handle dropped text (URL)
        const text = e.dataTransfer.getData("text/plain");
        if (text) {
            const sanitized = sanitizeUrl(text);
            const validation = validateUrl(sanitized);
            if (validation.isValid && validation.sanitizedUrl) {
                onUrlDrop(validation.sanitizedUrl);
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
                        onUrlDrop(validation.sanitizedUrl);
                    }
                } else if (lines.length > 1) {
                    // Multiple URLs - open batch import
                    if (onMultipleUrlsDrop) {
                        onMultipleUrlsDrop();
                    } else {
                        openBatchImport();
                    }
                }
            });
        }
    }, [isDownloading, setGlobalDragOver, onUrlDrop, onMultipleUrlsDrop, openBatchImport]);

    return {
        isGlobalDragOver,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    };
}
