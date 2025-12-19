import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Plus, Trash2, Play, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { validateUrl } from '@/lib/validation';
import { cn } from '@/lib/utils';
import type { Format, Quality, ScheduledDownload } from '@/types';

interface ScheduleDownloadProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledDownloads: ScheduledDownload[];
  onSchedule: (download: Omit<ScheduledDownload, 'id'>) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
  currentFormat: Format;
  currentQuality: Quality;
}

export function ScheduleDownload({
  isOpen,
  onClose,
  scheduledDownloads,
  onSchedule,
  onRemove,
  onToggle,
  currentFormat,
  currentQuality,
}: ScheduleDownloadProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [format, setFormat] = useState<Format>(currentFormat);
  const [quality, setQuality] = useState<Quality>(currentQuality);
  const [error, setError] = useState<string | null>(null);

  // Set default date/time to now + 1 hour
  useEffect(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    if (dateStr) setDate(dateStr);
    if (timeStr) setTime(timeStr);
  }, [isOpen]);

  const handleSchedule = useCallback(() => {
    const validation = validateUrl(url);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid URL');
      return;
    }

    if (!date || !time) {
      setError('Please select date and time');
      return;
    }

    const scheduledTime = new Date(`${date}T${time}`).getTime();
    if (scheduledTime <= Date.now()) {
      setError('Scheduled time must be in the future');
      return;
    }

    onSchedule({
      url: validation.sanitizedUrl || url,
      format,
      quality,
      scheduledTime,
      enabled: true,
    });

    setUrl('');
    setError(null);
  }, [url, date, time, format, quality, onSchedule]);

  const formatScheduledTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getTimeRemaining = (timestamp: number) => {
    const diff = timestamp - Date.now();
    if (diff <= 0) return t('schedule.startingSoon', 'Starting soon...');
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-6 shadow-xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('schedule.title', 'Schedule Downloads')}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Add new scheduled download */}
            <div className="space-y-3 mb-6 p-4 rounded-lg bg-muted/50">
              <h3 className="text-sm font-medium">{t('schedule.addNew', 'Add New Schedule')}</h3>
              
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(null); }}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('schedule.date', 'Date')}</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('schedule.time', 'Time')}</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('form.format', 'Format')}</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as Format)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="video-mp4">MP4</option>
                    <option value="video-webm">WebM</option>
                    <option value="audio-mp3">MP3</option>
                    <option value="audio-best">{t('formatOptions.bestAudio', 'Best Audio')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('form.quality', 'Quality')}</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as Quality)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="best">Best</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                  </select>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button onClick={handleSchedule} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                {t('schedule.add', 'Add to Schedule')}
              </Button>
            </div>

            {/* Scheduled downloads list */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t('schedule.upcoming', 'Upcoming Downloads')}</h3>
              
              {scheduledDownloads.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t('schedule.empty', 'No scheduled downloads')}
                </p>
              ) : (
                <div className="space-y-2">
                  {scheduledDownloads.map((download) => (
                    <div
                      key={download.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        download.enabled ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{download.url}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatScheduledTime(download.scheduledTime)}</span>
                          <span>•</span>
                          <span className="text-primary">{getTimeRemaining(download.scheduledTime)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onToggle(download.id)}
                          title={download.enabled ? t('schedule.pause', 'Pause') : t('schedule.resume', 'Resume')}
                        >
                          {download.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemove(download.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
