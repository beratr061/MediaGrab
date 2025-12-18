import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ListVideo,
  Download,
  CheckSquare,
  Square,
  Clock,
  RefreshCw,
  Play,
} from 'lucide-react';
import { Button } from './ui/button';
import type { PlaylistInfo, PlaylistEntry, DownloadConfig, Format, Quality } from '@/types';

interface PlaylistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  playlistInfo: PlaylistInfo | null;
  isLoading: boolean;
  onDownloadSelected: (entries: PlaylistEntry[], config: Omit<DownloadConfig, 'url'>) => void;
  format: Format;
  quality: Quality;
  outputFolder: string;
  embedSubtitles: boolean;
  cookiesFromBrowser: string | null;
}

export function PlaylistPanel({
  isOpen,
  onClose,
  playlistInfo,
  isLoading,
  onDownloadSelected,
  format,
  quality,
  outputFolder,
  embedSubtitles,
  cookiesFromBrowser,
}: PlaylistPanelProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Select/deselect all
  const handleSelectAll = useCallback(() => {
    if (!playlistInfo) return;
    if (selectedIds.size === playlistInfo.entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(playlistInfo.entries.map((e) => e.id)));
    }
  }, [playlistInfo, selectedIds.size]);

  // Toggle single item
  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Download selected
  const handleDownload = useCallback(() => {
    if (!playlistInfo || selectedIds.size === 0) return;
    const selectedEntries = playlistInfo.entries.filter((e) => selectedIds.has(e.id));
    onDownloadSelected(selectedEntries, {
      format,
      quality,
      outputFolder,
      embedSubtitles,
      cookiesFromBrowser,
    });
    onClose();
  }, [playlistInfo, selectedIds, format, quality, outputFolder, embedSubtitles, cookiesFromBrowser, onDownloadSelected, onClose]);

  // Format duration
  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate total duration of selected
  const totalDuration = playlistInfo?.entries
    .filter((e) => selectedIds.has(e.id))
    .reduce((sum, e) => sum + (e.duration || 0), 0) || 0;

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
            className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-background shadow-xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <ListVideo className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Playlist</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : playlistInfo ? (
                <>
                  {/* Playlist Info */}
                  <div className="border-b border-border px-6 py-4">
                    <div className="flex gap-4">
                      {playlistInfo.thumbnail && (
                        <img
                          src={playlistInfo.thumbnail}
                          alt={playlistInfo.title}
                          className="h-20 w-32 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{playlistInfo.title}</h3>
                        {playlistInfo.uploader && (
                          <p className="text-sm text-muted-foreground">{playlistInfo.uploader}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {playlistInfo.videoCount} video
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Selection Controls */}
                  <div className="flex items-center justify-between border-b border-border px-6 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="gap-2"
                    >
                      {selectedIds.size === playlistInfo.entries.length ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      {selectedIds.size === playlistInfo.entries.length
                        ? 'Seçimi Kaldır'
                        : 'Tümünü Seç'}
                    </Button>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{selectedIds.size} seçili</span>
                      {selectedIds.size > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.floor(totalDuration / 60)} dk
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Video List */}
                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="space-y-2">
                      {playlistInfo.entries.map((entry) => (
                        <PlaylistEntryCard
                          key={entry.id}
                          entry={entry}
                          isSelected={selectedIds.has(entry.id)}
                          onToggle={() => toggleItem(entry.id)}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-border px-6 py-4">
                    <Button
                      className="w-full"
                      disabled={selectedIds.size === 0}
                      onClick={handleDownload}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {selectedIds.size} Video İndir
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-muted-foreground">
                  <p>Playlist bilgisi yüklenemedi</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface PlaylistEntryCardProps {
  entry: PlaylistEntry;
  isSelected: boolean;
  onToggle: () => void;
  formatDuration: (seconds: number | null) => string;
}

function PlaylistEntryCard({
  entry,
  isSelected,
  onToggle,
  formatDuration,
}: PlaylistEntryCardProps) {
  return (
    <motion.div
      layout
      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      }`}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div className="shrink-0">
        {isSelected ? (
          <CheckSquare className="h-5 w-5 text-primary" />
        ) : (
          <Square className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Index */}
      <span className="w-6 shrink-0 text-center text-sm text-muted-foreground">
        {entry.playlistIndex}
      </span>

      {/* Thumbnail */}
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-muted">
        {entry.thumbnail ? (
          <img
            src={entry.thumbnail}
            alt={entry.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {entry.duration && (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[10px] text-white">
            {formatDuration(entry.duration)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={entry.title}>
          {entry.title}
        </p>
        {entry.uploader && (
          <p className="truncate text-xs text-muted-foreground">{entry.uploader}</p>
        )}
      </div>
    </motion.div>
  );
}
