/**
 * useNetworkStatus hook - Monitors network connectivity
 * Provides offline detection and graceful degradation support
 */

import { useState, useEffect, useCallback } from "react";

export interface NetworkStatus {
  /** Whether the browser reports being online */
  isOnline: boolean;
  /** Whether we've confirmed connectivity to the internet */
  isConnected: boolean;
  /** Last time connectivity was checked */
  lastChecked: Date | null;
  /** Whether a connectivity check is in progress */
  isChecking: boolean;
  /** Connection type if available (wifi, cellular, etc.) */
  connectionType: string | null;
  /** Effective connection type (slow-2g, 2g, 3g, 4g) */
  effectiveType: string | null;
  /** Estimated downlink speed in Mbps */
  downlink: number | null;
}

interface UseNetworkStatusReturn extends NetworkStatus {
  /** Manually trigger a connectivity check */
  checkConnectivity: () => Promise<boolean>;
  /** Whether the network is in a degraded state (online but slow) */
  isDegraded: boolean;
}

// URLs to check for connectivity (use multiple for redundancy)
const CONNECTIVITY_CHECK_URLS = [
  "https://www.google.com/generate_204",
  "https://connectivitycheck.gstatic.com/generate_204",
];

export function useNetworkStatus(): UseNetworkStatusReturn {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    isConnected: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastChecked: null,
    isChecking: false,
    connectionType: null,
    effectiveType: null,
    downlink: null,
  });

  // Get network information if available
  const updateNetworkInfo = useCallback(() => {
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (connection) {
      setStatus((prev) => ({
        ...prev,
        connectionType: connection.type || null,
        effectiveType: connection.effectiveType || null,
        downlink: connection.downlink || null,
      }));
    }
  }, []);

  // Check actual connectivity by making a request
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    setStatus((prev) => ({ ...prev, isChecking: true }));

    for (const url of CONNECTIVITY_CHECK_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch(url, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // no-cors mode always returns opaque response, so we just check if it didn't throw
        setStatus((prev) => ({
          ...prev,
          isConnected: true,
          lastChecked: new Date(),
          isChecking: false,
        }));
        return true;
      } catch {
        // Try next URL
        continue;
      }
    }

    // All checks failed
    setStatus((prev) => ({
      ...prev,
      isConnected: false,
      lastChecked: new Date(),
      isChecking: false,
    }));
    return false;
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      // Verify actual connectivity when coming back online
      checkConnectivity();
    };

    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        isConnected: false,
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for network info changes
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (connection) {
      connection.addEventListener("change", updateNetworkInfo);
      updateNetworkInfo();
    }

    // Initial connectivity check
    if (navigator.onLine) {
      checkConnectivity();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (connection) {
        connection.removeEventListener("change", updateNetworkInfo);
      }
    };
  }, [checkConnectivity, updateNetworkInfo]);

  // Determine if network is degraded (online but slow)
  const isDegraded =
    status.isOnline &&
    status.effectiveType !== null &&
    ["slow-2g", "2g"].includes(status.effectiveType);

  return {
    ...status,
    checkConnectivity,
    isDegraded,
  };
}

// Network Information API types
interface NetworkInformation extends EventTarget {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}
