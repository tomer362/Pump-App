"use client";

import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/primitives";
import { cn, kgToLb, lbToKg } from "@/lib/utils";

/**
 * Everything here is arithmetic in the *display* unit. A pound lifter is
 * standing at a bar of 45 lb plates, and the old version stepped the target
 * by 2.5 kg (5.5 lb) and stacked metric plates, so no round pound figure was
 * ever reachable and the sleeve it drew was one nobody had. Weights still
 * enter and leave as kilograms, converted at the edge like everywhere else.
 */
const LADDERS = {
  kg: {
    bars: [20, 15, 10, 7.5],
    plates: [25, 20, 15, 10, 5, 2.5, 1.25],
    step: 2.5,
    heaviest: 25,
  },
  lb: {
    bars: [45, 35, 25, 15],
    plates: [45, 35, 25, 10, 5, 2.5],
    step: 5,
    heaviest: 45,
  },
} as const;

/** IWF colours for kilo plates; the common cast-iron greys for pounds. */
const PLATE_COLOR: Record<"kg" | "lb", Record<number, string>> = {
  kg: {
    25: "bg-[#c62828] text-white",
    20: "bg-[#1565c0] text-white",
    15: "bg-[#f9a825] text-black",
    10: "bg-[#2e7d32] text-white",
    5: "bg-[#e0e0e0] text-black",
    2.5: "bg-[#212121] text-white ring-1 ring-white/25",
    1.25: "bg-[#9e9e9e] text-black",
  },
  lb: {
    45: "bg-[#212121] text-white ring-1 ring-white/25",
    35: "bg-[#37474f] text-white",
    25: "bg-[#546e7a] text-white",
    10: "bg-[#78909c] text-black",
    5: "bg-[#b0bec5] text-black",
    2.5: "bg-[#e0e0e0] text-black",
  },
};

function toDisplay(kg: number, unit: "kg" | "lb") {
  return unit === "kg" ? kg : kgToLb(kg);
}

function trim(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Which plates go on each side to hit the target. Greedy over the standard
 * ladder, which is exactly how you'd load a bar in practice.
 */
export function PlateCalculator({
  targetKg,
  unit,
}: {
  targetKg: number;
  unit: "kg" | "lb";
}) {
  const ladder = LADDERS[unit];
  const [bar, setBar] = useState<number>(ladder.bars[0]);
  // Snapped to the unit's step on the way in, so a 100 kg target reads as
  // 220 lb and not 220.46 lb, and the −/+ buttons then move by whole steps.
  const [target, setTarget] = useState(() => {
    const shown = toDisplay(targetKg, unit);
    return trim(Math.round(shown / ladder.step) * ladder.step);
  });

  const { perSide, remainder } = useMemo(() => {
    let side = (target - bar) / 2;
    if (side <= 0) return { perSide: [] as number[], remainder: 0 };
    const out: number[] = [];
    for (const p of ladder.plates) {
      while (side >= p - 1e-9) {
        out.push(p);
        side -= p;
      }
    }
    return { perSide: out, remainder: trim(side) };
  }, [target, bar, ladder]);

  const loaded = bar + perSide.reduce((a, b) => a + b, 0) * 2;

  return (
    <div className="px-4 pb-5">
      <div className="mb-4">
        <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
          Bar weight
        </p>
        <Segmented
          value={String(bar)}
          onChange={(v) => setBar(Number(v))}
          options={ladder.bars.map((b) => ({
            value: String(b),
            label: `${b} ${unit}`,
          }))}
        />
      </div>

      <div className="mb-5">
        <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
          Target
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTarget((t) => trim(Math.max(bar, t - ladder.step)))}
            aria-label={`Lower target by ${ladder.step} ${unit}`}
            className="press bg-surface-2 text-text-1 tap rounded-field px-4 text-[18px] font-semibold"
          >
            −
          </button>
          <div className="bg-surface-2 border-hairline rounded-field flex-1 border py-2 text-center">
            <span className="num text-[26px] font-bold">{target}</span>
            <span className="text-text-3 ml-1 text-[13px] font-semibold">
              {unit}
            </span>
          </div>
          <button
            onClick={() => setTarget((t) => trim(t + ladder.step))}
            aria-label={`Raise target by ${ladder.step} ${unit}`}
            className="press bg-surface-2 text-text-1 tap rounded-field px-4 text-[18px] font-semibold"
          >
            +
          </button>
        </div>
      </div>

      {perSide.length === 0 ? (
        <p className="text-text-3 py-6 text-center text-[14px]">
          Bar alone is already at or above the target.
        </p>
      ) : (
        <>
          <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            Per side
          </p>
          {/* Rendered as a loaded sleeve so it maps to what you see on the bar. */}
          <div className="bg-surface-2 border-hairline rounded-card flex min-h-24 items-center gap-1 overflow-x-auto border px-3 py-4 scrollbar-none">
            <span className="bg-hairline-strong h-2 w-6 shrink-0 rounded-l-sm" />
            {perSide.map((p, i) => (
              <span
                key={`${p}-${i}`}
                className={cn(
                  "num grid shrink-0 place-items-center rounded-[3px] text-[11px] font-bold",
                  PLATE_COLOR[unit][p],
                )}
                style={{
                  width: 22,
                  // Height encodes mass, so the stack is readable at a glance.
                  height: 34 + (p / ladder.heaviest) * 44,
                }}
              >
                {p}
              </span>
            ))}
            <span className="bg-hairline-strong h-2 flex-1 rounded-r-sm" />
          </div>

          <div className="mt-3 flex items-baseline justify-between text-[13px]">
            <span className="text-text-3">
              {perSide.length} plate{perSide.length === 1 ? "" : "s"} each side
            </span>
            <span className="num text-text-1 font-semibold">
              = {trim(loaded)} {unit}
            </span>
          </div>

          {remainder > 0 && (
            <p className="text-text-3 mt-1 text-[12px]">
              {trim(remainder * 2)} {unit} short — closest loadable weight with
              standard plates.
            </p>
          )}
        </>
      )}

      {unit === "lb" && (
        <p className="text-text-3 mt-4 text-[12px] leading-relaxed">
          Pound plates ({ladder.plates.join(", ")} lb). Set your unit to kg for
          the metric ladder — {trim(lbToKg(45))} kg is a 45 lb bar.
        </p>
      )}
    </div>
  );
}
