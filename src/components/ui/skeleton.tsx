import { cn } from "@/lib/utils";

/**
 * Placeholder block. Grayscale on purpose — the accent is reserved for real
 * state, and a shimmering volt skeleton would read as something happening.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-surface-2 animate-pulse rounded-[10px]", className)}
      {...props}
    />
  );
}

/** Large-title header placeholder, matching NavBar's collapsed metrics. */
export function SkeletonHeader({ width = "40%" }: { width?: string }) {
  return (
    <div className="px-4 pt-safe">
      <div className="h-11" />
      <Skeleton className="h-9 rounded-xl" style={{ width }} />
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-hairline bg-surface-1 rounded-card space-y-3 border p-4",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-16 w-full rounded-[12px]" />
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border-hairline bg-surface-1 rounded-card divide-hairline divide-y border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}
