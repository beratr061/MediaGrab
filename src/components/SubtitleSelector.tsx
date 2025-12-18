import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Subtitles,
  RefreshCw,
  CheckSquare,
  Square,
  Globe,
  Sparkles,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import type { SubtitleInfo, SubtitleTrack, SubtitleOptions } from '@/types';

interface SubtitleSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  options: SubtitleOptions;
  onOptionsChange: (options: SubtitleOptions) => void;
}

export function SubtitleSelector({
  isOpen,
  onClose,
  url,
  options,
  onOptionsChange,
}: SubtitleSelectorProps) {
  const [subtitleInfo, setSubtitleInfo] = useState<SubtitleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch subtitles when opened
  useEffect(() => {
    if (isOpen && url) {
      fetchSubtitles();
    }
  }, [isOpen, url]);

  const fetchSubtitles = async () => {
    if (!url) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const info = await invoke<SubtitleInfo>('fetch_subtitles', { url });
      setSubtitleInfo(info);
    } catch (err) {
      console.error('Failed to fetch subtitles:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLanguage = useCallback((langCode: string) => {
    const newLanguages = options.languages.includes(langCode)
      ? options.languages.filter((l) => l !== langCode)
      : [...options.languages, langCode];
    
    onOptionsChange({ ...options, languages: newLanguages });
  }, [options, onOptionsChange]);

  const selectAllManual = useCallback(() => {
    if (!subtitleInfo) return;
    const allManual = subtitleInfo.subtitles.map((s) => s.langCode);
    onOptionsChange({ ...options, languages: allManual });
  }, [subtitleInfo, options, onOptionsChange]);

  const clearSelection = useCallback(() => {
    onOptionsChange({ ...options, languages: [] });
  }, [options, onOptionsChange]);

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
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-background shadow-xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <Subtitles className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Altyazı Seçenekleri</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Options */}
              <div className="border-b border-border px-6 py-4 space-y-4">
                {/* Download/Embed toggles */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.downloadSubtitles}
                      onChange={(e) =>
                        onOptionsChange({ ...options, downloadSubtitles: e.target.checked })
                      }
                      className="rounded border-input"
                    />
                    <span className="text-sm">Ayrı dosya olarak indir</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.embedSubtitles}
                      onChange={(e) =>
                        onOptionsChange({ ...options, embedSubtitles: e.target.checked })
                      }
                      className="rounded border-input"
                    />
                    <span className="text-sm">Videoya göm</span>
                  </label>
                </div>

                {/* Format selection */}
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Format:</span>
                  <div className="flex gap-2">
                    {(['srt', 'vtt', 'ass'] as const).map((fmt) => (
                      <Button
                        key={fmt}
                        variant={options.format === fmt ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onOptionsChange({ ...options, format: fmt })}
                      >
                        {fmt.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Include auto-generated */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeAuto}
                    onChange={(e) =>
                      onOptionsChange({ ...options, includeAuto: e.target.checked })
                    }
                    className="rounded border-input"
                  />
                  <span className="text-sm">Otomatik oluşturulan altyazıları dahil et</span>
                </label>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <div className="text-center py-12 text-destructive">
                    <p>{error}</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={fetchSubtitles}>
                      Tekrar Dene
                    </Button>
                  </div>
                ) : subtitleInfo ? (
                  <div className="space-y-6">
                    {/* Selection controls */}
                    {subtitleInfo.subtitles.length > 0 && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllManual}>
                          Tümünü Seç
                        </Button>
                        <Button variant="outline" size="sm" onClick={clearSelection}>
                          Seçimi Temizle
                        </Button>
                      </div>
                    )}

                    {/* Manual subtitles */}
                    {subtitleInfo.subtitles.length > 0 && (
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
                          <Globe className="h-4 w-4" />
                          Manuel Altyazılar ({subtitleInfo.subtitles.length})
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {subtitleInfo.subtitles.map((track) => (
                            <SubtitleTrackItem
                              key={track.langCode}
                              track={track}
                              isSelected={options.languages.includes(track.langCode)}
                              onToggle={() => toggleLanguage(track.langCode)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Auto-generated captions */}
                    {options.includeAuto && subtitleInfo.automaticCaptions.length > 0 && (
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-medium mb-3">
                          <Sparkles className="h-4 w-4" />
                          Otomatik Altyazılar ({subtitleInfo.automaticCaptions.length})
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                          {subtitleInfo.automaticCaptions.map((track) => (
                            <SubtitleTrackItem
                              key={`auto-${track.langCode}`}
                              track={track}
                              isSelected={options.languages.includes(track.langCode)}
                              onToggle={() => toggleLanguage(track.langCode)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No subtitles */}
                    {!subtitleInfo.hasSubtitles && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Subtitles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Bu video için altyazı bulunamadı</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Altyazıları yüklemek için bir URL girin</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-6 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {options.languages.length > 0
                      ? `${options.languages.length} dil seçili`
                      : 'Tüm diller indirilecek'}
                  </span>
                  <Button onClick={onClose}>Tamam</Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface SubtitleTrackItemProps {
  track: SubtitleTrack;
  isSelected: boolean;
  onToggle: () => void;
}

function SubtitleTrackItem({ track, isSelected, onToggle }: SubtitleTrackItemProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      }`}
    >
      {isSelected ? (
        <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{track.langName}</p>
        <p className="text-xs text-muted-foreground">{track.langCode}</p>
      </div>
    </button>
  );
}
