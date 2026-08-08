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

/**
 * A chart-sized block inside a card. Streaming boundaries want a fallback the
 * same height as what replaces it — a short placeholder swapping for a tall
 * chart reflows the page under a thumb that is already scrolling.
 */
export function SkeletonChartCard({
  height = "11rem",
  label = true,
}: {
  height?: string;
  label?: boolean;
}) {
  return (
    <div>
      {label && <Skeleton className="mb-2 ml-1 h-3 w-24" />}
      <div className="border-hairline bg-surface-1 rounded-card border px-4 py-4">
        <Skeleton className="w-full rounded-[12px]" style={{ height }} />
      </div>
    </div>
  );
}

/** The one hero figure a stats-shaped screen leads with. */
export function SkeletonStatHero() {
  return (
    <div className="border-hairline bg-surface-1 rounded-card border px-4 py-5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-2 h-11 w-3/5 rounded-xl" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Segmented-control placeholder, for tabbed panels that stream their body. */
export function SkeletonSegmented() {
  return <Skeleton className="h-9 w-full rounded-[12px]" />;
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
