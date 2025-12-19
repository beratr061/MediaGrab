/**
 * useUpdateNotification hook - Manages yt-dlp update notifications
 */

import { useState, useEffect, useCallback } from "react";
import { listen } from "@/lib/tauri";

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
}

interface UseUpdateNotificationReturn {
  updateAvailable: UpdateInfo | null;
  dismissUpdate: () => void;
}

export function useUpdateNotification(): UseUpdateNotificationReturn {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    const unlistenUpdateAvailable = listen<UpdateInfo>("ytdlp-update-available", (event) => {
      setUpdateAvailable(event.payload);
    });

    return () => {
      unlistenUpdateAvailable.then((unlisten) => unlisten());
    };
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(null);
  }, []);

  return {
    updateAvailable,
    dismissUpdate,
  };
}
