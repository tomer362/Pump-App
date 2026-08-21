import { describe, expect, it } from "vitest";
import {
  isScoring,
  recordsSomething,
  sumSetTotals,
} from "@/lib/workout-totals";

/**
 * `finishWorkout` and `quickLogSet` both write the denormalised counters on
 * `workout`, which the feed, history and co-op poll read instead of
 * re-aggregating. Two implementations of "what counts" would eventually
 * disagree, and the disagreement would only ever show up as a wrong number in
 * someone's feed — so the rule lives in one pure function, asserted here.
 */

const set = (o: Partial<Parameters<typeof isScoring>[0]> = {}) => ({
  setType: "normal",
  weightKg: 100,
  reps: 5,
  completedAt: new Date(),
  ...o,
});

describe("sumSetTotals", () => {
  it("multiplies weight by reps across completed working sets", () => {
    expect(
      sumSetTotals([set(), set({ weightKg: 60, reps: 10 })]),
    ).toEqual({ totalVolumeKg: 500 + 600, totalSets: 2, totalReps: 15 });
  });

  it("excludes warm-ups from every counter", () => {
    // Warm-ups inflate volume, records and muscle volume — every read query
    // filters them, so the write side has to agree.
    const totals = sumSetTotals([set(), set({ setType: "warmup" })]);
    expect(totals).toEqual({ totalVolumeKg: 500, totalSets: 1, totalReps: 5 });
  });

  it("excludes sets that were never ticked", () => {
    const totals = sumSetTotals([set(), set({ completedAt: null })]);
    expect(totals).toEqual({ totalVolumeKg: 500, totalSets: 1, totalReps: 5 });
  });

  it("treats a missing weight or rep count as zero volume, not NaN", () => {
    // Bodyweight and time-tracked sets arrive with nulls. A NaN here would be
    // written straight into `workout.total_volume_kg`.
    const totals = sumSetTotals([
      set({ weightKg: null }),
      set({ weightKg: 80, reps: null }),
    ]);
    expect(totals.totalVolumeKg).toBe(0);
    expect(totals.totalReps).toBe(5);
    expect(totals.totalSets).toBe(2);
  });

  it("counts no volume for an assisted machine's counterweight", () => {
    // `assist_reps` puts the machine's help in the weight column, so the number
    // is what you did *not* lift. Multiplying it into tonnage would make the
    // session you needed the most help on your biggest day — and would let an
    // assisted pull-up out-volume the real one it is a scaffold toward.
    const totals = sumSetTotals([
      set({ trackingType: "assist_reps", weightKg: 40, reps: 8 }),
      set({ weightKg: 100, reps: 5 }),
    ]);
    expect(totals).toEqual({ totalVolumeKg: 500, totalSets: 2, totalReps: 13 });
  });

  it("still counts an assisted set's reps and its set", () => {
    // Only the load is meaningless. Dropping the set entirely would make an
    // assisted session look like no session at all.
    const totals = sumSetTotals([
      set({ trackingType: "assist_reps", weightKg: 45, reps: 6 }),
    ]);
    expect(totals).toEqual({ totalVolumeKg: 0, totalSets: 1, totalReps: 6 });
  });

  it("is zero for an empty workout rather than throwing", () => {
    expect(sumSetTotals([])).toEqual({
      totalVolumeKg: 0,
      totalSets: 0,
      totalReps: 0,
    });
  });
});

describe("recordsSomething", () => {
  it("accepts a set with reps, seconds or distance", () => {
    expect(recordsSomething({ reps: 1, seconds: null, distanceM: null })).toBe(
      true,
    );
    expect(recordsSomething({ reps: null, seconds: 30, distanceM: null })).toBe(
      true,
    );
    expect(recordsSomething({ reps: null, seconds: null, distanceM: 400 })).toBe(
      true,
    );
  });

  it("rejects an empty row", () => {
    // Quick-log and finishWorkout both refuse these: a 0×0 set is a plan, not
    // a performance.
    expect(recordsSomething({ reps: 0, seconds: 0, distanceM: 0 })).toBe(false);
    expect(
      recordsSomething({ reps: null, seconds: null, distanceM: null }),
    ).toBe(false);
  });
});
