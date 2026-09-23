import { describe, expect, it } from "vitest";
import { PROMPT_EXAMPLE } from "@/lib/routine-prompt";
import {
  diffRoutine,
  isUnchanged,
  summarizeSets,
  type DiffExercise,
} from "@/lib/routine-diff";

/**
 * The update preview's diff. The document carries each routine whole, so this
 * is the only thing standing between "replaces Upper A" and the lifter seeing
 * that their face pulls went missing.
 */
const base = PROMPT_EXAMPLE.routine;
const keyed = (exs = base.exercises, keys = ["bench", "pullup", "plank"]) =>
  exs.map((entry, i): DiffExercise => ({ key: keys[i], entry }));
const side = (
  exercises: DiffExercise[],
  extra: { name?: string; notes?: string | null } = {},
) => ({
  name: base.name,
  notes: base.notes,
  exercises,
  ...extra,
});

describe("routine diff", () => {
  it("finds nothing in an identical routine", () => {
    const d = diffRoutine(side(keyed()), side(keyed()));
    expect(isUnchanged(d)).toBe(true);
  });

  it("reports an added and a removed exercise", () => {
    const [bench, pullup, plank] = base.exercises;
    const d = diffRoutine(
      side(keyed()),
      side(keyed([bench, pullup, { ...plank }], ["bench", "pullup", "dip"])),
    );
    expect(d.lines.map((l) => [l.kind, l.name])).toEqual([
      ["added", "Plank"],
      ["removed", "Plank"],
    ]);
  });

  it("describes a set change in the lifter's unit", () => {
    const [bench, ...rest] = base.exercises;
    const heavier = {
      ...bench,
      sets: [...bench.sets, { ...bench.sets[1], targetWeightKg: 85 }],
    };
    const d = diffRoutine(side(keyed()), side(keyed([heavier, ...rest])));
    expect(d.lines).toHaveLength(1);
    const line = d.lines[0];
    expect(line.kind).toBe("changed");
    expect(line.kind === "changed" && line.changes[0]).toBe(
      "warm-up 40 kg · 8 reps, 80 kg · 5 reps →8 → warm-up 40 kg · 8 reps, 80 kg · 5 reps →8, 85 kg · 5 reps →8",
    );
  });

  it("notices rest, superset and notes separately", () => {
    const [bench, pullup, plank] = base.exercises;
    const d = diffRoutine(
      side(keyed()),
      side(
        keyed([
          { ...bench, restSeconds: 240, notes: null },
          { ...pullup, supersetGroup: null },
          plank,
        ]),
      ),
    );
    const changes = d.lines.flatMap((l) => (l.kind === "changed" ? l.changes : []));
    expect(changes).toEqual(["rest 180 s → 240 s", "notes", "no longer a superset"]);
  });

  it("flags a reorder without calling it an add and a remove", () => {
    const [bench, pullup, plank] = base.exercises;
    const d = diffRoutine(
      side(keyed()),
      side(keyed([pullup, bench, plank], ["pullup", "bench", "plank"])),
    );
    expect(d.reordered).toBe(true);
    expect(d.lines).toEqual([]);
  });

  it("pairs a repeated exercise occurrence by occurrence", () => {
    const [bench] = base.exercises;
    const twice = [bench, bench].map((entry) => ({ key: "bench", entry }));
    const once = [{ key: "bench", entry: bench }];
    const d = diffRoutine(side(twice), side(once));
    expect(d.lines.map((l) => l.kind)).toEqual(["removed"]);
  });

  it("folds runs of equal sets", () => {
    const s = base.exercises[0].sets[1];
    expect(summarizeSets([s, s, s], "kg")).toBe("3 × 80 kg · 5 reps →8");
  });
});
