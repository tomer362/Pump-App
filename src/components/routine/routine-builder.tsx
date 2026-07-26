"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "motion/react";
import {
  ChevronLeft,
  Ellipsis,
  GripVertical,
  Plus,
  Timer,
  Trash2,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Textarea, Segmented } from "@/components/ui/primitives";
import { ExercisePicker } from "@/components/workout/exercise-picker";
import { createRoutine, updateRoutine, type RoutineInput } from "@/lib/actions/routine";
import type { FullRoutine } from "@/lib/queries/routine";
import { cn, haptic, kgToLb, labelize, lbToKg } from "@/lib/utils";
import type { SetType } from "@/lib/db/schema";

type DraftSet = {
  key: string;
  setType: SetType;
  targetWeightKg: number | null;
  targetReps: number | null;
  targetSeconds: number | null;
};

type DraftExercise = {
  key: string;
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  trackingType: string;
  notes: string | null;
  restSeconds: number | null;
  supersetGroup: string | null;
  intervalWorkSeconds: number | null;
  intervalRestSeconds: number | null;
  sets: DraftSet[];
};

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

export function RoutineBuilder({
  existing,
  unit,
  defaultRestSeconds,
}: {
  existing?: FullRoutine;
  unit: "kg" | "lb";
  defaultRestSeconds: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isPublic, setIsPublic] = useState(existing?.isPublic ?? true);
  const [items, setItems] = useState<DraftExercise[]>(() =>
    (existing?.exercises ?? []).map((e) => ({
      key: nextKey(),
      exerciseId: e.exerciseId,
      name: e.name,
      primaryMuscle: e.primaryMuscle,
      equipment: e.equipment,
      trackingType: e.trackingType,
      notes: e.notes,
      restSeconds: e.restSeconds,
      supersetGroup: e.supersetGroup,
      intervalWorkSeconds: e.intervalWorkSeconds,
      intervalRestSeconds: e.intervalRestSeconds,
      sets: e.sets.map((s) => ({
        key: nextKey(),
        setType: s.setType,
        targetWeightKg: s.targetWeightKg,
        targetReps: s.targetReps,
        targetSeconds: s.targetSeconds,
      })),
    })),
  );

  const [picking, setPicking] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addExercises = useCallback(
    async (ids: string[]) => {
      setPicking(false);
      if (!ids.length) return;
      // The picker already has the metadata; refetch minimal info for names.
      const { searchExercisesAction } = await import(
        "@/lib/actions/exercise-search"
      );
      const all = await searchExercisesAction({});
      const byId = new Map(all.map((e) => [e.id, e]));
      setItems((prev) => [
        ...prev,
        ...ids
          .map((id) => byId.get(id))
          .filter((e): e is NonNullable<typeof e> => e != null)
          .map((e) => ({
            key: nextKey(),
            exerciseId: e.id,
            name: e.name,
            primaryMuscle: e.primaryMuscle,
            equipment: e.equipment,
            trackingType: e.trackingType,
            notes: null,
            restSeconds: defaultRestSeconds,
            supersetGroup: null,
            intervalWorkSeconds: null,
            intervalRestSeconds: null,
            sets: [
              {
                key: nextKey(),
                setType: "normal" as SetType,
                targetWeightKg: null,
                targetReps: e.trackingType === "time" ? null : 8,
                targetSeconds: e.trackingType === "time" ? 30 : null,
              },
            ],
          })),
      ]);
    },
    [defaultRestSeconds],
  );

  function patchExercise(key: string, patch: Partial<DraftExercise>) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );
  }

  function patchSet(exKey: string, setKey: string, patch: Partial<DraftSet>) {
    setItems((prev) =>
      prev.map((it) =>
        it.key !== exKey
          ? it
          : {
              ...it,
              sets: it.sets.map((s) =>
                s.key === setKey ? { ...s, ...patch } : s,
              ),
            },
      ),
    );
  }

  async function save() {
    setSaving(true);
    setError(null);

    const payload: RoutineInput = {
      name,
      notes: notes.trim() || null,
      isPublic,
      exercises: items.map((it) => ({
        exerciseId: it.exerciseId,
        notes: it.notes,
        restSeconds: it.restSeconds,
        supersetGroup: it.supersetGroup,
        intervalWorkSeconds: it.intervalWorkSeconds,
        intervalRestSeconds: it.intervalRestSeconds,
        sets: it.sets.map((s) => ({
          setType: s.setType,
          targetWeightKg: s.targetWeightKg,
          targetReps: s.targetReps,
          targetSeconds: s.targetSeconds,
        })),
      })),
    };

    const res = existing
      ? await updateRoutine(existing.id, payload)
      : await createRoutine(payload);

    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(
      existing ? `/routines/${existing.id}` : `/routines/${(res.data as { routineId: string }).routineId}`,
    );
    router.refresh();
  }

  const menuItem = items.find((i) => i.key === menuFor) ?? null;

  return (
    <div className="min-h-screen-d pb-32">
      <header className="bg-bg hairline-b sticky top-0 z-30 pt-safe inset-safe-x">
        <div className="flex h-12 items-center gap-1 px-2">
          <IconButton
            label="Back"
            onClick={() => router.back()}
            className="text-text-2"
          >
            <ChevronLeft className="size-6" strokeWidth={2.4} />
          </IconButton>
          <span className="flex-1 text-center text-[15px] font-semibold">
            {existing ? "Edit routine" : "New routine"}
          </span>
          <Button
            variant="volt"
            size="sm"
            onClick={save}
            loading={saving}
            disabled={!name.trim() || items.length === 0}
          >
            Save
          </Button>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Routine name — e.g. Push A"
          className="h-12 text-[18px] font-semibold"
          maxLength={80}
        />
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          maxLength={1000}
        />
        <Segmented
          value={isPublic ? "public" : "private"}
          onChange={(v) => setIsPublic(v === "public")}
          options={[
            { value: "public", label: "Shareable" },
            { value: "private", label: "Private" },
          ]}
        />
      </div>

      {error && (
        <p className="text-danger px-4 pt-3 text-center text-[13px]">{error}</p>
      )}

      <Reorder.Group
        axis="y"
        values={items}
        onReorder={setItems}
        className="mt-4"
      >
        {items.map((item) => (
          <ExerciseCard
            key={item.key}
            item={item}
            unit={unit}
            onOpenMenu={() => setMenuFor(item.key)}
            onPatchSet={(setKey, patch) => patchSet(item.key, setKey, patch)}
            onAddSet={() =>
              patchExercise(item.key, {
                sets: [
                  ...item.sets,
                  {
                    key: nextKey(),
                    setType: "normal",
                    targetWeightKg:
                      item.sets[item.sets.length - 1]?.targetWeightKg ?? null,
                    targetReps:
                      item.sets[item.sets.length - 1]?.targetReps ?? null,
                    targetSeconds:
                      item.sets[item.sets.length - 1]?.targetSeconds ?? null,
                  },
                ],
              })
            }
            onRemoveSet={(setKey) =>
              patchExercise(item.key, {
                sets: item.sets.filter((s) => s.key !== setKey),
              })
            }
          />
        ))}
      </Reorder.Group>

      <div className="px-4 pt-4">
        <Button block variant="solid" onClick={() => setPicking(true)}>
          <Plus className="size-4" strokeWidth={2.6} />
          Add exercise
        </Button>
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onConfirm={addExercises}
      />

      <Sheet
        open={menuItem != null}
        onClose={() => setMenuFor(null)}
        title={menuItem?.name}
      >
        {menuItem && (
          <ExerciseSettings
            item={menuItem}
            onPatch={(patch) => patchExercise(menuItem.key, patch)}
            onRemove={() => {
              setItems((prev) => prev.filter((i) => i.key !== menuItem.key));
              setMenuFor(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ExerciseCard({
  item,
  unit,
  onOpenMenu,
  onPatchSet,
  onAddSet,
  onRemoveSet,
}: {
  item: DraftExercise;
  unit: "kg" | "lb";
  onOpenMenu: () => void;
  onPatchSet: (setKey: string, patch: Partial<DraftSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setKey: string) => void;
}) {
  const controls = useDragControls();
  const showWeight =
    item.trackingType === "weight_reps" || item.trackingType === "weight_time";
  const showReps =
    item.trackingType === "weight_reps" || item.trackingType === "reps";

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="bg-bg mb-2"
    >
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        <button
          onPointerDown={(e) => {
            haptic.light();
            controls.start(e);
          }}
          aria-label="Drag to reorder"
          className="text-text-3 touch-none px-1 py-2"
        >
          <GripVertical className="size-4" />
        </button>
        {item.supersetGroup && (
          <span className="text-volt border-volt/50 grid size-5 shrink-0 place-items-center rounded border text-[10px] font-bold">
            {item.supersetGroup}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{item.name}</p>
          <p className="text-text-3 text-[12px]">
            {labelize(item.primaryMuscle)} · {labelize(item.equipment)}
          </p>
        </div>
        {item.intervalWorkSeconds != null && (
          <Timer className="text-volt size-4" />
        )}
        <IconButton label="Exercise settings" size="sm" onClick={onOpenMenu}>
          <Ellipsis className="size-[18px]" />
        </IconButton>
      </div>

      <div
        className="text-text-3 grid gap-1.5 px-3 pb-1 text-[10px] font-bold tracking-[0.08em] uppercase"
        style={{
          gridTemplateColumns: `28px ${showWeight ? "1fr" : ""} 1fr 36px`,
        }}
      >
        <span className="text-center">Set</span>
        {showWeight && <span className="text-center">{unit}</span>}
        <span className="text-center">{showReps ? "Reps" : "Secs"}</span>
        <span />
      </div>

      <div className="divide-hairline divide-y">
        {item.sets.map((s, i) => (
          <div
            key={s.key}
            className="grid items-center gap-1.5 px-3 py-1.5"
            style={{
              gridTemplateColumns: `28px ${showWeight ? "1fr" : ""} 1fr 36px`,
            }}
          >
            <button
              onClick={() =>
                onPatchSet(s.key, {
                  setType:
                    s.setType === "normal"
                      ? "warmup"
                      : s.setType === "warmup"
                        ? "drop"
                        : s.setType === "drop"
                          ? "failure"
                          : "normal",
                })
              }
              className={cn(
                "num h-9 rounded-lg text-[14px] font-bold",
                s.setType === "normal" ? "text-text-2" : "text-volt",
              )}
            >
              {s.setType === "normal"
                ? i + 1
                : s.setType === "warmup"
                  ? "W"
                  : s.setType === "drop"
                    ? "D"
                    : "F"}
            </button>

            {showWeight && (
              <TargetInput
                value={
                  s.targetWeightKg == null
                    ? ""
                    : String(
                        Math.round(
                          (unit === "kg"
                            ? s.targetWeightKg
                            : kgToLb(s.targetWeightKg)) * 100,
                        ) / 100,
                      )
                }
                placeholder="—"
                onCommit={(raw) => {
                  const n = raw === "" ? null : Number(raw);
                  onPatchSet(s.key, {
                    targetWeightKg:
                      n == null || !Number.isFinite(n)
                        ? null
                        : unit === "kg"
                          ? n
                          : lbToKg(n),
                  });
                }}
              />
            )}

            <TargetInput
              value={
                showReps
                  ? s.targetReps == null
                    ? ""
                    : String(s.targetReps)
                  : s.targetSeconds == null
                    ? ""
                    : String(s.targetSeconds)
              }
              placeholder="—"
              onCommit={(raw) => {
                const n = raw === "" ? null : Math.round(Number(raw));
                const val = n == null || !Number.isFinite(n) ? null : n;
                onPatchSet(s.key, showReps ? { targetReps: val } : { targetSeconds: val });
              }}
            />

            <button
              onClick={() => onRemoveSet(s.key)}
              aria-label="Remove set"
              disabled={item.sets.length === 1}
              className="press text-text-3 hover:text-danger grid h-9 place-items-center rounded-lg disabled:opacity-30"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={onAddSet}
        className="press text-text-2 hairline-t hover:text-text-1 flex w-full items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold"
      >
        <Plus className="size-4" strokeWidth={2.6} />
        Add set
      </button>
    </Reorder.Item>
  );
}

function TargetInput({
  value,
  placeholder,
  onCommit,
}: {
  value: string;
  placeholder: string;
  onCommit: (raw: string) => void;
}) {
  const [local, setLocal] = useState(value);
  return (
    <input
      value={local}
      inputMode="decimal"
      placeholder={placeholder}
      onFocus={(e) => requestAnimationFrame(() => e.target.select())}
      onChange={(e) => setLocal(e.target.value.replace(/[^0-9.]/g, ""))}
      onBlur={() => onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="num border-hairline bg-surface-2 text-text-1 placeholder:text-text-3/60 focus:border-volt/60 h-9 w-full rounded-[10px] border text-center text-[16px] font-semibold outline-none"
    />
  );
}

/* -------------------------------------------------------------------------- */

function ExerciseSettings({
  item,
  onPatch,
  onRemove,
}: {
  item: DraftExercise;
  onPatch: (patch: Partial<DraftExercise>) => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const intervalOn = item.intervalWorkSeconds != null;

  return (
    <div className="space-y-6 px-4 pb-5">
      <div>
        <Label>Rest between sets</Label>
        <div className="flex gap-2">
          {[0, 60, 90, 120, 180, 240].map((s) => (
            <button
              key={s}
              onClick={() => onPatch({ restSeconds: s === 0 ? null : s })}
              className={cn(
                "press num rounded-field h-10 flex-1 border text-[13px] font-semibold",
                (s === 0 ? item.restSeconds == null : item.restSeconds === s)
                  ? "border-volt bg-volt-fade text-volt"
                  : "border-hairline bg-surface-2 text-text-2",
              )}
            >
              {s === 0 ? "Off" : s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Superset group</Label>
        <p className="text-text-3 mb-2 text-[12px]">
          Exercises sharing a letter are performed back to back.
        </p>
        <div className="flex gap-2">
          {[null, "A", "B", "C", "D"].map((g) => (
            <button
              key={g ?? "none"}
              onClick={() => onPatch({ supersetGroup: g })}
              className={cn(
                "press rounded-field h-10 flex-1 border text-[13px] font-semibold",
                item.supersetGroup === g
                  ? "border-volt bg-volt-fade text-volt"
                  : "border-hairline bg-surface-2 text-text-2",
              )}
            >
              {g ?? "None"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Interval mode</Label>
        <p className="text-text-3 mb-2 text-[12px]">
          Runs a work/rest countdown with spoken cues instead of manual set
          logging.
        </p>
        <Segmented
          value={intervalOn ? "on" : "off"}
          onChange={(v) =>
            onPatch(
              v === "on"
                ? { intervalWorkSeconds: 30, intervalRestSeconds: 30 }
                : { intervalWorkSeconds: null, intervalRestSeconds: null },
            )
          }
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
          ]}
        />
        {intervalOn && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <Label>Work (secs)</Label>
              <TargetInput
                value={String(item.intervalWorkSeconds ?? 30)}
                placeholder="30"
                onCommit={(raw) =>
                  onPatch({ intervalWorkSeconds: Number(raw) || 30 })
                }
              />
            </div>
            <div>
              <Label>Rest (secs)</Label>
              <TargetInput
                value={String(item.intervalRestSeconds ?? 30)}
                placeholder="30"
                onCommit={(raw) =>
                  onPatch({ intervalRestSeconds: Number(raw) || 0 })
                }
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label>Note</Label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onPatch({ notes: notes.trim() || null })}
          placeholder="Cues, tempo, machine settings…"
        />
      </div>

      <Button block variant="danger" onClick={onRemove}>
        <Trash2 className="size-4" />
        Remove from routine
      </Button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
      {children}
    </p>
  );
}
