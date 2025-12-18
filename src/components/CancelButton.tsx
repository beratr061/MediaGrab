import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { buttonVariants, fadeInVariants, springTransition, defaultTransition } from "@/lib/animations";
import type { DownloadState } from "@/types";

interface CancelButtonProps {
  onClick: () => void;
  state: DownloadState;
}

export function CancelButton({ onClick, state }: CancelButtonProps) {
  const isCancelling = state === "cancelling";
  const isVisible = state === "downloading" || state === "merging" || state === "cancelling" || state === "starting";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={defaultTransition}
        >
          <motion.div
            variants={buttonVariants}
            whileHover={isCancelling ? {} : "hover"}
            whileTap={isCancelling ? {} : "tap"}
            transition={springTransition}
          >
            <Button
              onClick={onClick}
              disabled={isCancelling}
              variant="secondary"
              className="flex items-center gap-2"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              )}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
