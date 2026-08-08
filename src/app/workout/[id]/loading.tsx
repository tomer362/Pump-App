import { Skeleton } from "@/components/ui/skeleton";

/**
 * The workout screen lives outside the tab-bar group and fills the viewport,
 * so its fallback mirrors the header + data table rather than the card shapes
 * the browsing routes use.
 */
export default function WorkoutLoading() {
  return (
    <div className="pt-safe">
      <div className="hairline-b px-4 pb-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-2 h-3 w-1/4" />
      </div>
      <div className="space-y-6 px-4 pt-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-2/5" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-9 w-full rounded-[8px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
