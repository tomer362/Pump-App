import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { formatWeight, formatDate } from "@/lib/utils";

export type RecordRow = {
  id: string;
  kind: string;
  value: number;
  weightKg: number | null;
  reps: number | null;
  achievedAt: Date;
};

const KIND: Record<string, { label: string; weighted: boolean }> = {
  "1rm": { label: "Est. 1RM", weighted: true },
  weight: { label: "Heaviest weight", weighted: true },
  volume: { label: "Best set volume", weighted: true },
  reps: { label: "Most reps", weighted: false },
};

const ORDER = ["1rm", "weight", "volume", "reps"];

/**
 * The four records for one exercise.
 *
 * PR gold never carries meaning on its own — it sits within ΔE 4.1 of volt for
 * a deuteranopic reader — so every card ships the trophy and the letters "PR"
 * alongside it.
 */
export function RecordsGrid({
  records,
  unit,
}: {
  records: RecordRow[];
  unit: "kg" | "lb";
}) {
  const sorted = [...records].sort(
    (a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind),
  );

  if (sorted.length === 0) {
    return (
      <p className="text-text-3 py-6 text-center text-[14px]">
        Finish a working set and your records appear here.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {sorted.map((r) => {
        const meta = KIND[r.kind] ?? { label: r.kind, weighted: true };
        return (
          <Card key={r.id} className="px-4 py-3.5">
            <div className="text-pr flex items-center gap-1.5">
              <Trophy className="size-3.5 shrink-0" strokeWidth={2.4} />
              <span className="text-[10px] font-bold tracking-[0.1em]">PR</span>
            </div>
            <p className="text-text-3 mt-1.5 text-[11px]">{meta.label}</p>
            <p className="num mt-0.5 text-[20px] leading-none font-bold">
              {meta.weighted ? formatWeight(r.value, unit) : Math.round(r.value)}
              {meta.weighted && (
                <span className="text-text-3 ml-0.5 text-[12px] font-medium">
                  {unit}
                </span>
              )}
            </p>
            <p className="text-text-3 num mt-1.5 text-[11px]">
              {r.weightKg != null && r.reps != null
                ? `${formatWeight(r.weightKg, unit)}${unit} × ${r.reps} · `
                : ""}
              {formatDate(r.achievedAt)}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
