import { useEffect, useCallback } from "react";

interface KeyboardShortcutsOptions {
  onPaste?: (() => void) | undefined;
  onDownload?: (() => void) | undefined;
  onCancel?: (() => void) | undefined;
  enabled?: boolean | undefined;
}

/**
 * Hook for handling keyboard shortcuts
 * Requirements: 5.5 - Ctrl+V paste, Enter to download, Esc to cancel
 */
export function useKeyboardShortcuts({
  onPaste,
  onDownload,
  onCancel,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields (except for specific keys)
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Ctrl+V - Paste URL (works globally)
      if (event.ctrlKey && event.key === "v" && onPaste) {
        // Let the browser handle paste in input fields naturally
        if (!isInputField) {
          event.preventDefault();
          onPaste();
        }
      }

      // Enter - Start download (works in input fields too)
      if (event.key === "Enter" && onDownload) {
        // Only trigger if not in a textarea
        if (target.tagName !== "TEXTAREA") {
          event.preventDefault();
          onDownload();
        }
      }

      // Escape - Cancel download (works globally)
      if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        onCancel();
      }
    },
    [enabled, onPaste, onDownload, onCancel]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);
}
