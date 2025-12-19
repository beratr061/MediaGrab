import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Check, AlertCircle, Loader2 } from "lucide-react";
import { invoke } from "@/lib/tauri";
import { Button } from "./ui/button";
import { buttonVariants, springTransition } from "@/lib/animations";
import type { UpdateResult } from "@/types";

type UpdateState = "idle" | "checking" | "updating" | "success" | "error";

interface UpdateButtonProps {
  /** Optional callback when update completes */
  onUpdateComplete?: (result: UpdateResult) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Current yt-dlp version (optional, for display) */
  currentVersion?: string | undefined;
}

/**
 * Button component for manually triggering yt-dlp updates
 * 
 * **Validates: Requirements 7.6**
 */
export function UpdateButton({ 
  onUpdateComplete, 
  disabled,
  currentVersion 
}: UpdateButtonProps) {
  const [state, setState] = useState<UpdateState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState<string | null>(currentVersion ?? null);

  const handleUpdate = useCallback(async () => {
    if (state === "updating" || state === "checking") return;

    setState("updating");
    setMessage(null);

    try {
      const result = await invoke<UpdateResult>("update_ytdlp");
      
      if (result.success) {
        setState("success");
        setMessage(result.message);
        if (result.version) {
          setVersion(result.version);
        }
      } else {
        setState("error");
        setMessage(result.message);
      }

      onUpdateComplete?.(result);

      // Reset to idle after a delay
      setTimeout(() => {
        setState("idle");
      }, 5000);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Update failed");
      
      // Reset to idle after a delay
      setTimeout(() => {
        setState("idle");
      }, 5000);
    }
  }, [state, onUpdateComplete]);

  const isDisabled = disabled || state === "updating" || state === "checking";

  const getButtonContent = () => {
    switch (state) {
      case "updating":
      case "checking":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating...
          </>
        );
      case "success":
        return (
          <>
            <Check className="h-4 w-4" />
            Updated
          </>
        );
      case "error":
        return (
          <>
            <AlertCircle className="h-4 w-4" />
            Failed
          </>
        );
      default:
        return (
          <>
            <RefreshCw className="h-4 w-4" />
            Update yt-dlp
          </>
        );
    }
  };

  const getButtonVariant = () => {
    switch (state) {
      case "success":
        return "default";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-2">
      <motion.div
        variants={buttonVariants}
        whileHover={isDisabled ? {} : "hover"}
        whileTap={isDisabled ? {} : "tap"}
        transition={springTransition}
      >
        <Button
          onClick={handleUpdate}
          disabled={isDisabled}
          variant={getButtonVariant()}
          className="flex items-center gap-2"
        >
          {getButtonContent()}
        </Button>
      </motion.div>
      
      {/* Version display */}
      {version && (
        <p className="text-xs text-muted-foreground">
          Current version: {version}
        </p>
      )}
      
      {/* Status message */}
      {message && (
        <p className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
