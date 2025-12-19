import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  History,
  Trash2,
  ExternalLink,
  Play,
  RefreshCw,
  Download,
  Clock,
  HardDrive,
  CheckCircle,
  XCircle,
  Search,
  Undo2,
} from 'lucide-react';
import { invoke } from '@/lib/tauri';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { SkeletonHistoryItem, SkeletonList } from './Skeleton';
import { useHistory } from '@/hooks/useHistory';
import { useToast } from './Toast';
import type { HistoryItem, DownloadConfig } from '@/types';

const ITEMS_PER_PAGE = 20;

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRedownload?: (config: DownloadConfig) => void;
}

export function HistoryPanel({ isOpen, onClose, onRedownload }: HistoryPanelProps) {
  const { t } = useTranslation();
  const { info } = useToast();
  const {
    items,
    stats,
    isLoading,
    removeItem,
    clearHistory,
    formatBytes,
    formatDuration,
    addToHistory,
  } = useHistory();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [lastDeleted, setLastDeleted] = useState<HistoryItem | null>(null);

  // Filter items based on search and status with memoization
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.url.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        filter === 'all' ||
        (filter === 'completed' && item.status === 'completed') ||
        (filter === 'failed' && item.status === 'failed');

      return matchesSearch && matchesFilter;
    });
  }, [items, searchQuery, filter]);

  // Virtualized items (lazy loading)
  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount);
  }, [filteredItems, visibleCount]);

  const hasMore = visibleCount < filteredItems.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredItems.length));
  }, [filteredItems.length]);

  // Undo delete functionality
  const handleRemoveWithUndo = useCallback(async (item: HistoryItem) => {
    setLastDeleted(item);
    await removeItem(item.id);
    
    // Auto-clear undo after 5 seconds
    setTimeout(() => setLastDeleted(null), 5000);
  }, [removeItem]);

  const handleUndo = useCallback(async () => {
    if (lastDeleted) {
      await addToHistory(
        { url: lastDeleted.url, format: lastDeleted.format as any, quality: lastDeleted.quality as any, outputFolder: '', embedSubtitles: false, cookiesFromBrowser: null },
        lastDeleted.title,
        lastDeleted.thumbnail,
        lastDeleted.filePath,
        lastDeleted.fileSize,
        lastDeleted.duration,
        lastDeleted.status,
        lastDeleted.error
      );
      setLastDeleted(null);
      info(t('toast.undoSuccess'));
    }
  }, [lastDeleted, addToHistory, info, t]);

  const handleOpenFile = async (filePath: string) => {
    try {
      await invoke('open_file', { path: filePath });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const handleOpenFolder = async (filePath: string) => {
    const folderPath = filePath.substring(0, filePath.lastIndexOf('\\'));
    try {
      await invoke('open_folder', { path: folderPath });
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  const handleRedownload = (item: HistoryItem) => {
    if (onRedownload) {
      const config: DownloadConfig = {
        url: item.url,
        format: item.format as DownloadConfig['format'],
        quality: item.quality as DownloadConfig['quality'],
        outputFolder: item.filePath
          ? item.filePath.substring(0, item.filePath.lastIndexOf('\\'))
          : '',
        embedSubtitles: false,
        cookiesFromBrowser: null,
      };
      onRedownload(config);
      onClose();
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) {
      return `${t('history.today')} ${timeStr}`;
    } else if (diffDays === 1) {
      return `${t('history.yesterday')} ${timeStr}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-background shadow-xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">{t('history.title')}</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-4 border-b border-border px-6 py-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                      <Download className="h-5 w-5" />
                      {stats.totalDownloads}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('history.totalDownloads')}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-500">
                      <HardDrive className="h-5 w-5" />
                      {formatBytes(stats.totalBytesDownloaded)}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('history.totalSize')}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-2xl font-bold text-blue-500">
                      <Clock className="h-5 w-5" />
                      {formatDuration(stats.totalDurationSeconds)}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('history.totalDuration')}</div>
                  </div>
                </div>
              )}

              {/* Search and Filter */}
              <div className="flex gap-2 border-b border-border px-6 py-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={t('form.urlPlaceholder').split(' ')[0] + '...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">{t('queue.title').split(' ')[0]}</option>
                  <option value="completed">{t('history.successful')}</option>
                  <option value="failed">{t('history.failedCount')}</option>
                </select>
              </div>

              {/* History List */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {isLoading ? (
                  <SkeletonList count={3} ItemComponent={SkeletonHistoryItem} />
                ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <History className="mb-2 h-12 w-12 opacity-50" />
                    <p>
                      {searchQuery || filter !== 'all'
                        ? t('history.noResults')
                        : t('history.empty')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleItems.map((item) => (
                      <HistoryItemCard
                        key={item.id}
                        item={item}
                        onOpenFile={handleOpenFile}
                        onOpenFolder={handleOpenFolder}
                        onRedownload={() => handleRedownload(item)}
                        onRemove={() => handleRemoveWithUndo(item)}
                        formatDate={formatDate}
                        formatBytes={formatBytes}
                      />
                    ))}
                    
                    {/* Load more button for virtualization */}
                    {hasMore && (
                      <Button variant="outline" onClick={loadMore} className="w-full mt-4">
                        {t('history.loadMore', { count: filteredItems.length - visibleCount })}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Undo banner */}
              <AnimatePresence>
                {lastDeleted && (
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="absolute bottom-20 left-4 right-4 flex items-center justify-between rounded-lg bg-card border border-border p-3 shadow-lg"
                  >
                    <span className="text-sm">{t('history.itemDeleted')}</span>
                    <Button variant="ghost" size="sm" onClick={handleUndo}>
                      <Undo2 className="mr-1 h-4 w-4" />
                      {t('buttons.undo')}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              {items.length > 0 && (
                <div className="border-t border-border px-6 py-4">
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={clearHistory}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('history.clearHistory')}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface HistoryItemCardProps {
  item: HistoryItem;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onRedownload: () => void;
  onRemove: () => void;
  formatDate: (timestamp: number) => string;
  formatBytes: (bytes: number) => string;
}

function HistoryItemCard({
  item,
  onOpenFile,
  onOpenFolder,
  onRedownload,
  onRemove,
  formatDate,
  formatBytes,
}: HistoryItemCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-lg border border-border bg-card p-3"
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded bg-muted">
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Play className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          {/* Status badge */}
          <div
            className={`absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              item.status === 'completed'
                ? 'bg-green-500/90 text-white'
                : 'bg-red-500/90 text-white'
            }`}
          >
            {item.status === 'completed' ? (
              <CheckCircle className="inline h-3 w-3" />
            ) : (
              <XCircle className="inline h-3 w-3" />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-medium" title={item.title}>
            {item.title}
          </h3>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{item.format}</span>
            <span>•</span>
            <span>{item.quality}</span>
            {item.fileSize && (
              <>
                <span>•</span>
                <span>{formatBytes(item.fileSize)}</span>
              </>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatDate(item.downloadedAt)}
          </div>
          {item.error && (
            <div className="mt-1 text-xs text-destructive truncate" title={item.error}>
              {item.error}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-2 flex gap-1">
        {item.status === 'completed' && item.filePath && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onOpenFile(item.filePath!)}
            >
              <Play className="mr-1 h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onOpenFolder(item.filePath!)}
            >
              <ExternalLink className="mr-1 h-3 w-3" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onRedownload}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}
