import { motion, AnimatePresence } from "framer-motion";
import { User, Clock, HardDrive, Image as ImageIcon } from "lucide-react";
import { slideUpVariants, defaultTransition } from "@/lib/animations";
import { cn } from "@/lib/utils";
import type { MediaInfo } from "@/types";

interface MediaInfoPreviewProps {
  mediaInfo: MediaInfo | null;
  isLoading?: boolean;
  className?: string;
}

/**
 * Formats duration in seconds to a human-readable string
 */
function formatDuration(seconds: number | null): string {
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
 * Formats file size in bytes to a human-readable string
 */
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "Unknown size";
  
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `~${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * MediaInfoPreview component displays thumbnail and metadata before download
 * 
 * **Validates: Requirements 12.3**
 */
export function MediaInfoPreview({ 
  mediaInfo, 
  isLoading = false,
  className 
}: MediaInfoPreviewProps) {
  if (!mediaInfo && !isLoading) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isLoading ? "loading" : "info"}
        variants={slideUpVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={defaultTransition}
        className={cn(
          "rounded-lg border border-border bg-card p-4",
          className
        )}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : mediaInfo ? (
          <MediaInfoContent mediaInfo={mediaInfo} />
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse">
      {/* Thumbnail skeleton */}
      <div className="h-20 w-32 shrink-0 rounded-md bg-muted" />
      
      {/* Content skeleton */}
      <div className="flex flex-1 flex-col justify-center gap-2">
        <div className="h-5 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="flex gap-4">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-4 w-20 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function MediaInfoContent({ mediaInfo }: { mediaInfo: MediaInfo }) {
  return (
    <div className="flex gap-4">
      {/* Thumbnail */}
      <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md bg-muted">
        {mediaInfo.thumbnail ? (
          <img
            src={mediaInfo.thumbnail}
            alt={mediaInfo.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Hide broken image and show placeholder
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={cn(
          "flex h-full w-full items-center justify-center text-muted-foreground",
          mediaInfo.thumbnail ? "hidden" : ""
        )}>
          <ImageIcon className="h-8 w-8" />
        </div>
      </div>
      
      {/* Content */}
      <div className="flex flex-1 flex-col justify-center gap-1 overflow-hidden">
        {/* Title */}
        <h3 className="truncate font-medium text-foreground" title={mediaInfo.title}>
          {mediaInfo.title}
        </h3>
        
        {/* Uploader */}
        {mediaInfo.uploader && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="truncate">{mediaInfo.uploader}</span>
          </div>
        )}
        
        {/* Duration and file size */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {mediaInfo.duration !== null && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDuration(mediaInfo.duration)}</span>
            </div>
          )}
          {mediaInfo.filesizeApprox !== null && (
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              <span>{formatFileSize(mediaInfo.filesizeApprox)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
