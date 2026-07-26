"use client";

import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/primitives";
import { cn, formatWeight, kgToLb } from "@/lib/utils";

const BAR_OPTIONS_KG = [20, 15, 10, 7.5];

/** Standard gym plate ladder in kg, heaviest first. */
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

const PLATE_COLOR: Record<number, string> = {
  25: "bg-[#c62828] text-white",
  20: "bg-[#1565c0] text-white",
  15: "bg-[#f9a825] text-black",
  10: "bg-[#2e7d32] text-white",
  5: "bg-[#e0e0e0] text-black",
  2.5: "bg-[#212121] text-white ring-1 ring-white/25",
  1.25: "bg-[#9e9e9e] text-black",
};

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
  const [barKg, setBarKg] = useState(20);
  const [target, setTarget] = useState(targetKg);

  const { perSide, remainder } = useMemo(() => {
    let side = (target - barKg) / 2;
    if (side <= 0) return { perSide: [] as number[], remainder: 0 };
    const out: number[] = [];
    for (const p of PLATES_KG) {
      while (side >= p - 1e-9) {
        out.push(p);
        side -= p;
      }
    }
    return { perSide: out, remainder: Math.round(side * 100) / 100 };
  }, [target, barKg]);

  const loaded = barKg + perSide.reduce((a, b) => a + b, 0) * 2;

  return (
    <div className="px-4 pb-5">
      <div className="mb-4">
        <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
          Bar weight
        </p>
        <Segmented
          value={String(barKg)}
          onChange={(v) => setBarKg(Number(v))}
          options={BAR_OPTIONS_KG.map((b) => ({
            value: String(b),
            label: `${formatWeight(b, unit)} ${unit}`,
          }))}
        />
      </div>

      <div className="mb-5">
        <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
          Target
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTarget((t) => Math.max(barKg, t - 2.5))}
            className="press bg-surface-2 text-text-1 tap rounded-field px-4 text-[18px] font-semibold"
          >
            −
          </button>
          <div className="bg-surface-2 border-hairline rounded-field flex-1 border py-2 text-center">
            <span className="num text-[26px] font-bold">
              {formatWeight(target, unit)}
            </span>
            <span className="text-text-3 ml-1 text-[13px] font-semibold">
              {unit}
            </span>
          </div>
          <button
            onClick={() => setTarget((t) => t + 2.5)}
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
                  PLATE_COLOR[p],
                )}
                style={{
                  width: 22,
                  // Height encodes mass, so the stack is readable at a glance.
                  height: 34 + (p / 25) * 44,
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
              = {formatWeight(loaded, unit)} {unit}
            </span>
          </div>

          {remainder > 0 && (
            <p className="text-text-3 mt-1 text-[12px]">
              {formatWeight(remainder * 2, unit)} {unit} short — closest loadable
              weight with standard plates.
            </p>
          )}
        </>
      )}

      {unit === "lb" && (
        <p className="text-text-3 mt-4 text-[12px] leading-relaxed">
          Plates shown are metric ({PLATES_KG.join(", ")} kg). In pounds that&apos;s{" "}
          {PLATES_KG.map((p) => Math.round(kgToLb(p))).join(", ")} lb.
        </p>
      )}
    </div>
  );
}
