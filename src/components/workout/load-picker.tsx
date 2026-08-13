"use client";

import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn, haptic } from "@/lib/utils";

/**
 * Running a programme at a percentage of its prescribed load (#15). The same
 * picker is used from the Start card, a routine's page and co-op session
 * creation — the multiplier means the same thing in all three, so it has one
 * implementation.
 */
export const LOAD_PRESETS = [
  { value: 0.6, label: "60%", note: "Heavy deload" },
  { value: 0.7, label: "70%", note: "Deload" },
  { value: 0.8, label: "80%", note: "Light deload" },
  { value: 0.9, label: "90%", note: "Back-off" },
  { value: 1, label: "100%", note: "As prescribed" },
  { value: 1.05, label: "105%", note: "Push" },
  { value: 1.1, label: "110%", note: "Overload" },
] as const;

export function LoadGrid({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {LOAD_PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => {
            haptic.light();
            onChange(p.value);
          }}
          className={cn(
            "press rounded-field border px-3 py-2.5 text-left transition-colors",
            value === p.value
              ? "border-volt bg-volt-fade"
              : "border-hairline bg-surface-2",
          )}
        >
          <span
            className={cn(
              "num block text-[18px] font-bold",
              value === p.value ? "text-volt" : "text-text-1",
            )}
          >
            {p.label}
          </span>
          <span className="text-text-3 block text-[12px]">{p.note}</span>
        </button>
      ))}
    </div>
  );
}

export function LoadPickerSheet({
  open,
  onClose,
  routineName,
  value,
  onChange,
  onConfirm,
  loading,
  confirmLabel = "Start at",
}: {
  open: boolean;
  onClose: () => void;
  routineName: string;
  value: number;
  onChange: (value: number) => void;
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Adjust the load"
      footer={
        <Button block variant="volt" loading={loading} onClick={onConfirm}>
          {confirmLabel} {Math.round(value * 100)}%
        </Button>
      }
    >
      <div className="px-4 pb-4">
        <p className="text-text-2 text-[14px] leading-relaxed">
          Every prescribed weight in{" "}
          <span className="text-text-1 font-semibold">{routineName}</span> gets
          scaled by this. Use it for a deload week, or to push a little past the
          plan.
        </p>

        <div className="mt-5">
          <LoadGrid value={value} onChange={onChange} />
        </div>

        {/* The prescribed effort deliberately isn't scaled, and saying so
            matters: RPE maps to a percentage of 1RM differently at every rep
            count, so any arithmetic here would be invented. The old wording
            ("sets and reps stay as written") quietly implied the prescription
            still held at 80%, when a set written @8 lifted that light is the
            whole point of a deload. */}
        <p className="text-text-3 mt-4 text-[12px] leading-relaxed">
          Only weights scale — sets and reps stay as written, and so does any
          prescribed effort. Below 100% a set written{" "}
          <span className="num">@8</span> should feel easier than that; that is
          what a deload is. Records set during a scaled session still count.
        </p>
      </div>
    </Sheet>
  );
}
