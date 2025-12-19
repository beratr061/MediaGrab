import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bug, Check, AlertCircle, Loader2, Copy } from "lucide-react";
import { invoke } from "@/lib/tauri";
import { Button } from "./ui/button";
import { buttonVariants, springTransition } from "@/lib/animations";

type CopyState = "idle" | "copying" | "success" | "error";

/** Debug information structure from backend */
interface DebugInfo {
  appVersion: string;
  osInfo: string;
  windowsVersion: string;
  ytdlpVersion: string | null;
  ffmpegVersion: string | null;
  recentLogs: string;
  memoryInfo: string;
}

interface CopyDebugInfoButtonProps {
  /** Optional callback when copy completes */
  onCopyComplete?: (success: boolean) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Variant style for the button */
  variant?: "default" | "outline" | "ghost" | "destructive";
  /** Size of the button */
  size?: "default" | "sm" | "lg" | "icon";
  /** Show full label or just icon */
  compact?: boolean;
}

/**
 * Button component for copying debug information to clipboard
 * 
 * Collects system info, app version, yt-dlp version, and recent logs,
 * then copies them to the clipboard for easy sharing when reporting issues.
 * 
 * **Validates: Requirements 10.4**
 */
export function CopyDebugInfoButton({ 
  onCopyComplete, 
  disabled,
  variant = "outline",
  size = "default",
  compact = false
}: CopyDebugInfoButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleCopy = useCallback(async () => {
    if (state === "copying") return;

    setState("copying");
    setMessage(null);

    try {
      const debugInfo = await invoke<DebugInfo>("copy_debug_info");
      
      setState("success");
      setMessage("Debug info copied to clipboard");
      onCopyComplete?.(true);

      // Log what was collected (for debugging the debug feature itself)
      console.log("Debug info collected:", {
        appVersion: debugInfo.appVersion,
        osInfo: debugInfo.osInfo,
        windowsVersion: debugInfo.windowsVersion,
        ytdlpVersion: debugInfo.ytdlpVersion,
        ffmpegVersion: debugInfo.ffmpegVersion,
        logsLength: debugInfo.recentLogs.length,
      });

      // Reset to idle after a delay
      setTimeout(() => {
        setState("idle");
        setMessage(null);
      }, 3000);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Failed to copy debug info");
      onCopyComplete?.(false);
      
      // Reset to idle after a delay
      setTimeout(() => {
        setState("idle");
        setMessage(null);
      }, 5000);
    }
  }, [state, onCopyComplete]);

  const isDisabled = disabled || state === "copying";

  const getButtonContent = () => {
    switch (state) {
      case "copying":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {!compact && "Copying..."}
          </>
        );
      case "success":
        return (
          <>
            <Check className="h-4 w-4" />
            {!compact && "Copied!"}
          </>
        );
      case "error":
        return (
          <>
            <AlertCircle className="h-4 w-4" />
            {!compact && "Failed"}
          </>
        );
      default:
        return (
          <>
            {compact ? <Copy className="h-4 w-4" /> : <Bug className="h-4 w-4" />}
            {!compact && "Copy Debug Info"}
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
        return variant;
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
          onClick={handleCopy}
          disabled={isDisabled}
          variant={getButtonVariant()}
          size={size}
          className="flex items-center gap-2"
          title="Copy debug information to clipboard"
        >
          {getButtonContent()}
        </Button>
      </motion.div>
      
      {/* Status message */}
      {message && !compact && (
        <p className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
