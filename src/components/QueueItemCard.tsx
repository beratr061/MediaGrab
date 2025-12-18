import { motion } from 'framer-motion';
import {
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FolderOpen,
  AlertCircle,
} from 'lucide-react';
import { Button } from './ui/button';
import { invoke } from '@tauri-apps/api/core';
import type { QueueItem } from '@/types';
import { cn } from '@/lib/utils';

export interface QueueItemCardProps {
  item: QueueItem;
  onCancel: () => void;
  onRemove: () => void;
  onMoveUp?: (() => void) | undefined;
  onMoveDown?: (() => void) | undefined;
}

export function QueueItemCard({
  item,
  onCancel,
  onRemove,
  onMoveUp,
  onMoveDown,
}: QueueItemCardProps) {
  const isActive = item.status === 'downloading' || item.status === 'merging';
  const isPending = item.status === 'pending';
  const isCompleted = item.status === 'completed';
  const isFailed = item.status === 'failed';
  const isCancelled = item.status === 'cancelled';
  const isTerminal = isCompleted || isFailed || isCancelled;

  const handleOpenFile = async () => {
    if (item.filePath) {
      try {
        await invoke('open_file', { path: item.filePath });
      } catch (err) {
        console.error('Failed to open file:', err);
      }
    }
  };

  const handleOpenFolder = async () => {
    if (item.filePath) {
      const folderPath = item.filePath.substring(
        0,
        item.filePath.lastIndexOf('\\')
      );
      try {
        await invoke('open_folder', { path: folderPath });
      } catch (err) {
        console.error('Failed to open folder:', err);
      }
    }
  };

  const formatEta = (seconds: number | null) => {
    if (seconds === null) return '';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getStatusIcon = () => {
    switch (item.status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'downloading':
      case 'merging':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (item.status) {
      case 'pending':
        return 'Waiting...';
      case 'downloading':
        return `${item.progress.toFixed(1)}% • ${item.speed}${item.etaSeconds ? ` • ${formatEta(item.etaSeconds)}` : ''}`;
      case 'merging':
        return 'Merging...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return item.error || 'Failed';
      case 'cancelled':
        return 'Cancelled';
    }
  };

  // Extract display title from URL if no title
  const displayTitle =
    item.title ||
    item.config.url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .substring(0, 50);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 transition-colors',
        isActive && 'border-primary/50',
        isFailed && 'border-destructive/50',
        isCompleted && 'border-green-500/30'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Thumbnail or placeholder */}
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt=""
            className="h-12 w-20 rounded object-cover"
          />
        ) : (
          <div className="flex h-12 w-20 items-center justify-center rounded bg-muted">
            {getStatusIcon()}
          </div>
        )}

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.title || item.config.url}>
            {displayTitle}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {getStatusIcon()}
            <span className="truncate">{getStatusText()}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isPending && (
            <>
              {onMoveUp && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onMoveUp}
                  aria-label="Move up in queue"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
              {onMoveDown && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onMoveDown}
                  aria-label="Move down in queue"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          {(isPending || isActive) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onCancel}
              aria-label="Cancel download"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {isTerminal && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRemove}
              aria-label="Remove from queue"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn(
                'h-full rounded-full',
                item.status === 'merging' ? 'bg-yellow-500' : 'bg-primary'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${item.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Completed actions */}
      {isCompleted && item.filePath && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleOpenFile}
          >
            <Play className="mr-1 h-3 w-3" />
            Play
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleOpenFolder}
          >
            <FolderOpen className="mr-1 h-3 w-3" />
            Open Folder
          </Button>
        </div>
      )}

      {/* Error message */}
      {isFailed && item.error && (
        <div className="mt-2 flex items-start gap-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="line-clamp-2">{item.error}</span>
        </div>
      )}
    </div>
  );
}
