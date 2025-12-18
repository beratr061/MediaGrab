/**
 * useExecutables hook - Manages missing executables detection
 */

import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { ExecutablesMissingEvent } from "@/types";

interface UseExecutablesReturn {
  missingExecutables: ExecutablesMissingEvent | null;
  dismissMissingExecutables: () => void;
  copyDebugInfo: () => Promise<void>;
}

export function useExecutables(): UseExecutablesReturn {
  const [missingExecutables, setMissingExecutables] = useState<ExecutablesMissingEvent | null>(
    null
  );

  useEffect(() => {
    const unlistenExecutablesMissing = listen<ExecutablesMissingEvent>(
      "executables-missing",
      (event) => {
        setMissingExecutables(event.payload);
      }
    );

    return () => {
      unlistenExecutablesMissing.then((unlisten) => unlisten());
    };
  }, []);

  const dismissMissingExecutables = useCallback(() => {
    setMissingExecutables(null);
  }, []);

  const copyDebugInfo = useCallback(async () => {
    try {
      await invoke("copy_debug_info");
    } catch (err) {
      console.error("Failed to copy debug info:", err);
    }
  }, []);

  return {
    missingExecutables,
    dismissMissingExecutables,
    copyDebugInfo,
  };
}
