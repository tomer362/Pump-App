import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import type { RecentRecord } from "@/lib/queries/stats";
import { formatWeight } from "@/lib/utils";

const KIND: Record<string, { label: string; weighted: boolean }> = {
  "1rm": { label: "Est. 1RM", weighted: true },
  weight: { label: "Heaviest", weighted: true },
  volume: { label: "Set volume", weighted: true },
  reps: { label: "Most reps", weighted: false },
};

/**
 * Records you set most recently, newest first.
 *
 * `personal_record` holds one row per exercise and kind, upserted as they
 * improve, so this reads as "what you've moved lately" rather than a log of
 * every record ever set. Gold always ships with the trophy — it is not
 * distinguishable from volt for a deuteranopic reader on its own.
 */
export function PrTimeline({
  records,
  unit,
}: {
  records: RecentRecord[];
  unit: "kg" | "lb";
}) {
  if (records.length === 0) {
    return (
      <p className="text-text-3 px-4 py-6 text-center text-[14px]">
        No records yet — finish a working set and the first one lands here.
      </p>
    );
  }

  return (
    <div className="divide-hairline divide-y">
      {records.map((r) => {
        const meta = KIND[r.kind] ?? { label: r.kind, weighted: true };
        return (
          <Link
            key={r.id}
            href={`/exercises/${r.exerciseId}`}
            className="press flex items-center gap-3 px-4 py-3"
          >
            <span className="bg-pr-fade text-pr grid size-8 shrink-0 place-items-center rounded-full">
              <Trophy className="size-4" strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">
                {r.exerciseName}
              </p>
              <p className="text-text-3 num text-[12px]">
                {meta.label} ·{" "}
                {r.achievedAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                })}
              </p>
            </div>
            <p className="num shrink-0 text-[15px] font-bold">
              {meta.weighted ? formatWeight(r.value, unit) : Math.round(r.value)}
              {meta.weighted && (
                <span className="text-text-3 ml-0.5 text-[12px]">{unit}</span>
              )}
            </p>
            <ChevronRight className="text-text-3 size-4 shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
