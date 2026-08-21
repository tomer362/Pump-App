import type { RepMax } from "@/lib/queries/exercise";
import { formatWeight } from "@/lib/utils";

/**
 * Heaviest weight lifted at each rep count.
 *
 * A table, not a chart: rep count is a small ordinal set and the useful
 * operation is reading off a single row ("what have I done for 5?"), not
 * comparing a shape. Bar lengths would double-encode a number you can just
 * print.
 *
 * On an assisted machine every column here inverts or disappears: the row worth
 * keeping is the one that needed the *least* counterweight (the query already
 * orders it that way), and there is no 1RM to estimate from help received — so
 * that column goes rather than printing a number for being weak.
 */
export function RepMaxTable({
  rows,
  unit,
  assisted = false,
}: {
  rows: RepMax[];
  unit: "kg" | "lb";
  assisted?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-text-3 py-6 text-center text-[14px]">
        {assisted
          ? "No assisted sets logged yet."
          : "No weighted sets logged yet."}
      </p>
    );
  }

  return (
    <div className="divide-hairline divide-y">
      <div className="text-text-3 flex items-center gap-3 pb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
        <span className="w-12">Reps</span>
        <span className="flex-1">{assisted ? "Least assist" : "Best"}</span>
        {!assisted && <span>Est. 1RM</span>}
      </div>
      {rows.map((r) => (
        <div key={r.reps} className="flex items-baseline gap-3 py-2.5">
          <span className="num text-text-2 w-12 text-[14px]">{r.reps}</span>
          <span className="num flex-1 text-[15px] font-bold">
            {assisted && "−"}
            {formatWeight(r.weightKg, unit)}
            <span className="text-text-3 ml-0.5 text-[12px] font-medium">
              {unit}
            </span>
          </span>
          {!assisted && (
            <span className="num text-text-2 text-[14px]">
              {r.estimated1rm == null ? (
                "—"
              ) : (
                <>
                  {formatWeight(r.estimated1rm, unit)}
                  <span className="text-text-3 ml-0.5 text-[11px]">{unit}</span>
                </>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
