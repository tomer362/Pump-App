import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildHistoryDocument,
  csvCell,
  historyFilename,
  toHistoryCsv,
  type ExportSetRow,
} from "@/lib/history-export";

/**
 * The history export. The pure half pins the file format — quoting, the
 * formula guard, warm-up numbering, units — and the database half pins what
 * gets read: only the caller's own sets, only from finished workouts.
 */

let actingUserId = "";
let actingUnit: "kg" | "lb" = "kg";

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: async () => ({
    id: actingUserId,
    name: "Test Lifter",
    email: `${actingUserId}@test.invalid`,
    unit: actingUnit,
    defaultRestSeconds: 120,
    homeGymId: null,
    username: null,
    image: null,
    bio: null,
  }),
  requireUser: async () => {
    throw new Error("not used");
  },
}));

const day = new Date("2026-03-04T12:00:00.000Z");

function row(over: Partial<ExportSetRow> = {}): ExportSetRow {
  return {
    workoutKey: "w1",
    workoutExerciseKey: "we1",
    workoutName: "Push",
    workoutKind: "session",
    workoutNote: null,
    startedAt: day,
    endedAt: new Date(day.getTime() + 3_600_000),
    durationSeconds: 3600,
    loadMultiplier: 1,
    totalVolumeKg: 1000,
    totalSets: 3,
    totalReps: 24,
    prCount: 0,
    exerciseName: "Bench Press (Barbell)",
    exerciseSlug: "bench-press-barbell",
    primaryMuscle: "chest",
    equipment: "barbell",
    trackingType: "weight_reps",
    exerciseNotes: null,
    setType: "normal",
    weightKg: 100,
    reps: 5,
    seconds: null,
    distanceM: null,
    rpe: null,
    targetRpe: null,
    completedAt: day,
    estimated1rm: 116.6666,
    ...over,
  };
}

function parse(csv: string): string[][] {
  // Enough of RFC 4180 to read back what the writer produces.
  const out: string[][] = [];
  let cell = "";
  let line: string[] = [];
  let q = false;
  const s = csv.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      line.push(cell);
      cell = "";
    } else if (c === "\r" && s[i + 1] === "\n") {
      line.push(cell);
      out.push(line);
      line = [];
      cell = "";
      i++;
    } else cell += c;
  }
  return out;
}

describe("CSV format", () => {
  it("quotes, escapes and defuses formulas", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-40")).toBe("'-40");
    expect(csvCell(-40)).toBe("-40");
    expect(csvCell(null)).toBe("");
    expect(csvCell(true)).toBe("yes");
  });

  it("starts with a BOM, numbers warm-ups out, adds pounds for a pound user", () => {
    const csv = toHistoryCsv(
      [
        row({ setType: "warmup", weightKg: 60 }),
        row(),
        row({ completedAt: null }),
        row({ workoutExerciseKey: "we2", exerciseName: 'Fly, "cable"' }),
      ],
      "lb",
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const [head, ...body] = parse(csv);
    const col = (name: string) => head.indexOf(name);
    expect(col("weight_lb")).toBeGreaterThan(-1);
    expect(body.map((r) => r[col("set_number")])).toEqual(["", "1", "2", "1"]);
    expect(body[1][col("weight_lb")]).toBe("220.46");
    expect(body[1][col("estimated_1rm_kg")]).toBe("116.67");
    expect(body[2][col("completed")]).toBe("no");
    expect(body[3][col("exercise")]).toBe('Fly, "cable"');
    expect(body[0][col("date")]).toBe("2026-03-04");
  });

  it("has no pound column for a kilogram user, and flags assistance", () => {
    const csv = toHistoryCsv(
      [row({ trackingType: "assist_reps", weightKg: 40 })],
      "kg",
    );
    const [head, r] = parse(csv);
    expect(head).not.toContain("weight_lb");
    expect(r[head.indexOf("weight_kg")]).toBe("40");
    expect(r[head.indexOf("weight_is_assistance")]).toBe("yes");
  });
});

describe("JSON format", () => {
  it("nests sets under exercises under workouts and carries no ids", () => {
    const doc = buildHistoryDocument(
      [
        row(),
        row({ workoutExerciseKey: "we2", exerciseName: "Dip" }),
        row({ workoutKey: "w2", workoutExerciseKey: "we3" }),
      ],
      [
        {
          exerciseName: "Bench Press (Barbell)",
          exerciseSlug: "bench-press-barbell",
          kind: "weight",
          value: 100,
          weightKg: 100,
          reps: 5,
          achievedAt: day,
        },
      ],
      { unit: "kg", now: day },
    );
    expect(doc.format).toBe("pump.history");
    expect(doc.workouts).toHaveLength(2);
    expect(doc.workouts[0].exercises.map((e) => e.name)).toEqual([
      "Bench Press (Barbell)",
      "Dip",
    ]);
    expect(doc.records).toHaveLength(1);
    const text = JSON.stringify(doc);
    expect(text).not.toMatch(/"w1"|"we1"|Key/);
  });

  it("names files by date and exercise", () => {
    expect(historyFilename("csv", day)).toBe("pump-history-2026-03-04.csv");
    expect(historyFilename("json", day, "Bench Press (Barbell)")).toBe(
      "pump-bench-press-barbell-2026-03-04.json",
    );
    expect(historyFilename("csv", day, "לחיצת חזה")).toBe(
      "pump-לחיצת-חזה-2026-03-04.csv",
    );
  });
});

describe("exportHistory reads only what it should", async () => {
  const { db } = await import("@/lib/db");
  const { workout, workoutExercise, workoutSet, exercise } =
    await import("@/lib/db/schema");
  const { exportHistory } = await import("@/lib/actions/history-export");
  const { cleanup, makeExercise, makeFinishedWorkout, makeUser } =
    await import("./helpers");

  let me = "";
  let other = "";
  let lift = "";
  let othersCustom = "";

  beforeAll(async () => {
    me = await makeUser();
    other = await makeUser();
    lift = await makeExercise();
    await makeFinishedWorkout(me, lift, [
      { weightKg: 40, reps: 10, warmup: true },
      { weightKg: 100, reps: 5 },
      { weightKg: 105, reps: 3 },
    ]);
    // Someone else's session on the same lift.
    await makeFinishedWorkout(other, lift, [{ weightKg: 200, reps: 1 }]);

    // A live session of mine: must not appear.
    const [live] = await db
      .insert(workout)
      .values({ userId: me, name: "Live" })
      .returning({ id: workout.id });
    const [we] = await db
      .insert(workoutExercise)
      .values({ workoutId: live.id, exerciseId: lift, position: 0 })
      .returning({ id: workoutExercise.id });
    await db
      .insert(workoutSet)
      .values({
        workoutExerciseId: we.id,
        position: 0,
        weightKg: 999,
        reps: 1,
      });

    const [custom] = await db
      .insert(exercise)
      .values({
        name: "Their secret lift",
        primaryMuscle: "chest",
        equipment: "barbell",
        ownerId: other,
      })
      .returning({ id: exercise.id });
    othersCustom = custom.id;
  });

  afterAll(async () => {
    await cleanup([me, other], [lift]);
  });

  it("exports my finished sets and nothing else", async () => {
    actingUserId = me;
    actingUnit = "kg";
    const res = await exportHistory({ format: "csv" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const [head, ...body] = parse(res.data!.body);
    expect(body).toHaveLength(3);
    const weights = body.map((r) => r[head.indexOf("weight_kg")]);
    expect(weights).toEqual(["40", "100", "105"]);
    expect(res.data!.body).not.toContain("999");
    expect(res.data!.body).not.toContain("200");
    expect(res.data!.mime).toBe("text/csv");
  });

  it("scopes to one exercise, as JSON", async () => {
    actingUserId = me;
    const res = await exportHistory({ format: "json", exerciseId: lift });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const doc = JSON.parse(res.data!.body);
    expect(doc.workouts).toHaveLength(1);
    expect(
      doc.workouts[0].exercises[0].sets.map(
        (s: { setNumber: number | null }) => s.setNumber,
      ),
    ).toEqual([null, 1, 2]);
  });

  it("refuses another user's custom exercise and junk ids", async () => {
    actingUserId = me;
    const theirs = await exportHistory({
      format: "csv",
      exerciseId: othersCustom,
    });
    expect(theirs).toEqual({ ok: false, error: "Exercise not found" });
    const junk = await exportHistory({ format: "csv", exerciseId: "nope" });
    expect(junk.ok).toBe(false);
    const fmt = await exportHistory({ format: "xml" as "csv" });
    expect(fmt.ok).toBe(false);
  });

  it("says so when there is nothing to export", async () => {
    const fresh = await makeUser();
    actingUserId = fresh;
    const res = await exportHistory({ format: "csv" });
    expect(res.ok).toBe(false);
    await cleanup([fresh]);
  });
});
