import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Download,
  Merge,
  Clock,
  Cookie,
  RefreshCw,
  Wifi,
  Lock,
  Globe,
  FileQuestion
} from "lucide-react";
import { slideUpVariants, defaultTransition, buttonVariants, springTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import type { DownloadState, RetryEvent } from "@/types";

/**
 * Error category for UI display
 * **Validates: Requirements 6.3**
 */
type ErrorCategory = 
  | "network" 
  | "private" 
  | "age-restricted" 
  | "region-locked" 
  | "not-found" 
  | "generic";

/**
 * Error info with category, message, icon, and whether it's retryable
 */
interface ErrorInfo {
  message: string;
  category: ErrorCategory;
  icon: typeof AlertCircle;
  isRetryable: boolean;
  suggestion?: string;
}

interface StatusDisplayProps {
  state: DownloadState;
  error?: string | null;
  className?: string;
  /** Whether cookies are currently enabled in preferences */
  cookiesEnabled?: boolean;
  /** Callback to open settings panel */
  onOpenSettings?: () => void;
  /** Callback to retry the download (for network errors) */
  onRetry?: () => void;
  /** Current retry information (if retrying) */
  retryInfo?: RetryEvent | null;
}

interface StatusConfig {
  icon: typeof CheckCircle2;
  message: string;
  color: string;
  animate?: boolean;
}

const statusConfigs: Record<DownloadState, StatusConfig> = {
  idle: {
    icon: Clock,
    message: "Ready to download",
    color: "text-muted-foreground",
  },
  analyzing: {
    icon: Loader2,
    message: "Analyzing video...",
    color: "text-primary",
    animate: true,
  },
  starting: {
    icon: Loader2,
    message: "Starting download...",
    color: "text-primary",
    animate: true,
  },
  downloading: {
    icon: Download,
    message: "Downloading...",
    color: "text-primary",
  },
  merging: {
    icon: Merge,
    message: "Merging video and audio...",
    color: "text-warning",
  },
  completed: {
    icon: CheckCircle2,
    message: "Download complete!",
    color: "text-success",
  },
  cancelled: {
    icon: XCircle,
    message: "Download cancelled",
    color: "text-muted-foreground",
  },
  cancelling: {
    icon: Loader2,
    message: "Cancelling...",
    color: "text-muted-foreground",
    animate: true,
  },
  failed: {
    icon: AlertCircle,
    message: "Download failed",
    color: "text-destructive",
  },
};

/**
 * Check if an error is authentication-related (private, age-restricted, login required)
 * Requirements: 13.2 - Detect authentication errors
 */
function isAuthenticationError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes("private") ||
    lowerError.includes("sign in") ||
    lowerError.includes("login") ||
    lowerError.includes("age") ||
    lowerError.includes("confirm your age") ||
    lowerError.includes("age-restricted") ||
    lowerError.includes("authentication") ||
    lowerError.includes("members only") ||
    lowerError.includes("subscriber") ||
    lowerError.includes("premium")
  );
}

/**
 * Categorize error messages for user-friendly display
 * **Validates: Requirements 6.2, 6.3**
 */
function categorizeError(error: string): ErrorInfo {
  const lowerError = error.toLowerCase();
  
  // Private video errors
  if (lowerError.includes("private") || lowerError.includes("sign in") || lowerError.includes("login")) {
    return {
      message: "This video is private or requires sign-in.",
      category: "private",
      icon: Lock,
      isRetryable: false,
      suggestion: "Try enabling browser cookie import to access content you have legitimate access to.",
    };
  }
  
  // Age-restricted content
  if (lowerError.includes("age") || lowerError.includes("confirm your age") || lowerError.includes("age-restricted")) {
    return {
      message: "This video is age-restricted.",
      category: "age-restricted",
      icon: Lock,
      isRetryable: false,
      suggestion: "Enable browser cookie import in settings to verify your age.",
    };
  }
  
  // Region-locked content
  if (lowerError.includes("not available") || lowerError.includes("blocked") || lowerError.includes("region") || lowerError.includes("geo")) {
    return {
      message: "This video is not available in your region.",
      category: "region-locked",
      icon: Globe,
      isRetryable: false,
      suggestion: "This content is restricted based on your location.",
    };
  }
  
  // Network errors - these are retryable
  // **Validates: Requirements 6.2**
  if (lowerError.includes("network") || 
      lowerError.includes("connection") || 
      lowerError.includes("timeout") || 
      lowerError.includes("timed out") ||
      lowerError.includes("unable to download") ||
      lowerError.includes("http error") ||
      lowerError.includes("ssl") ||
      lowerError.includes("certificate")) {
    return {
      message: "Network error. Please check your connection.",
      category: "network",
      icon: Wifi,
      isRetryable: true,
      suggestion: "Check your internet connection and try again.",
    };
  }
  
  // Not found errors
  if (lowerError.includes("not found") || 
      lowerError.includes("404") || 
      lowerError.includes("does not exist") || 
      lowerError.includes("unavailable") ||
      lowerError.includes("removed") ||
      lowerError.includes("deleted")) {
    return {
      message: "Video not found. Please check the URL.",
      category: "not-found",
      icon: FileQuestion,
      isRetryable: false,
      suggestion: "The video may have been removed or the URL may be incorrect.",
    };
  }
  
  // Generic error - return original error message
  return {
    message: error,
    category: "generic",
    icon: AlertCircle,
    isRetryable: false,
  };
}

/**
 * Status display component with error categorization, retry option, and cookie suggestion
 * 
 * **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 6.2, 6.3, 13.2**
 */
export function StatusDisplay({ 
  state, 
  error, 
  className,
  cookiesEnabled = false,
  onOpenSettings,
  onRetry,
  retryInfo
}: StatusDisplayProps) {
  const config = statusConfigs[state];
  const Icon = config.icon;
  const errorInfo = error ? categorizeError(error) : null;
  
  // Override message if retrying
  const displayMessage = retryInfo 
    ? `Retrying... (${retryInfo.attempt}/${retryInfo.maxRetries})`
    : config.message;
  
  // Check if this is an auth error and cookies are not enabled
  const showCookieSuggestion = 
    state === "failed" && 
    error && 
    isAuthenticationError(error) && 
    !cookiesEnabled;
  
  // Show retry button for retryable errors (network errors)
  // **Validates: Requirements 6.2**
  const showRetryButton = 
    state === "failed" && 
    errorInfo?.isRetryable && 
    onRetry;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state + (error || "")}
        variants={slideUpVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={defaultTransition}
        className={cn("flex flex-col gap-2", className)}
      >
        <div className={cn("flex items-center gap-2", retryInfo ? "text-warning" : config.color)}>
          <Icon className={cn("h-5 w-5", (config.animate || retryInfo) && "animate-spin")} />
          <span className="font-medium">{displayMessage}</span>
        </div>
        
        {/* Retry info banner */}
        {retryInfo && (
          <motion.div
            variants={slideUpVariants}
            initial="initial"
            animate="animate"
            className="mt-2 p-3 rounded-lg bg-warning/10 border border-warning/20"
          >
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-warning mt-0.5 shrink-0 animate-spin" />
              <div className="flex-1 space-y-1">
                <p className="text-sm text-foreground font-medium">
                  Automatic retry in progress
                </p>
                <p className="text-xs text-muted-foreground">
                  Attempt {retryInfo.attempt} of {retryInfo.maxRetries} • Waiting {Math.round(retryInfo.delayMs / 1000)}s before retry
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {retryInfo.error}
                </p>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Error details with categorized icon */}
        {/* **Validates: Requirements 6.2, 6.3** */}
        {state === "failed" && errorInfo && (
          <motion.div
            variants={slideUpVariants}
            initial="initial"
            animate="animate"
            className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
          >
            <div className="flex items-start gap-3">
              <errorInfo.icon className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-foreground font-medium">
                  {errorInfo.message}
                </p>
                {/* Show suggestion for categorized errors */}
                {errorInfo.suggestion && errorInfo.category !== "generic" && (
                  <p className="text-xs text-muted-foreground">
                    {errorInfo.suggestion}
                  </p>
                )}
                {/* Show original error for debugging if different from categorized message */}
                {errorInfo.category === "generic" && error !== errorInfo.message && (
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {error}
                  </p>
                )}
                {/* Retry button for retryable errors (network errors) - more prominent */}
                {/* **Validates: Requirements 6.2** */}
                {showRetryButton && (
                  <motion.div
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    transition={springTransition}
                    className="pt-2"
                  >
                    <Button
                      size="default"
                      variant="default"
                      onClick={onRetry}
                      className="flex items-center gap-2 w-full justify-center"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry Download
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Cookie import suggestion for authentication errors */}
        {showCookieSuggestion && (
          <motion.div
            variants={slideUpVariants}
            initial="initial"
            animate="animate"
            transition={{ ...defaultTransition, delay: 0.1 }}
            className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/20"
          >
            <div className="flex items-start gap-2">
              <Cookie className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-foreground">
                  This content may require authentication.
                </p>
                <p className="text-xs text-muted-foreground">
                  Try enabling cookie import from your browser to access private, 
                  age-restricted, or subscription content you have legitimate access to.
                </p>
                {onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Open Settings →
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
