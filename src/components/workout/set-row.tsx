"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { Check, Trash2 } from "lucide-react";
import { cn, formatWeight, haptic, kgToLb, lbToKg } from "@/lib/utils";
import type { SetType } from "@/lib/db/schema";

export type SetDraft = {
  id: string;
  position: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  completed: boolean;
  isPr?: boolean;
};

const TYPE_LABEL: Record<SetType, string> = {
  normal: "",
  warmup: "W",
  drop: "D",
  failure: "F",
};

const TYPE_COLOR: Record<SetType, string> = {
  normal: "text-text-2",
  warmup: "text-[#7fb3ff]",
  drop: "text-[#c191ff]",
  failure: "text-danger",
};

export function SetRow({
  set,
  index,
  unit,
  trackingType,
  previous,
  onPatch,
  onToggleComplete,
  onDelete,
  onOpenTypeMenu,
}: {
  set: SetDraft;
  /** Display index among non-warmup sets — warmups don't consume a number. */
  index: number;
  unit: "kg" | "lb";
  trackingType: string;
  previous: { weightKg: number | null; reps: number | null; seconds: number | null } | null;
  onPatch: (patch: Partial<SetDraft>) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  onOpenTypeMenu: () => void;
}) {
  const x = useMotionValue(0);
  // The bin fades in as the row is dragged left, so the gesture is discoverable.
  const binOpacity = useTransform(x, [-90, -30, 0], [1, 0.5, 0]);

  const showWeight = trackingType === "weight_reps" || trackingType === "weight_time";
  const showReps = trackingType === "weight_reps" || trackingType === "reps";
  const showTime =
    trackingType === "time" ||
    trackingType === "distance_time" ||
    trackingType === "weight_time";
  const showDistance = trackingType === "distance_time";

  const prevLabel = previous
    ? trackingType === "time" || trackingType === "distance_time"
      ? previous.seconds != null
        ? `${previous.seconds}s`
        : "—"
      : previous.weightKg != null && previous.reps != null
        ? `${formatWeight(previous.weightKg, unit)}×${previous.reps}`
        : previous.reps != null
          ? `${previous.reps} reps`
          : "—"
    : "—";

  return (
    <div className="relative">
      {/* Delete affordance revealed by the swipe. */}
      <motion.div
        style={{ opacity: binOpacity }}
        className="bg-danger-fade absolute inset-y-0 right-0 flex w-[90px] items-center justify-end pr-5"
      >
        <Trash2 className="text-danger size-[18px]" strokeWidth={2.2} />
      </motion.div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -90, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        dragDirectionLock
        onDragEnd={(_, info) => {
          if (info.offset.x < -70 || info.velocity.x < -500) {
            haptic.medium();
            onDelete();
          } else {
            x.set(0);
          }
        }}
        className={cn(
          "relative px-3 py-1.5 transition-colors",
          // Completed rows tint volt — the single strongest state signal.
          set.completed ? "bg-volt-fade" : "bg-bg",
        )}
      >
        {/* Columns: set · previous · [weight] · [reps/time] · check. Built as an
            inline grid template so columns line up across rows regardless of
            which inputs the exercise's tracking type shows. */}
        <div
          className="grid w-full items-center gap-1.5"
          style={{
            gridTemplateColumns: `28px minmax(52px, 1fr) ${
              showWeight ? "minmax(58px, 1fr)" : ""
            } ${showReps || showTime || showDistance ? "minmax(58px, 1fr)" : ""} 44px`,
          }}
        >
          {/* Set number / type tag */}
          <button
            onClick={() => {
              haptic.light();
              onOpenTypeMenu();
            }}
            className={cn(
              "press num h-9 rounded-lg text-[14px] font-bold",
              set.setType === "normal"
                ? set.completed
                  ? "text-black/70"
                  : "text-text-2"
                : TYPE_COLOR[set.setType],
            )}
            aria-label="Change set type"
          >
            {set.setType === "normal" ? index : TYPE_LABEL[set.setType]}
          </button>

          {/* Previous — tap to copy into the inputs */}
          <button
            onClick={() => {
              if (!previous) return;
              haptic.light();
              onPatch({
                weightKg: previous.weightKg ?? set.weightKg,
                reps: previous.reps ?? set.reps,
                seconds: previous.seconds ?? set.seconds,
              });
            }}
            disabled={!previous}
            className={cn(
              "num h-9 truncate text-center text-[13px] font-medium",
              set.completed ? "text-black/50" : "text-text-3",
              previous && "press active:text-volt",
            )}
          >
            {prevLabel}
          </button>

          {showWeight && (
            <NumberCell
              value={
                set.weightKg == null
                  ? ""
                  : String(
                      Math.round(
                        (unit === "kg" ? set.weightKg : kgToLb(set.weightKg)) * 100,
                      ) / 100,
                    )
              }
              placeholder={
                previous?.weightKg != null
                  ? formatWeight(previous.weightKg, unit)
                  : "0"
              }
              completed={set.completed}
              onCommit={(raw) => {
                const n = raw === "" ? null : Number(raw);
                if (n != null && !Number.isFinite(n)) return;
                onPatch({
                  weightKg: n == null ? null : unit === "kg" ? n : lbToKg(n),
                });
              }}
            />
          )}

          {showReps && (
            <NumberCell
              value={set.reps == null ? "" : String(set.reps)}
              placeholder={previous?.reps != null ? String(previous.reps) : "0"}
              completed={set.completed}
              integer
              onCommit={(raw) => {
                const n = raw === "" ? null : Math.round(Number(raw));
                if (n != null && !Number.isFinite(n)) return;
                onPatch({ reps: n });
              }}
            />
          )}

          {!showReps && showTime && (
            <NumberCell
              value={set.seconds == null ? "" : String(set.seconds)}
              placeholder={
                previous?.seconds != null ? String(previous.seconds) : "0"
              }
              completed={set.completed}
              integer
              onCommit={(raw) => {
                const n = raw === "" ? null : Math.round(Number(raw));
                if (n != null && !Number.isFinite(n)) return;
                onPatch({ seconds: n });
              }}
            />
          )}

          {/* Complete */}
          <button
            onClick={() => {
              haptic.medium();
              onToggleComplete();
            }}
            aria-label={set.completed ? "Mark set incomplete" : "Complete set"}
            aria-pressed={set.completed}
            className={cn(
              "press grid h-9 w-11 place-items-center rounded-[10px] transition-colors",
              set.completed
                ? "bg-volt text-black"
                : "bg-surface-2 text-text-3 hover:text-text-1",
            )}
          >
            <Check className="size-[18px]" strokeWidth={3} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * A numeric cell that only commits on blur/Enter, so re-renders can't fight
 * the user's typing, and shows the previous session's value as a placeholder
 * — that's what makes an unchanged set a single tap.
 */
function NumberCell({
  value,
  placeholder,
  completed,
  integer,
  onCommit,
}: {
  value: string;
  placeholder: string;
  completed: boolean;
  integer?: boolean;
  onCommit: (raw: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);

  return (
    <input
      value={local}
      inputMode={integer ? "numeric" : "decimal"}
      enterKeyHint="done"
      placeholder={placeholder}
      onFocus={(e) => {
        focused.current = true;
        // Select-all means overwriting is one tap, not tap-then-clear.
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setLocal(e.target.value.replace(/[^0-9.]/g, ""))}
      onBlur={() => {
        focused.current = false;
        onCommit(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        "num h-9 w-full rounded-[10px] text-center text-[16px] font-semibold",
        "border outline-none transition-colors",
        completed
          ? "border-transparent bg-transparent text-black placeholder:text-black/30"
          : "border-hairline bg-surface-2 text-text-1 placeholder:text-text-3/60 focus:border-volt/60",
      )}
    />
  );
}
