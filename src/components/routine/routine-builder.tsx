"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "motion/react";
import {
  ChevronLeft,
  Ellipsis,
  GripVertical,
  Info,
  Plus,
  Repeat2,
  Timer,
  Trash2,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input, Textarea, Segmented } from "@/components/ui/primitives";
import {
  columnLabel,
  setColumns,
  type SetColumn,
} from "@/components/workout/set-row";
import { RestPicker } from "@/components/workout/rest-picker";
import { RpePicker } from "@/components/workout/rpe-picker";
import { createRoutine, updateRoutine, type RoutineInput } from "@/lib/actions/routine";
import { createFolder } from "@/lib/actions/routine-folder";
import { folderRail } from "@/lib/folder-color";
import type { FolderListItem, FullRoutine } from "@/lib/queries/routine";
import { cn, haptic, kgToLb, labelize, lbToKg } from "@/lib/utils";
import { prescribedToken, rpeRangeLabel, uniformRpe } from "@/lib/rpe";
import type { SetType } from "@/lib/db/schema";

// Behind a gesture, so they stay out of the initial payload.
const ExercisePicker = dynamic(() =>
  import("@/components/workout/exercise-picker").then((m) => m.ExercisePicker),
);
const ExerciseAboutSheetBody = dynamic(() =>
  import("@/components/exercise/exercise-about").then(
    (m) => m.ExerciseAboutSheetBody,
  ),
);

type DraftSet = {
  key: string;
  setType: SetType;
  targetWeightKg: number | null;
  targetReps: number | null;
  targetSeconds: number | null;
  targetDistanceM: number | null;
  targetRpe: number | null;
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

/** Column key → the `DraftSet` field it edits. Weight is handled separately
    because it needs unit conversion on the way in and out. */
// `assist` is a weight column pointing the other way, so it shares
// `targetWeightKg` with `weight` and is handled alongside it below.
const TARGET_FIELD = {
  reps: "targetReps",
  seconds: "targetSeconds",
  distance: "targetDistanceM",
} as const satisfies Record<
  Exclude<SetColumn, "weight" | "assist">,
  keyof DraftSet
>;

/** A new set inherits the previous one's targets — programmes repeat. */
function cloneTargets(last: DraftSet | undefined) {
  return {
    targetWeightKg: last?.targetWeightKg ?? null,
    targetReps: last?.targetReps ?? null,
    targetSeconds: last?.targetSeconds ?? null,
    targetDistanceM: last?.targetDistanceM ?? null,
    targetRpe: last?.targetRpe ?? null,
  };
}

export function RoutineBuilder({
  existing,
  unit,
  defaultRestSeconds,
  folders,
}: {
  existing?: FullRoutine;
  unit: "kg" | "lb";
  defaultRestSeconds: number;
  folders: FolderListItem[];
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [folderId, setFolderId] = useState<string | null>(
    existing?.folderId ?? null,
  );
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
        targetDistanceM: s.targetDistanceM,
        targetRpe: s.targetRpe,
      })),
    })),
  );

  const [picking, setPicking] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [infoFor, setInfoFor] = useState<string | null>(null);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  /**
   * Which set's prescribed effort is being picked. A sheet rather than a chip
   * strip on the row for the same reason the workout screen uses one: nine half
   * points at a usable tap size is ~400px of chips, which no set row on a phone
   * has. Keyed by both halves because set keys are only unique within their
   * exercise.
   */
  const [rpeFor, setRpeFor] = useState<{ exKey: string; setKey: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addExercises = useCallback(
    async (ids: string[]) => {
      setPicking(false);
      if (!ids.length) return;
      // The picker already has the metadata; refetch minimal info for names.
      // Only the ids that were picked — this used to pull the whole library
      // back just to read a handful of rows out of it.
      const { getExercisesByIdsAction } = await import(
        "@/lib/actions/exercise-search"
      );
      const picked = await getExercisesByIdsAction(ids);
      const byId = new Map(picked.map((e) => [e.id, e]));
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
                targetReps: setColumns(e.trackingType).includes("reps") ? 8 : null,
                targetSeconds: setColumns(e.trackingType).includes("seconds")
                  ? 30
                  : null,
                targetDistanceM: null,
                targetRpe: null,
              },
            ],
          })),
      ]);
    },
    [defaultRestSeconds],
  );

  // Same signal the workout screen gives: the picker marks what the draft
  // already contains, without stopping you programming a lift twice.
  const alreadyIn = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const it of items) counts[it.exerciseId] = (counts[it.exerciseId] ?? 0) + 1;
    return counts;
  }, [items]);

  /**
   * Swap the movement on one row, keeping its sets, rest and superset letter.
   *
   * The targets are kept rather than cleared, unlike the mid-workout swap:
   * these are a prescription, not a record of work done, and "3×8" survives
   * the change from a pull-up to a lat pulldown.
   */
  const replaceExercise = useCallback(async (key: string, id: string) => {
    setReplaceFor(null);
    const { getExercisesByIdsAction } = await import(
      "@/lib/actions/exercise-search"
    );
    const [picked] = await getExercisesByIdsAction([id]);
    if (!picked) return;
    haptic.light();
    setItems((prev) =>
      prev.map((it) =>
        it.key !== key
          ? it
          : {
              ...it,
              exerciseId: picked.id,
              name: picked.name,
              primaryMuscle: picked.primaryMuscle,
              equipment: picked.equipment,
              trackingType: picked.trackingType,
              // Cues and machine settings described the old movement.
              notes: null,
            },
      ),
    );
  }, []);

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
      folderId,
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
          targetDistanceM: s.targetDistanceM,
          targetRpe: s.targetRpe,
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
  const infoItem = items.find((i) => i.key === infoFor) ?? null;
  const replaceItem = items.find((i) => i.key === replaceFor) ?? null;

  const rpeItem = rpeFor
    ? (items.find((i) => i.key === rpeFor.exKey) ?? null)
    : null;
  const rpeSet = rpeItem?.sets.find((s) => s.key === rpeFor?.setKey) ?? null;
  // The number the sheet's title carries. Warm-ups aren't numbered anywhere
  // else in the app either, so it names them rather than counting them.
  const rpeSetLabel =
    rpeItem && rpeSet
      ? rpeSet.setType === "warmup"
        ? "warm-up"
        : `set ${rpeItem.sets.filter((s) => s.setType !== "warmup").indexOf(rpeSet) + 1}`
      : "";

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
        <FolderPicker
          folders={folders}
          value={folderId}
          onChange={setFolderId}
        />
        <div>
          <Segmented
            value={isPublic ? "public" : "private"}
            onChange={(v) => setIsPublic(v === "public")}
            options={[
              { value: "public", label: "Shareable" },
              { value: "private", label: "Private" },
            ]}
          />
          <p className="text-text-3 mt-1.5 text-[12px] leading-snug">
            {isPublic
              ? "Anyone with the link can open it, and it can be found in Discover."
              : "Only you can open it."}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-danger px-4 pt-3 text-center text-[13px]">{error}</p>
      )}

      <Reorder.Group
        axis="y"
        values={items}
        onReorder={setItems}
        // A drag started on a grip travels across every name and column header
        // below it, and dragging across text is how a selection gets painted.
        // Inputs opt back in — see globals.css.
        className="mt-4 select-none"
      >
        {items.map((item) => (
          <ExerciseCard
            key={item.key}
            item={item}
            unit={unit}
            onOpenMenu={() => setMenuFor(item.key)}
            onOpenInfo={() => setInfoFor(item.key)}
            onOpenSetRpe={(setKey) => setRpeFor({ exKey: item.key, setKey })}
            onPatchSet={(setKey, patch) => patchSet(item.key, setKey, patch)}
            onAddSet={() =>
              patchExercise(item.key, {
                sets: [
                  ...item.sets,
                  {
                    key: nextKey(),
                    setType: "normal",
                    ...cloneTargets(item.sets[item.sets.length - 1]),
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
        alreadyIn={alreadyIn}
      />

      <ExercisePicker
        open={replaceItem != null}
        onClose={() => setReplaceFor(null)}
        mode="replace"
        replacing={
          replaceItem && { id: replaceItem.exerciseId, name: replaceItem.name }
        }
        onConfirm={(ids) => {
          if (replaceItem && ids[0]) replaceExercise(replaceItem.key, ids[0]);
        }}
      />

      <Sheet
        open={menuItem != null}
        onClose={() => setMenuFor(null)}
        title={menuItem?.name}
        // Same as the workout screen's exercise sheet: it commits as you tap,
        // so without this there is nothing on screen that closes it.
        dismissLabel="Done"
      >
        {menuItem && (
          <ExerciseSettings
            item={menuItem}
            defaultRestSeconds={defaultRestSeconds}
            onPatch={(patch) => patchExercise(menuItem.key, patch)}
            onViewDetails={() => {
              setMenuFor(null);
              setInfoFor(menuItem.key);
            }}
            onReplace={() => {
              setMenuFor(null);
              setReplaceFor(menuItem.key);
            }}
            onRemove={() => {
              setItems((prev) => prev.filter((i) => i.key !== menuItem.key));
              setMenuFor(null);
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={rpeFor != null}
        onClose={() => setRpeFor(null)}
        title={rpeItem ? `${rpeItem.name} — ${rpeSetLabel}` : undefined}
      >
        {rpeFor && rpeSet && (
          <div className="px-4 pb-5">
            <Label>Target effort (RPE)</Label>
            <RpePicker
              value={rpeSet.targetRpe}
              idPrefix="routine-set-target"
              onChange={(v) => {
                patchSet(rpeFor.exKey, rpeFor.setKey, { targetRpe: v });
                setRpeFor(null);
              }}
              hint={
                <>
                  How hard this set should feel. Per set, so a routine can ramp —
                  7 on the first, 9 on the last. Leave it blank to prescribe no
                  effort at all.
                </>
              }
            />
          </div>
        )}
      </Sheet>

      {/* Capped and scrolled: an exercise's prose runs to three paragraphs plus
          its alternatives, and a sheet that grows to fit that is the whole
          screen with no sign it can be dismissed. */}
      <Sheet
        open={infoItem != null}
        onClose={() => setInfoFor(null)}
        title={infoItem?.name}
        maxHeight="88dvh"
        // Capped and scrolled, so the drag handle is often scrolled away from
        // the prose you are reading. This is the way out.
        dismissLabel="Done"
      >
        {infoItem && <ExerciseAboutSheetBody exerciseId={infoItem.exerciseId} />}
      </Sheet>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ExerciseCard({
  item,
  unit,
  onOpenMenu,
  onOpenInfo,
  onOpenSetRpe,
  onPatchSet,
  onAddSet,
  onRemoveSet,
}: {
  item: DraftExercise;
  unit: "kg" | "lb";
  onOpenMenu: () => void;
  onOpenInfo: () => void;
  onOpenSetRpe: (setKey: string) => void;
  onPatchSet: (setKey: string, patch: Partial<DraftSet>) => void;
  onAddSet: () => void;
  onRemoveSet: (setKey: string) => void;
}) {
  const controls = useDragControls();
  const columns = setColumns(item.trackingType);
  // Effort gets a track of its own between the targets and the bin. It can't be
  // one of `columns` — those are the measurements a set records, shared with the
  // workout screen's table, and RPE is deliberately not a column there.
  const template = `28px ${columns.map(() => "1fr").join(" ")} 36px 36px`;

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
        {/* Tapping the name opens the About sheet rather than the exercise
            page: the routine on screen is unsaved React state, so navigating
            away would throw the whole draft out. Grayscale with a small info
            glyph, not volt — volt marks state that matters, and the routine
            view page's name link is plain too. Without the glyph the gesture is
            advertised by nothing, which is how it read as missing. */}
        <button
          type="button"
          onClick={onOpenInfo}
          aria-label={`About ${item.name}`}
          className="press min-w-0 flex-1 text-left"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">
              {item.name}
            </span>
            <Info className="text-text-3 size-3.5 shrink-0" />
          </span>
          <span className="text-text-3 block text-[12px]">
            {labelize(item.primaryMuscle)} · {labelize(item.equipment)}
            {/* A range across the sets, not `sets[0]`: effort is prescribed per
                set, so a lift ramping 7/8/9 announced itself as "RPE 7" and the
                header spoke for two sets it had never read. */}
            {rpeRangeLabel(item.sets.map((s) => s.targetRpe)) && (
              <span className="num">
                {" · RPE "}
                {rpeRangeLabel(item.sets.map((s) => s.targetRpe))}
              </span>
            )}
          </span>
        </button>
        {item.intervalWorkSeconds != null && (
          <Timer className="text-volt size-4" />
        )}
        <IconButton label="Exercise settings" size="sm" onClick={onOpenMenu}>
          <Ellipsis className="size-[18px]" />
        </IconButton>
      </div>

      <div
        className="text-text-3 grid gap-1.5 px-3 pb-1 text-[10px] font-bold tracking-[0.08em] uppercase"
        style={{ gridTemplateColumns: template }}
      >
        <span className="text-center">Set</span>
        {columns.map((column) => (
          <span key={column} className="text-center">
            {columnLabel(column, unit)}
          </span>
        ))}
        <span className="text-center">RPE</span>
        <span />
      </div>

      <div className="divide-hairline divide-y">
        {item.sets.map((s, i) => (
          <div
            key={s.key}
            className="grid items-center gap-1.5 px-3 py-1.5"
            style={{ gridTemplateColumns: template }}
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

            {columns.map((column) =>
              column === "weight" || column === "assist" ? (
                <TargetInput
                  key={column}
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
              ) : (
                <TargetInput
                  key={column}
                  value={
                    s[TARGET_FIELD[column]] == null
                      ? ""
                      : String(s[TARGET_FIELD[column]])
                  }
                  placeholder="—"
                  onCommit={(raw) => {
                    const n = raw === "" ? null : Math.round(Number(raw));
                    onPatchSet(s.key, {
                      [TARGET_FIELD[column]]:
                        n == null || !Number.isFinite(n) ? null : n,
                    });
                  }}
                />
              ),
            )}

            {/* Prescribed effort. Grayscale even when set, unlike the set-type
                tag beside it: volt marks state produced by training, and this
                is a target. `→8` matches what the workout screen will show on
                the row, so the same prescription reads the same in both. */}
            <button
              onClick={() => {
                haptic.light();
                onOpenSetRpe(s.key);
              }}
              aria-label={
                s.targetRpe != null
                  ? `Target effort ${s.targetRpe} for set ${i + 1}. Change it.`
                  : `Set a target effort for set ${i + 1}`
              }
              className={cn(
                "press num h-9 rounded-lg text-[13px] font-semibold",
                s.targetRpe != null ? "text-text-2" : "text-text-3",
              )}
            >
              {s.targetRpe != null ? prescribedToken(s.targetRpe) : "—"}
            </button>

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
  defaultRestSeconds,
  onPatch,
  onViewDetails,
  onReplace,
  onRemove,
}: {
  item: DraftExercise;
  defaultRestSeconds: number;
  onPatch: (patch: Partial<DraftExercise>) => void;
  onViewDetails: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const intervalOn = item.intervalWorkSeconds != null;
  // Shown as selected only when every set carries the same prescription. When
  // they differ, nothing is selected and the fold is spelled out above the
  // chips — the `—` chip lighting up used to claim "no prescription" about an
  // exercise that had three of them.
  const targetRpe = uniformRpe(item.sets.map((s) => s.targetRpe));
  const mixedRpe =
    targetRpe == null &&
    item.sets.some((s) => s.targetRpe != null) &&
    item.sets.length > 1;

  return (
    <div className="space-y-6 px-4 pb-5">
      <div>
        <Label>Rest between sets</Label>
        {/* The shared picker, so a routine and the workout started from it can't
            disagree about the durations or about what "no rest" means. The old
            row here was hardcoded to six values, so a routine resting 45s — one
            tap away on the workout screen, and what "save workout as routine"
            copies over — opened with nothing selected and nothing naming it.
            Worse, its "Off" chip wrote `null`, which `startWorkoutFromRoutine`
            reads as "inherit the default": a routine that said Off rested. */}
        <RestPicker
          value={item.restSeconds}
          inherited={defaultRestSeconds}
          inheritLabel="your default"
          onChange={(seconds) => onPatch({ restSeconds: seconds })}
          idPrefix="routine-exercise-rest"
          hint="Every set of this exercise. A routine prescribes one rest per exercise — single sets can only be overridden mid-workout."
        />
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
        <Label>Target effort — all sets</Label>
        {/* The shared picker, not a local copy of the scale: this hand-rolled
            its own chips and omitted 6.5, so a routine could prescribe an
            effort the workout screen offered and not the other way round.

            This one writes every set at once, which is the common case ("3×8
            @ 8"). A ramp is set per row instead, on the RPE cell in the table —
            so this control has to say what it overwrites. */}
        {mixedRpe && (
          <p className="text-text-3 num mb-2 text-[12px]">
            Sets differ: {item.sets.map((s) => s.targetRpe ?? "—").join(" · ")}
          </p>
        )}
        <RpePicker
          value={targetRpe}
          onChange={(v) =>
            onPatch({ sets: item.sets.map((s) => ({ ...s, targetRpe: v })) })
          }
          idPrefix="routine-target"
          hint={
            <>
              Applies to every set at once. To ramp — 7, then 8, then 9 — tap the
              RPE cell on a single set instead. 10 is a set you couldn&apos;t
              have added a rep to.
            </>
          }
        />
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

      <div className="space-y-2">
        {/* Also reachable by tapping the name on the card. Repeated here
            because this sheet is where you look when you want to do something
            to an exercise, and "what is this movement" is the question that
            comes before "replace it". */}
        <Button block variant="solid" onClick={onViewDetails}>
          <Info className="size-4" strokeWidth={2.4} />
          View exercise details
        </Button>

        <Button block variant="solid" onClick={onReplace}>
          <Repeat2 className="size-4" strokeWidth={2.4} />
          Replace exercise
        </Button>
        <p className="text-text-3 text-[12px] leading-snug">
          Swaps the movement and keeps the sets and targets you prescribed.
        </p>

        <Button block variant="danger" onClick={onRemove}>
          <Trash2 className="size-4" />
          Remove from routine
        </Button>
      </div>
    </div>
  );
}

/**
 * Chips over a free-text field. Typing the folder name was what let "PPL" and
 * "ppl" become two folders — picking from what already exists can't.
 */
function FolderPicker({
  folders,
  value,
  onChange,
}: {
  folders: FolderListItem[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [known, setKnown] = useState(folders);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    const res = await createFolder({ name: trimmed });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Reflected locally rather than via router.refresh(): a refresh here would
    // re-render the builder from the server and discard the unsaved draft.
    setKnown((prev) => [
      ...prev,
      {
        id: res.data!.folderId,
        name: trimmed,
        color: "slate",
        position: prev.length,
        rotation: false,
        routineCount: 0,
        nextRoutineId: null,
        nextRoutineName: null,
      },
    ]);
    onChange(res.data!.folderId);
    setName("");
    setCreating(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <FolderChip
          label="Unfiled"
          active={value === null}
          onClick={() => onChange(null)}
        />
        {known.map((f) => (
          <FolderChip
            key={f.id}
            label={f.name}
            color={f.color}
            active={value === f.id}
            onClick={() => onChange(f.id)}
          />
        ))}
        {!creating && (
          <FolderChip
            label="+ New folder"
            active={false}
            onClick={() => setCreating(true)}
          />
        )}
      </div>

      {creating && (
        <div className="mt-2 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            maxLength={40}
            autoFocus
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />
          <Button variant="solid" disabled={!name.trim()} onClick={create}>
            Add
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setCreating(false);
              setName("");
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {error && <p className="text-danger mt-1.5 text-[12px]">{error}</p>}
    </div>
  );
}

function FolderChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: FolderListItem["color"];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.light();
        onClick();
      }}
      aria-pressed={active}
      className={cn(
        "press tap inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium",
        active
          ? "bg-surface-3 text-text-1"
          : "bg-surface-2 text-text-3 hover:text-text-2",
      )}
    >
      {color && (
        <span
          aria-hidden
          className={cn("size-2 rounded-full", folderRail(color))}
        />
      )}
      {label}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
      {children}
    </p>
  );
}
