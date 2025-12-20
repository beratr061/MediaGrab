import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { fadeInVariants, defaultTransition } from "@/lib/animations";
import { SpeedGraph } from "./SpeedGraph";
import type { ProgressEvent } from "@/types";

interface ProgressBarProps {
  progress: ProgressEvent | null;
  showSpeedGraph?: boolean;
  className?: string;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "--:--";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "--";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Animated progress bar with shimmer effect
 * **Validates: Requirements 4.1, 4.2, 5.3, 5.4**
 */
export function ProgressBar({ progress, showSpeedGraph = true, className }: ProgressBarProps) {
  const { t } = useTranslation();
  const percentage = progress?.percentage ?? 0;
  const speed = progress?.speed ?? "--";
  const eta = progress?.etaSeconds ?? null;
  const isMerging = progress?.status === "merging";
  const downloadedBytes = progress?.downloadedBytes ?? null;
  const totalBytes = progress?.totalBytes ?? null;

  // Show indeterminate state only when no progress data at all
  const isIndeterminate = progress === null;

  return (
    <motion.div
      className={cn("space-y-2", className)}
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={defaultTransition}
    >
      {/* Progress bar container */}
      <div className="relative h-5 overflow-hidden rounded-full bg-muted">
        {isIndeterminate ? (
          /* Indeterminate loading animation */
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary"
            animate={{
              x: ["-100%", "400%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ) : (
          <>
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out",
                isMerging ? "bg-warning" : "bg-primary"
              )}
              style={{ width: `${percentage}%` }}
            />
            {/* Pulsing effect during merging */}
            <AnimatePresence>
              {isMerging && (
                <motion.div
                  className="absolute inset-0 bg-warning/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Progress details */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          {isIndeterminate ? (
            <span className="text-muted-foreground animate-pulse">
              {t("status.preparing")}
            </span>
          ) : (
            <>
              <motion.span
                className="font-medium text-foreground tabular-nums"
                key={Math.floor(percentage)}
                initial={{ opacity: 0.7 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                {percentage.toFixed(1)}%
              </motion.span>
              {/* File size info */}
              {(downloadedBytes !== null || totalBytes !== null) && (
                <span className="text-muted-foreground tabular-nums">
                  {formatBytes(downloadedBytes)}
                  {totalBytes !== null && ` / ${formatBytes(totalBytes)}`}
                </span>
              )}
              <AnimatePresence>
                {isMerging && (
                  <motion.span
                    className="text-warning"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={defaultTransition}
                  >
                    {t("status.mergingFiles")}
                  </motion.span>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
        {!isIndeterminate && (
          <div className="flex items-center gap-4 text-muted-foreground tabular-nums">
            {/* Speed graph */}
            {showSpeedGraph && !isMerging && (
              <SpeedGraph speed={speed} />
            )}
            <span>{speed}</span>
            <span>ETA: {formatEta(eta)}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
