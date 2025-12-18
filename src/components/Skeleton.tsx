import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  );
}

// Pre-built skeleton components for common use cases
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex gap-4">
        <Skeleton className="h-20 w-32 shrink-0 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonQueueItem({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-20 rounded" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonHistoryItem({ className }: SkeletonProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-3", className)}>
      <div className="flex gap-3">
        <Skeleton className="h-16 w-28 shrink-0 rounded" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-2 flex gap-1">
        <Skeleton className="h-7 w-16 rounded" />
        <Skeleton className="h-7 w-16 rounded" />
        <Skeleton className="h-7 w-20 rounded" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3, ItemComponent = SkeletonCard }: { count?: number; ItemComponent?: React.ComponentType<SkeletonProps> }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ItemComponent key={i} />
      ))}
    </div>
  );
}
