import { motion, AnimatePresence } from "framer-motion";
import { Download, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { buttonVariants, springTransition, fastTransition } from "@/lib/animations";
import type { DownloadState } from "@/types";

interface DownloadButtonProps {
  onClick: () => void;
  state: DownloadState;
  disabled?: boolean;
}

/**
 * Download button with animated states
 * **Validates: Requirements 5.2, 5.3, 5.4**
 */
export function DownloadButton({ onClick, state, disabled }: DownloadButtonProps) {
  const isLoading = state === "starting" || state === "analyzing";
  const isDownloading = state === "downloading" || state === "merging";
  const isDisabled = disabled || isLoading || isDownloading || state === "cancelling";

  return (
    <motion.div
      variants={buttonVariants}
      initial="initial"
      whileHover={isDisabled ? {} : "hover"}
      whileTap={isDisabled ? {} : "tap"}
      transition={springTransition}
    >
      <Button
        onClick={onClick}
        disabled={isDisabled}
        className="flex items-center gap-2 px-6 overflow-hidden"
        size="lg"
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.span
              key="loading"
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={fastTransition}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              {state === "analyzing" ? "Analyzing..." : "Starting..."}
            </motion.span>
          ) : (
            <motion.span
              key="download"
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={fastTransition}
            >
              <Download className="h-4 w-4" />
              Download
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}
