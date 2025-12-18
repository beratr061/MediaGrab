import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeInVariants, defaultTransition } from "@/lib/animations";
import type { ProgressEvent } from "@/types";

interface ProgressBarProps {
  progress: ProgressEvent | null;
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

/**
 * Animated progress bar with shimmer effect
 * **Validates: Requirements 4.1, 4.2, 5.3, 5.4**
 */
export function ProgressBar({ progress, className }: ProgressBarProps) {
  const percentage = progress?.percentage ?? 0;
  const speed = progress?.speed ?? "--";
  const eta = progress?.etaSeconds ?? null;
  const isMerging = progress?.status === "merging";

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
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            isMerging ? "bg-warning" : "bg-primary"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
        {/* Animated shimmer effect during download */}
        <AnimatePresence>
          {percentage > 0 && percentage < 100 && !isMerging && (
            <motion.div
              className="absolute inset-y-0 left-0"
              style={{ width: `${percentage}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
      </div>

      {/* Progress details */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <motion.span 
            className="font-medium text-foreground tabular-nums"
            key={Math.floor(percentage)}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {percentage.toFixed(1)}%
          </motion.span>
          <AnimatePresence>
            {isMerging && (
              <motion.span 
                className="text-warning"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={defaultTransition}
              >
                Merging...
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-4 text-muted-foreground tabular-nums">
          <span>{speed}</span>
          <span>ETA: {formatEta(eta)}</span>
        </div>
      </div>
    </motion.div>
  );
}
