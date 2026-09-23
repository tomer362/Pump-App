import type { RoutineBody } from "@/lib/routine-transfer";
import { formatWeight } from "@/lib/utils";

/**
 * What an update would change about one routine, in words.
 *
 * The update document carries each routine in full (see `routine-transfer.ts`
 * for why), so the preview has to work out the difference itself — "replaces
 * Upper A" tells the lifter nothing about whether the model quietly dropped
 * their face pulls. Pure, so `tests/routine-diff.test.ts` can pin it.
 *
 * Exercises are matched on a **key the caller supplies**, never on the text in
 * the document: the server passes the exercise id each entry resolves to, so a
 * built-in named without its slug still pairs with the row it already is, and
 * a lift that appears twice pairs occurrence by occurrence.
 */

type Entry = RoutineBody["exercises"][number];
type SetTarget = Entry["sets"][number];

export type DiffExercise = { key: string; entry: Entry };

export type DiffLine =
  | { kind: "added"; name: string; detail: string }
  | { kind: "removed"; name: string; detail: string }
  | { kind: "changed"; name: string; changes: string[] };

export type RoutineDiff = {
  nameChanged: boolean;
  notesChanged: boolean;
  /** The exercises both sides share now run in a different order. */
  reordered: boolean;
  lines: DiffLine[];
};

export function isUnchanged(d: RoutineDiff) {
  return !d.nameChanged && !d.notesChanged && !d.reordered && !d.lines.length;
}

function setLabel(s: SetTarget, unit: "kg" | "lb") {
  const parts: string[] = [];
  if (s.targetWeightKg != null) {
    parts.push(`${formatWeight(s.targetWeightKg, unit)} ${unit}`);
  }
  if (s.targetReps != null) parts.push(`${s.targetReps} reps`);
  if (s.targetDistanceM != null) parts.push(`${s.targetDistanceM} m`);
  if (s.targetSeconds != null) parts.push(`${s.targetSeconds} s`);
  let label = parts.join(" · ") || "no target";
  if (s.targetRpe != null) label += ` →${s.targetRpe}`;
  if (s.setType === "warmup") label = `warm-up ${label}`;
  else if (s.setType !== "normal") label = `${label} (${s.setType})`;
  return label;
}

/** "warm-up 40 kg · 10 reps, 3 × 80 kg · 8 reps" — runs of equal sets folded. */
export function summarizeSets(sets: SetTarget[], unit: "kg" | "lb") {
  const runs: { label: string; n: number }[] = [];
  for (const s of sets) {
    const label = setLabel(s, unit);
    const last = runs.at(-1);
    if (last && last.label === label) last.n += 1;
    else runs.push({ label, n: 1 });
  }
  return runs.map((r) => (r.n > 1 ? `${r.n} × ${r.label}` : r.label)).join(", ");
}

const rest = (s: number | null) => (s == null ? "default" : `${s} s`);

function entryChanges(a: Entry, b: Entry, unit: "kg" | "lb") {
  const out: string[] = [];
  const setsA = summarizeSets(a.sets, unit);
  const setsB = summarizeSets(b.sets, unit);
  if (setsA !== setsB) out.push(`${setsA} → ${setsB}`);
  if (a.restSeconds !== b.restSeconds) {
    out.push(`rest ${rest(a.restSeconds)} → ${rest(b.restSeconds)}`);
  }
  if ((a.supersetGroup ?? null) !== (b.supersetGroup ?? null)) {
    out.push(
      b.supersetGroup ? `superset ${b.supersetGroup}` : "no longer a superset",
    );
  }
  if (
    a.intervalWorkSeconds !== b.intervalWorkSeconds ||
    a.intervalRestSeconds !== b.intervalRestSeconds
  ) {
    out.push("interval timing");
  }
  if ((a.notes ?? "") !== (b.notes ?? "")) out.push("notes");
  return out;
}

export function diffRoutine(
  current: { name: string; notes: string | null; exercises: DiffExercise[] },
  incoming: { name: string; notes: string | null; exercises: DiffExercise[] },
  unit: "kg" | "lb" = "kg",
): RoutineDiff {
  // Pair occurrence by occurrence: the second bench press in the old routine
  // is the second bench press in the new one.
  const pool = new Map<string, number[]>();
  current.exercises.forEach((e, i) => {
    const list = pool.get(e.key) ?? [];
    list.push(i);
    pool.set(e.key, list);
  });

  const lines: DiffLine[] = [];
  const matchedCurrent = new Set<number>();
  const pairedOrder: number[] = [];

  for (const inc of incoming.exercises) {
    const i = pool.get(inc.key)?.shift();
    if (i === undefined) {
      lines.push({
        kind: "added",
        name: inc.entry.exercise.name,
        detail: summarizeSets(inc.entry.sets, unit),
      });
      continue;
    }
    matchedCurrent.add(i);
    pairedOrder.push(i);
    const changes = entryChanges(current.exercises[i].entry, inc.entry, unit);
    if (changes.length) {
      lines.push({ kind: "changed", name: inc.entry.exercise.name, changes });
    }
  }

  current.exercises.forEach((e, i) => {
    if (matchedCurrent.has(i)) return;
    lines.push({
      kind: "removed",
      name: e.entry.exercise.name,
      detail: summarizeSets(e.entry.sets, unit),
    });
  });

  return {
    nameChanged: current.name !== incoming.name,
    notesChanged: (current.notes ?? "") !== (incoming.notes ?? ""),
    reordered: pairedOrder.some((v, k) => k > 0 && v < pairedOrder[k - 1]),
    lines,
  };
}
