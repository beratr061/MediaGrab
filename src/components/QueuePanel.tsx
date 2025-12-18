import { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, CheckCircle, XCircle, Clock, Loader2, FolderOpen, ListX, Pause, Play, CheckSquare, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { QueueItemCard } from './QueueItemCard';
import { SkeletonQueueItem, SkeletonList } from './Skeleton';
import { useQueue } from '@/hooks/useQueue';
import { cn } from '@/lib/utils';
import type { QueueItem } from '@/types';

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QueuePanel({ isOpen, onClose }: QueuePanelProps) {
  const { t } = useTranslation();
  const { items, isLoading, cancelItem, removeItem, clearCompleted, moveUp, moveDown, reorderItems, pauseAll, resumeAll, pendingCount, activeCount, completedCount, failedCount } = useQueue();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  const hasCompletedOrFailed = completedCount > 0 || failedCount > 0;
  const hasPending = pendingCount > 0;
  const hasActive = activeCount > 0;
  const hasSelection = selectedIds.size > 0;

  // Calculate estimated total time
  const estimatedTotalTime = items.filter(i => i.status === 'pending' || i.status === 'downloading').reduce((acc, item) => acc + (item.etaSeconds || 0), 0);

  const formatTotalTime = (seconds: number) => {
    if (seconds <= 0) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `~${hours}h ${minutes}m`;
    return `~${minutes}m`;
  };

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.filter(i => i.status === 'pending').map(i => i.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const cancelSelected = useCallback(async () => {
    for (const id of selectedIds) {
      await cancelItem(id);
    }
    setSelectedIds(new Set());
  }, [selectedIds, cancelItem]);

  const handleReorder = useCallback((newOrder: QueueItem[]) => {
    if (reorderItems) {
      reorderItems(newOrder.map(i => i.id));
    }
  }, [reorderItems]);

  // Separate items by status for drag constraints
  const pendingItems = items.filter(i => i.status === 'pending');
  const activeItems = items.filter(i => i.status === 'downloading' || i.status === 'merging');
  const terminalItems = items.filter(i => i.status === 'completed' || i.status === 'failed' || i.status === 'cancelled');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-border bg-background shadow-xl flex flex-col" role="dialog" aria-modal="true" aria-label={t('queue.title')}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">{t('queue.title')}</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {activeCount > 0 && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{activeCount}</span>}
                  {pendingCount > 0 && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pendingCount}</span>}
                  {completedCount > 0 && <span className="flex items-center gap-1 text-green-500"><CheckCircle className="h-3 w-3" />{completedCount}</span>}
                  {failedCount > 0 && <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" />{failedCount}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close queue panel"><X className="h-4 w-4" /></Button>
            </div>

            {/* Estimated time */}
            {estimatedTotalTime > 0 && (
              <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground">
                {t('queue.estimatedTime', { time: formatTotalTime(estimatedTotalTime) })}
              </div>
            )}

            {/* Bulk Actions */}
            {(hasPending || hasCompletedOrFailed || hasSelection) && (
              <div className="border-b border-border px-4 py-2 flex flex-wrap gap-2">
                {hasPending && !hasSelection && (
                  <>
                    <Button variant="outline" size="sm" onClick={selectAll}><CheckSquare className="mr-1 h-3 w-3" />{t('queue.selectAll')}</Button>
                    {hasActive ? (
                      <Button variant="outline" size="sm" onClick={pauseAll}><Pause className="mr-1 h-3 w-3" />{t('queue.pauseAll')}</Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={resumeAll}><Play className="mr-1 h-3 w-3" />{t('queue.resumeAll')}</Button>
                    )}
                  </>
                )}
                {hasSelection && (
                  <>
                    <Button variant="outline" size="sm" onClick={deselectAll}><Square className="mr-1 h-3 w-3" />{t('queue.deselectAll')}</Button>
                    <Button variant="outline" size="sm" onClick={cancelSelected} className="text-destructive"><X className="mr-1 h-3 w-3" />{t('queue.cancelSelected', { count: selectedIds.size })}</Button>
                  </>
                )}
                {hasCompletedOrFailed && !hasSelection && (
                  <Button variant="outline" size="sm" onClick={clearCompleted}><ListX className="mr-1 h-3 w-3" />{t('queue.clearCompleted')}</Button>
                )}
              </div>
            )}

            {/* Queue Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <SkeletonList count={3} ItemComponent={SkeletonQueueItem} />
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">{t('queue.empty')}</p>
                  <p className="text-xs text-muted-foreground/70">{t('queue.emptyDescription')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Active items (not draggable) */}
                  {activeItems.map((item) => (
                    <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 0.2 }}>
                      <QueueItemCard item={item} onCancel={() => cancelItem(item.id)} onRemove={() => removeItem(item.id)} />
                    </motion.div>
                  ))}

                  {/* Pending items (draggable) */}
                  {pendingItems.length > 0 && (
                    <Reorder.Group axis="y" values={pendingItems} onReorder={handleReorder} className="space-y-3">
                      {pendingItems.map((item, index) => (
                        <Reorder.Item key={item.id} value={item} onDragStart={() => setIsDragging(true)} onDragEnd={() => setIsDragging(false)} className={cn("cursor-grab active:cursor-grabbing", isDragging && "z-10")}>
                          <div className="flex items-start gap-2">
                            <button onClick={() => toggleSelect(item.id)} className="mt-3 p-1 hover:bg-muted rounded transition-colors">
                              {selectedIds.has(item.id) ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                            </button>
                            <div className="flex-1">
                              <QueueItemCard item={item} onCancel={() => cancelItem(item.id)} onRemove={() => removeItem(item.id)} onMoveUp={index > 0 ? () => moveUp(item.id) : undefined} onMoveDown={index < pendingItems.length - 1 ? () => moveDown(item.id) : undefined} showDragHandle />
                            </div>
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}

                  {/* Terminal items */}
                  <AnimatePresence mode="popLayout">
                    {terminalItems.map((item) => (
                      <motion.div key={item.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -100 }} transition={{ duration: 0.2 }}>
                        <QueueItemCard item={item} onCancel={() => cancelItem(item.id)} onRemove={() => removeItem(item.id)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
