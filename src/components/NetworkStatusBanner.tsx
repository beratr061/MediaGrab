/**
 * NetworkStatusBanner - Shows network connectivity status
 * Displays warnings when offline or connection is degraded
 */

import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { NetworkStatus } from "@/hooks/useNetworkStatus";

interface NetworkStatusBannerProps {
  status: NetworkStatus;
  isDegraded: boolean;
  onRetryConnection: () => Promise<boolean>;
  className?: string;
}

export function NetworkStatusBanner({
  status,
  isDegraded,
  onRetryConnection,
  className,
}: NetworkStatusBannerProps) {
  const { t } = useTranslation();

  // Don't show anything if online and not degraded
  if (status.isOnline && status.isConnected && !isDegraded) {
    return null;
  }

  const isOffline = !status.isOnline || !status.isConnected;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          "rounded-lg border p-3",
          isOffline
            ? "bg-destructive/10 border-destructive/20"
            : "bg-warning/10 border-warning/20",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isOffline ? (
              <WifiOff className="h-5 w-5 text-destructive shrink-0" />
            ) : isDegraded ? (
              <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            ) : (
              <Wifi className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                {isOffline
                  ? t("network.offline", "You're offline")
                  : t("network.slowConnection", "Slow connection detected")}
              </p>
              <p className="text-xs text-muted-foreground">
                {isOffline
                  ? t(
                      "network.offlineDescription",
                      "Check your internet connection. Downloads will resume when you're back online."
                    )
                  : t(
                      "network.slowDescription",
                      "Downloads may be slower than usual. Consider waiting for a better connection."
                    )}
              </p>
              {status.effectiveType && (
                <p className="text-xs text-muted-foreground">
                  {t("network.connectionType", "Connection")}: {status.effectiveType.toUpperCase()}
                  {status.downlink && ` • ${status.downlink} Mbps`}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetryConnection}
            disabled={status.isChecking}
            className="shrink-0"
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-1", status.isChecking && "animate-spin")}
            />
            {t("network.retry", "Retry")}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
