import type { Unit } from "@/lib/unit";
import { kgToLb } from "@/lib/utils";

/**
 * Training-history export: every set you have logged, as a CSV for a
 * spreadsheet or as a JSON document for anything else.
 *
 * Pure — no session, no database — so the format is pinned by
 * `tests/history-export.test.ts` without a fixture. The query that feeds it is
 * `lib/queries/history-export.ts` and the authorisation is in
 * `lib/actions/history-export.ts`.
 *
 * Same principles as the routine export (`lib/routine-transfer.ts`): no uuids
 * (per-database, and meaningless to whoever opens the file), weights in
 * kilograms because that is what is stored, with the display unit added beside
 * it rather than instead of it. An assisted machine's weight is help received,
 * not load (`lib/tracking.ts`), so it is written as stored and flagged by its
 * own column — negating it would make a spreadsheet's SUM claim something.
 */

export const HISTORY_FORMAT = "pump.history";
export const HISTORY_VERSION = 1;

/** One logged set, flattened with its exercise and workout. Rows arrive ordered. */
export type ExportSetRow = {
  /** Grouping keys only — never written to the file. */
  workoutKey: string;
  workoutExerciseKey: string;

  workoutName: string;
  workoutKind: string;
  workoutNote: string | null;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
  loadMultiplier: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  prCount: number;

  exerciseName: string;
  exerciseSlug: string | null;
  primaryMuscle: string;
  equipment: string;
  trackingType: string;
  exerciseNotes: string | null;

  setType: string;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  targetRpe: number | null;
  completedAt: Date | null;
  estimated1rm: number | null;
};

export type ExportRecordRow = {
  exerciseName: string;
  exerciseSlug: string | null;
  kind: string;
  value: number;
  weightKg: number | null;
  reps: number | null;
  achievedAt: Date;
};

/** Two decimals, no trailing noise; null stays null. */
function round(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Set numbers as the workout table shows them: warm-ups take none, working
 * sets count from 1 within each exercise of each workout.
 */
function setNumbers(rows: readonly ExportSetRow[]): (number | null)[] {
  const out: (number | null)[] = [];
  let key = "";
  let n = 0;
  for (const r of rows) {
    if (r.workoutExerciseKey !== key) {
      key = r.workoutExerciseKey;
      n = 0;
    }
    if (r.setType === "warmup") out.push(null);
    else out.push(++n);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* CSV                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A text cell a spreadsheet would evaluate as a formula is prefixed with an
 * apostrophe. Workout and exercise names and notes are free text, and a CSV
 * opened in Excel or Sheets runs `=HYPERLINK(...)` as written (OWASP's "CSV
 * injection"). Numbers are written as numbers and never pass through here, so a
 * real negative value is not mangled.
 */
function guardFormula(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** RFC 4180: quote when the cell holds a quote, a comma or a line break. */
export function csvCell(v: string | number | boolean | null): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "yes" : "no";
  const s = guardFormula(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function historyCsvColumns(unit: Unit): string[] {
  return [
    "date",
    "started_at",
    "workout",
    "workout_kind",
    "exercise",
    "muscle",
    "equipment",
    "tracking_type",
    "set_number",
    "set_type",
    "completed",
    "weight_kg",
    ...(unit === "lb" ? ["weight_lb"] : []),
    "weight_is_assistance",
    "reps",
    "seconds",
    "distance_m",
    "rpe",
    "target_rpe",
    "estimated_1rm_kg",
    "exercise_notes",
    "workout_note",
  ];
}

/**
 * One row per set. Starts with a UTF-8 byte-order mark, which is the only way
 * Excel will read a CSV as UTF-8 — without it a Hebrew or accented exercise
 * name opens as mojibake. `\r\n` line ends, per RFC 4180.
 */
export function toHistoryCsv(
  rows: readonly ExportSetRow[],
  unit: Unit,
): string {
  const numbers = setNumbers(rows);
  const lines = [historyCsvColumns(unit).join(",")];

  rows.forEach((r, i) => {
    const assisted = r.trackingType === "assist_reps";
    const cells: (string | number | boolean | null)[] = [
      isoDay(r.startedAt),
      r.startedAt.toISOString(),
      r.workoutName,
      r.workoutKind,
      r.exerciseName,
      r.primaryMuscle,
      r.equipment,
      r.trackingType,
      numbers[i],
      r.setType,
      r.completedAt != null,
      round(r.weightKg),
      ...(unit === "lb"
        ? [r.weightKg == null ? null : round(kgToLb(r.weightKg))]
        : []),
      r.weightKg == null ? null : assisted,
      r.reps,
      r.seconds,
      round(r.distanceM),
      r.rpe,
      r.targetRpe,
      round(r.estimated1rm),
      r.exerciseNotes,
      r.workoutNote,
    ];
    lines.push(cells.map(csvCell).join(","));
  });

  return "﻿" + lines.join("\r\n") + "\r\n";
}

/* -------------------------------------------------------------------------- */
/* JSON                                                                        */
/* -------------------------------------------------------------------------- */

export type HistoryJsonSet = {
  setNumber: number | null;
  setType: string;
  completed: boolean;
  completedAt: string | null;
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  targetRpe: number | null;
  estimated1rmKg: number | null;
};

export type HistoryDocument = {
  format: typeof HISTORY_FORMAT;
  version: typeof HISTORY_VERSION;
  exportedAt: string;
  /** The lifter's display unit. Every weight in the file is kilograms. */
  displayUnit: Unit;
  /** Set when the export is one exercise's history rather than everything. */
  exercise: string | null;
  workouts: {
    name: string;
    kind: string;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number;
    loadMultiplier: number;
    note: string | null;
    totals: {
      volumeKg: number;
      sets: number;
      reps: number;
      prCount: number;
    };
    exercises: {
      name: string;
      slug: string | null;
      primaryMuscle: string;
      equipment: string;
      trackingType: string;
      notes: string | null;
      sets: HistoryJsonSet[];
    }[];
  }[];
  records: {
    exercise: string;
    slug: string | null;
    kind: string;
    value: number;
    weightKg: number | null;
    reps: number | null;
    achievedAt: string;
  }[];
};

export function buildHistoryDocument(
  rows: readonly ExportSetRow[],
  records: readonly ExportRecordRow[],
  opts: { unit: Unit; now: Date; exerciseName?: string | null },
): HistoryDocument {
  const numbers = setNumbers(rows);
  const workouts: HistoryDocument["workouts"] = [];
  let wKey = "";
  let eKey = "";

  rows.forEach((r, i) => {
    if (r.workoutKey !== wKey) {
      wKey = r.workoutKey;
      eKey = "";
      workouts.push({
        name: r.workoutName,
        kind: r.workoutKind,
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString() ?? null,
        durationSeconds: r.durationSeconds,
        loadMultiplier: r.loadMultiplier,
        note: r.workoutNote,
        totals: {
          volumeKg: round(r.totalVolumeKg) ?? 0,
          sets: r.totalSets,
          reps: r.totalReps,
          prCount: r.prCount,
        },
        exercises: [],
      });
    }
    const w = workouts[workouts.length - 1];
    if (r.workoutExerciseKey !== eKey) {
      eKey = r.workoutExerciseKey;
      w.exercises.push({
        name: r.exerciseName,
        slug: r.exerciseSlug,
        primaryMuscle: r.primaryMuscle,
        equipment: r.equipment,
        trackingType: r.trackingType,
        notes: r.exerciseNotes,
        sets: [],
      });
    }
    w.exercises[w.exercises.length - 1].sets.push({
      setNumber: numbers[i],
      setType: r.setType,
      completed: r.completedAt != null,
      completedAt: r.completedAt?.toISOString() ?? null,
      weightKg: round(r.weightKg),
      reps: r.reps,
      seconds: r.seconds,
      distanceM: round(r.distanceM),
      rpe: r.rpe,
      targetRpe: r.targetRpe,
      estimated1rmKg: round(r.estimated1rm),
    });
  });

  return {
    format: HISTORY_FORMAT,
    version: HISTORY_VERSION,
    exportedAt: opts.now.toISOString(),
    displayUnit: opts.unit,
    exercise: opts.exerciseName ?? null,
    workouts,
    records: records.map((r) => ({
      exercise: r.exerciseName,
      slug: r.exerciseSlug,
      kind: r.kind,
      value: round(r.value) ?? 0,
      weightKg: round(r.weightKg),
      reps: r.reps,
      achievedAt: r.achievedAt.toISOString(),
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Filenames                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `pump-history-2026-11-18.csv`, or `pump-bench-press-barbell-2026-11-18.json`
 * for one exercise. Letters outside ASCII are kept — a Hebrew exercise name
 * would otherwise slug to nothing — and anything a filesystem dislikes becomes
 * a hyphen.
 */
export function historyFilename(
  format: "csv" | "json",
  on: Date,
  exerciseName?: string | null,
): string {
  const slug = exerciseName
    ? exerciseName
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
        .replace(/-+$/, "") || "exercise"
    : "history";
  return `pump-${slug}-${isoDay(on)}.${format}`;
}
