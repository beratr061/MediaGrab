import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { slideUpVariants, defaultTransition } from "@/lib/animations";
import type { ExecutablesMissingEvent } from "@/types";

interface MissingExecutablesAlertProps {
  /** Missing executables information */
  missingInfo: ExecutablesMissingEvent | null;
  /** Callback to dismiss the alert */
  onDismiss: () => void;
  /** Callback to copy debug info */
  onCopyDebugInfo?: () => void;
}

/**
 * Alert component displayed when required executables (yt-dlp, ffmpeg) are missing
 * 
 * **Validates: Requirements 6.1, 11.6**
 */
export function MissingExecutablesAlert({
  missingInfo,
  onDismiss,
  onCopyDebugInfo,
}: MissingExecutablesAlertProps) {
  if (!missingInfo) return null;

  const missingList: string[] = [];
  if (!missingInfo.ytdlpAvailable) missingList.push("yt-dlp");
  if (!missingInfo.ffmpegAvailable) missingList.push("ffmpeg");
  if (!missingInfo.ffprobeAvailable) missingList.push("ffprobe");

  return (
    <AnimatePresence>
      {missingInfo && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={defaultTransition}
        >
          <motion.div
            variants={slideUpVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={defaultTransition}
            className="relative mx-4 max-w-md rounded-lg border border-destructive/50 bg-card p-6 shadow-lg"
          >
            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon and title */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 space-y-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Missing Required Components
                </h2>
                <p className="text-sm text-muted-foreground">
                  MediaGrab requires the following components to download media:
                </p>

                {/* Missing executables list */}
                <ul className="space-y-1 text-sm">
                  {missingList.map((name) => (
                    <li key={name} className="flex items-center gap-2 text-destructive">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                      {name}
                    </li>
                  ))}
                </ul>

                {/* Error details */}
                {missingInfo.error && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono">
                    {missingInfo.error}
                  </p>
                )}

                {/* Help text */}
                <div className="space-y-2 pt-2">
                  <p className="text-sm text-muted-foreground">
                    These components should be bundled with the application. If you're seeing this error:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Try reinstalling MediaGrab</li>
                    <li>Check if your antivirus is blocking the executables</li>
                    <li>Ensure the application has write access to its data folder</li>
                  </ul>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-2">
                  {onCopyDebugInfo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onCopyDebugInfo}
                    >
                      Copy Debug Info
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a
                      href="https://github.com/yt-dlp/yt-dlp/releases"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      yt-dlp Releases
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
