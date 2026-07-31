import { describe, expect, it } from "vitest";
import { estimate1RM, formatWeight, kgToLb, lbToKg } from "@/lib/utils";
import { streaks } from "@/lib/streaks";
import { isBlobUrl } from "@/lib/blob";
import { cascadeBelow } from "@/components/workout/set-row";

describe("estimate1RM (Epley)", () => {
  it("is the weight itself at one rep", () => {
    // Epley's formula would give w * 1.033 at r=1, which is wrong: a single is
    // the 1RM by definition.
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it("applies w * (1 + r/30)", () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(estimate1RM(60, 5)).toBeCloseTo(70, 5);
  });

  it("returns 0 rather than a negative or NaN estimate", () => {
    // Bodyweight and unlogged sets both arrive here as zeroes; a PR comparison
    // against NaN silently never fires.
    expect(estimate1RM(0, 8)).toBe(0);
    expect(estimate1RM(100, 0)).toBe(0);
    expect(estimate1RM(-5, 5)).toBe(0);
  });
});

describe("unit conversion", () => {
  it("round-trips", () => {
    for (const kg of [1, 2.5, 20, 60, 142.5]) {
      expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 9);
    }
  });

  it("formats without trailing noise", () => {
    expect(formatWeight(60, "kg")).toBe("60");
    expect(formatWeight(62.5, "kg")).toBe("62.5");
    // 60 kg is 132.28 lb — one decimal, not the full float.
    expect(formatWeight(60, "lb")).toBe("132.3");
  });
});

describe("streaks", () => {
  const day = (iso: string) => new Date(`${iso}T00:00:00`);
  const NOW = new Date("2026-07-26T18:00:00");

  it("is zero with no history", () => {
    expect(streaks([], NOW)).toEqual({ current: 0, longest: 0 });
  });

  it("counts consecutive days ending today", () => {
    const days = ["2026-07-26", "2026-07-25", "2026-07-24"].map(day);
    expect(streaks(days, NOW)).toEqual({ current: 3, longest: 3 });
  });

  it("survives a rest day today", () => {
    // Trained yesterday, not yet today: the streak is alive until tomorrow.
    const days = ["2026-07-25", "2026-07-24"].map(day);
    expect(streaks(days, NOW).current).toBe(2);
  });

  it("breaks after two days off", () => {
    const days = ["2026-07-23", "2026-07-22"].map(day);
    expect(streaks(days, NOW).current).toBe(0);
  });

  it("reports the longest run even when the current one is broken", () => {
    const days = [
      "2026-07-20",
      "2026-07-19",
      "2026-07-18",
      "2026-07-17",
      "2026-07-10",
    ].map(day);
    expect(streaks(days, NOW)).toEqual({ current: 0, longest: 4 });
  });

  it("ignores a same-day duplicate rather than counting it twice", () => {
    // DISTINCT DATE() upstream should prevent this, but a gap of 0 must not
    // inflate the run if one ever slips through.
    const days = ["2026-07-26", "2026-07-26", "2026-07-25"].map(day);
    expect(streaks(days, NOW).current).toBe(1);
  });
});

describe("cascadeBelow", () => {
  type S = { id: string; weightKg: number | null; completed: boolean };

  const blank = (): S[] =>
    ["a", "b", "c", "d"].map((id) => ({
      id,
      weightKg: null,
      completed: false,
    }));

  /** One cascade run, driven keystroke by keystroke the way a cell drives it. */
  function run(sets: S[]) {
    let owned = new Set<string>();
    return {
      /** A value cell taking focus — the run starts over and owns nothing. */
      focus() {
        owned = new Set();
      },
      type(sourceId: string, value: number | null) {
        const from = sets.findIndex((s) => s.id === sourceId);
        const r = cascadeBelow({
          sets: sets.map((s) =>
            s.id === sourceId ? { ...s, weightKg: value } : s,
          ),
          from,
          field: "weightKg" as const,
          value,
          keyOf: (s) => s.id,
          owned,
          locked: (s) => s.completed,
        });
        sets = r.sets;
        owned = new Set(r.filled);
        return r.filled;
      },
      get values() {
        return sets.map((s) => s.weightKg);
      },
    };
  }

  it("follows the source cell rather than freezing on the first digit", () => {
    const r = run(blank());
    r.focus();
    r.type("a", 1);
    expect(r.values).toEqual([1, 1, 1, 1]);
    r.type("a", 10);
    r.type("a", 100);
    expect(r.values).toEqual([100, 100, 100, 100]);
  });

  it("empties what it filled when the source is cleared", () => {
    const r = run(blank());
    r.focus();
    r.type("a", 1);
    r.type("a", null);
    expect(r.values).toEqual([null, null, null, null]);
  });

  it("skips a set the lifter filled in and carries on past it", () => {
    const sets = blank();
    sets[2].weightKg = 60;
    const r = run(sets);
    r.focus();
    expect(r.type("a", 40)).toEqual(["b", "d"]);
    expect(r.values).toEqual([40, 40, 60, 40]);
  });

  it("leaves a completed set alone — it's a record, not a plan", () => {
    const sets = blank();
    sets[1] = { id: "b", weightKg: 20, completed: true };
    const r = run(sets);
    r.focus();
    expect(r.type("a", 40)).toEqual(["c", "d"]);
    expect(r.values).toEqual([40, 20, 40, 40]);
  });

  it("never reaches upward", () => {
    const r = run(blank());
    r.focus();
    r.type("c", 50);
    expect(r.values).toEqual([null, null, 50, 50]);
  });

  it("hands a corrected set back to the lifter", () => {
    // 100 into set 1 fills the rest; correcting set 3 to 8 must not drag set 4
    // down with it, and must not be undone by the run that filled it.
    const r = run(blank());
    r.focus();
    r.type("a", 1);
    r.type("a", 10);
    r.type("a", 100);
    expect(r.type("a", 100)).toEqual(["b", "c", "d"]);

    r.focus();
    expect(r.type("c", 8)).toEqual([]);
    expect(r.values).toEqual([100, 100, 8, 100]);
  });
});

describe("isBlobUrl", () => {
  it("accepts our own store", () => {
    expect(
      isBlobUrl("https://abc123.public.blob.vercel-storage.com/avatars/x.jpg"),
    ).toBe(true);
  });

  it("rejects anything else a caller could hand us", () => {
    for (const url of [
      "http://abc.public.blob.vercel-storage.com/x.jpg", // not https
      "https://evil.com/x.jpg",
      // The suffix has to be a domain boundary, not a substring.
      "https://evil.com/?.public.blob.vercel-storage.com",
      "https://notpublic.blob.vercel-storage.com.evil.com/x.jpg",
      "javascript:alert(1)",
      "",
      "not a url",
    ]) {
      expect(isBlobUrl(url), url).toBe(false);
    }
  });
});
