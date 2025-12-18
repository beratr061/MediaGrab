import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trash2,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FolderOpen,
  ListX,
} from 'lucide-react';
import { Button } from './ui/button';
import { QueueItemCard } from './QueueItemCard';
import { useQueue } from '@/hooks/useQueue';
import { cn } from '@/lib/utils';

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QueuePanel({ isOpen, onClose }: QueuePanelProps) {
  const {
    items,
    isLoading,
    cancelItem,
    removeItem,
    clearCompleted,
    moveUp,
    moveDown,
    pendingCount,
    activeCount,
    completedCount,
    failedCount,
  } = useQueue();

  const hasCompletedOrFailed = completedCount > 0 || failedCount > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-border bg-background shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Download Queue"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Download Queue</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {activeCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {activeCount}
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {pendingCount}
                    </span>
                  )}
                  {completedCount > 0 && (
                    <span className="flex items-center gap-1 text-green-500">
                      <CheckCircle className="h-3 w-3" />
                      {completedCount}
                    </span>
                  )}
                  {failedCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="h-3 w-3" />
                      {failedCount}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close queue panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Actions */}
            {hasCompletedOrFailed && (
              <div className="border-b border-border px-4 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearCompleted}
                  className="w-full"
                >
                  <ListX className="mr-2 h-4 w-4" />
                  Clear Completed
                </Button>
              </div>
            )}

            {/* Queue Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Queue is empty
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Add URLs to start downloading
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.2 }}
                      >
                        <QueueItemCard
                          item={item}
                          onCancel={() => cancelItem(item.id)}
                          onRemove={() => removeItem(item.id)}
                          onMoveUp={index > 0 ? () => moveUp(item.id) : undefined}
                          onMoveDown={
                            index < items.length - 1
                              ? () => moveDown(item.id)
                              : undefined
                          }
                        />
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
