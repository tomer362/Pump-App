import { describe, expect, it } from "vitest";
import {
  estimate1RM,
  formatDayLabel,
  formatShortDate,
  formatWeight,
  kgToLb,
  lbToKg,
} from "@/lib/utils";
import { streaks } from "@/lib/streaks";
import { isUuid } from "@/lib/uuid";
import {
  alignPrevious,
  sanitizeDecimalInput,
  workingSetNumber,
} from "@/lib/set-input";
import { makeJoinCode } from "@/lib/join-code";
import { exceedsImportBytes, MAX_IMPORT_BYTES } from "@/lib/routine-transfer";
import { isBlobUrl } from "@/lib/blob";
import { exerciseVideoLink, isYouTubeUrl } from "@/lib/exercise-video";
import {
  dayKeyBounds,
  dayKeyToLocalDate,
  dayKeyToNoonUtc,
  isDayKey,
  shiftDay,
  toDayKey,
} from "@/lib/day";
import {
  escapeLike,
  tokenizeQuery,
  MAX_QUERY_TOKENS,
} from "@/lib/exercise-search-terms";
import {
  RPE_VALUES,
  formatRpe,
  prescribedToken,
  ratedToken,
  ratedWord,
  rpeInput,
  rpeRangeLabel,
  rpeSubscript,
  rpeValue,
  snapRpe,
  uniformRpe,
} from "@/lib/rpe";

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

describe("exerciseVideoLink", () => {
  it("uses a curated URL when one is stored", () => {
    const link = exerciseVideoLink({
      name: "Bench Press (Barbell)",
      videoUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    });
    expect(link).toEqual({
      href: "https://www.youtube.com/watch?v=abcdefghijk",
      curated: true,
    });
  });

  it("falls back to an encoded YouTube search", () => {
    // curated:false is what stops the UI calling a results page a demo.
    const link = exerciseVideoLink({ name: "Farmer's Walk", videoUrl: null });
    expect(link.curated).toBe(false);
    expect(link.href).toBe(
      "https://www.youtube.com/results?search_query=Farmer's%20Walk%20proper%20form",
    );
    // No raw spaces or quotes can reach the href.
    expect(link.href).not.toMatch(/[ "<>]/);
  });
});

describe("isYouTubeUrl", () => {
  it("accepts watch and youtu.be URLs", () => {
    for (const url of [
      "https://www.youtube.com/watch?v=abcdefghijk",
      "https://youtube.com/watch?v=ab-de_ghijk",
      "https://m.youtube.com/watch?v=abcdefghijk",
      "https://youtu.be/abcdefghijk",
      "https://www.youtube.com/watch?v=abcdefghijk&t=42",
    ]) {
      expect(isYouTubeUrl(url), url).toBe(true);
    }
  });

  it("rejects anything that isn't one", () => {
    // Parsed with URL, never matched against the raw string — which is how
    // javascript: and lookalike hosts get through a regex.
    for (const url of [
      "javascript:alert(1)",
      "http://www.youtube.com/watch?v=abcdefghijk",
      "https://youtube.com.evil.test/watch?v=abcdefghijk",
      "https://www.youtube.com.evil.test/watch?v=abcdefghijk",
      "//youtube.com/watch?v=abcdefghijk",
      "https://www.youtube.com/watch?v=short",
      "https://www.youtube.com/results?search_query=x",
      "https://youtu.be/",
      "not a url",
      "",
    ]) {
      expect(isYouTubeUrl(url), url).toBe(false);
    }
  });
});

describe("day keys", () => {
  it("reads a date's *local* calendar day, not its UTC one", () => {
    // toISOString().slice(0,10) is the tempting one-liner and it is wrong: it
    // reports UTC, so a user west of Greenwich logging in the evening would
    // have "today" resolve to tomorrow.
    const d = new Date(2026, 7, 8, 23, 30);
    expect(toDayKey(d)).toBe("2026-08-08");
  });

  it("pads single-digit months and days", () => {
    expect(toDayKey(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("shifts across month, year and leap-day boundaries", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-08-08", -365)).toBe("2025-08-08");
    expect(shiftDay("2026-08-08", 1)).toBe("2026-08-09");
  });

  it("rejects a well-shaped string that isn't a real date", () => {
    expect(isDayKey("2026-08-08")).toBe(true);
    expect(isDayKey("2024-02-29")).toBe(true);
    // Shape alone would let all of these through, and `new Date` would turn
    // them into an Invalid Date or silently roll them over.
    expect(isDayKey("2026-13-40")).toBe(false);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2025-02-29")).toBe(false);
    expect(isDayKey("2026-00-10")).toBe(false);
    expect(isDayKey("26-08-08")).toBe(false);
    expect(isDayKey("2026-8-8")).toBe(false);
    expect(isDayKey("")).toBe(false);
  });

  it("stamps a backdated row at noon UTC", () => {
    // Noon, so that DATE(started_at) is the day the user picked *and* a client
    // rendering it locally reads back the same date at every offset in
    // (-12, +12). Midnight would render as the previous day everywhere west.
    expect(dayKeyToNoonUtc("2026-08-08").toISOString()).toBe(
      "2026-08-08T12:00:00.000Z",
    );
  });

  it("bounds a day as a half-open UTC range", () => {
    const { start, end } = dayKeyBounds("2026-08-08");
    expect(start.toISOString()).toBe("2026-08-08T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-09T00:00:00.000Z");
    // The noon stamp has to fall inside its own day's bounds, or a second
    // backdated set would open a second session.
    const noon = dayKeyToNoonUtc("2026-08-08");
    expect(noon >= start && noon < end).toBe(true);
  });

  it("round-trips a key through a local date", () => {
    expect(toDayKey(dayKeyToLocalDate("2026-08-08"))).toBe("2026-08-08");
  });
});

describe("formatDayLabel", () => {
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  it("names the last week relatively", () => {
    expect(formatDayLabel(daysAgo(0))).toBe("Today");
    expect(formatDayLabel(daysAgo(1))).toBe("Yesterday");
    expect(formatDayLabel(daysAgo(3))).toMatch(
      /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/,
    );
  });

  it("spells older dates itself rather than through Intl", () => {
    // Node ships a cut-down ICU and renders "Thu 30 Jul" where Chromium renders
    // "Thu, 30 Jul". On a server-rendered label that is a hydration mismatch,
    // and React throws the subtree away — it took out the whole history list.
    // Backdating a set is the shortest path to a workout old enough to hit it.
    expect(formatDayLabel(new Date(2026, 6, 30))).toBe("Thu 30 Jul");
    expect(formatDayLabel(new Date(2020, 0, 1))).toBe("Wed 1 Jan 2020");
    expect(formatShortDate(new Date(2026, 3, 14))).toBe("14 Apr");
  });

  it("carries the year only when it isn't this one", () => {
    const old = daysAgo(30);
    expect(formatDayLabel(old).includes(String(old.getFullYear()))).toBe(false);
  });
});

describe("exercise search terms", () => {
  it("splits a query into tokens in the order typed", () => {
    expect(tokenizeQuery("incline dumbbell")).toEqual(["incline", "dumbbell"]);
    expect(tokenizeQuery("  bench   press  barbell ")).toEqual([
      "bench",
      "press",
      "barbell",
    ]);
  });

  it("treats a blank query as no filter at all", () => {
    // The callers read `[]` as "don't constrain the name", so a stray space
    // must not become a token that matches everything.
    expect(tokenizeQuery("")).toEqual([]);
    expect(tokenizeQuery("   ")).toEqual([]);
    expect(tokenizeQuery("\n\t")).toEqual([]);
  });

  it("caps how many tokens one query contributes", () => {
    const long = tokenizeQuery("a b c d e f g h i j k");
    expect(long).toHaveLength(MAX_QUERY_TOKENS);
    expect(long[0]).toBe("a");
  });

  it("neutralises ILIKE wildcards", () => {
    // Before this, searching "%" matched the whole library and "_" matched
    // anything at least one character long.
    expect(escapeLike("%")).toBe("\\%");
    expect(escapeLike("_")).toBe("\\_");
    expect(escapeLike("100%_pure")).toBe("100\\%\\_pure");
  });

  it("escapes the backslash before the wildcards it introduces", () => {
    // Order matters: escaping % first and \ second would double-escape and
    // turn a literal backslash into an escape for the character after it.
    expect(escapeLike("\\")).toBe("\\\\");
    expect(escapeLike("\\%")).toBe("\\\\\\%");
  });

  it("leaves ordinary exercise names alone", () => {
    expect(escapeLike("Bench Press (Barbell)")).toBe("Bench Press (Barbell)");
  });
});

describe("rpe", () => {
  it("keeps the scale and the picker in agreement", () => {
    // The regression test for the class of bug that lost 6.5: the builder used
    // to hand-roll its chips from its own array, so a routine could not
    // prescribe an effort a logged set was able to record.
    expect(RPE_VALUES.every((v) => rpeValue.safeParse(v).success)).toBe(true);
    expect(rpeValue.safeParse(6.25).success).toBe(false);
    expect(rpeValue.safeParse(5.5).success).toBe(false);
    expect(rpeValue.safeParse(11).success).toBe(false);
  });

  it("renders a rating and a prescription as different glyphs", () => {
    // Not different shades: two greys at 9px on a phone are not a difference,
    // and on a completed row's volt tint they collapse entirely.
    expect(ratedToken(8)).toBe("@8");
    expect(prescribedToken(8)).toBe("→8");
    expect(ratedToken(null)).toBe("@–");
    expect(ratedWord(null)).toBe("RPE —");
    expect(ratedWord(6.5)).toBe("RPE 6.5");
    // No trailing zero: the scale is written 8, not 8.0.
    expect(formatRpe(8)).toBe("8");
    expect(formatRpe(6.5)).toBe("6.5");
  });

  it("never calls a prescription a rating", () => {
    // The whole table, both values crossed with completed — this is the bug
    // that started all of it: a prescription rendered in the rating's slot.
    for (const completed of [false, true]) {
      expect(rpeSubscript({ rpe: null, targetRpe: 8, completed })?.kind).not.toBe(
        "rated",
      );
    }

    expect(rpeSubscript({ rpe: null, targetRpe: 8, completed: false })).toEqual({
      text: "→8",
      kind: "prescribed",
    });
    // A rating wins once it exists: what you were told to aim for stops being
    // the useful number the moment you know what it felt like.
    expect(rpeSubscript({ rpe: 9, targetRpe: 8, completed: false })).toEqual({
      text: "@9",
      kind: "rated",
    });
    expect(rpeSubscript({ rpe: 9, targetRpe: 8, completed: true })).toEqual({
      text: "@9",
      kind: "rated",
    });
    expect(rpeSubscript({ rpe: 9, targetRpe: null, completed: true })).toEqual({
      text: "@9",
      kind: "rated",
    });
    // Done and unrated is the `@–` affordance, prescription or not: once the
    // set is over, the target is history and the gesture is what matters.
    expect(rpeSubscript({ rpe: null, targetRpe: 8, completed: true })).toEqual({
      text: "@–",
      kind: "owed",
    });
    expect(rpeSubscript({ rpe: null, targetRpe: null, completed: true })).toEqual({
      text: "@–",
      kind: "owed",
    });
    // Nothing prescribed, nothing done, nothing to say.
    expect(
      rpeSubscript({ rpe: null, targetRpe: null, completed: false }),
    ).toBeNull();
  });

  it("summarises a fold of sets without speaking for the first one", () => {
    expect(rpeRangeLabel([])).toBeNull();
    expect(rpeRangeLabel([null, null])).toBeNull();
    expect(rpeRangeLabel([8])).toBe("8");
    expect(rpeRangeLabel([8, 8, 8])).toBe("8");
    // The header used to read `sets[0]`, so this ramp announced itself as "7".
    expect(rpeRangeLabel([7, 8, 9])).toBe("7–9");
    expect(rpeRangeLabel([9, 7])).toBe("7–9");
    // A set with no prescription doesn't widen the range down to nothing.
    expect(rpeRangeLabel([null, 8, null])).toBe("8");
    expect(rpeRangeLabel([null, 7, 9])).toBe("7–9");
    expect(rpeRangeLabel([6.5, 6.5])).toBe("6.5");
  });

  it("reports one prescription only when every set agrees", () => {
    expect(uniformRpe([8, 8, 8])).toBe(8);
    expect(uniformRpe([8, 9])).toBeNull();
    // Mixed with a gap is still mixed — the picker must not light up the "—"
    // chip and claim "no prescription" about an exercise that has one.
    expect(uniformRpe([8, null])).toBeNull();
    expect(uniformRpe([null, null])).toBeNull();
    expect(uniformRpe([])).toBeNull();
  });

  it("snaps external input instead of refusing the whole import", () => {
    expect(snapRpe(7.3)).toBe(7.5);
    expect(snapRpe(7.2)).toBe(7);
    expect(snapRpe(8)).toBe(8);
    // Above the scale clamps. Below it, the snap happens first: 5.9's nearest
    // half point is 6, which is on the scale, so it lands there. Anything that
    // still falls short after rounding becomes "no prescription" rather than
    // being pushed up to 6, which would invent a number nobody wrote.
    expect(snapRpe(10.4)).toBe(10);
    expect(snapRpe(5.9)).toBe(6);
    expect(snapRpe(5.7)).toBeNull();
    expect(snapRpe(3)).toBeNull();
    expect(snapRpe(null)).toBeNull();
    expect(snapRpe(Number.NaN)).toBeNull();
  });

  it("accepts the same 1–10 band on both sides of the import", () => {
    // `routineInputSchema` and `routineDocumentSchema` share `rpeInput`, so a
    // file the app writes can never be a file it then refuses to read.
    expect(rpeInput.safeParse(7.3).data).toBe(7.5);
    expect(rpeInput.safeParse(3).data).toBeNull();
    expect(rpeInput.safeParse(0).success).toBe(false);
    expect(rpeInput.safeParse(11).success).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts a v4 uuid in either case", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  it("refuses everything an action would otherwise hand to Postgres", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid("coop")).toBe(false);
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c330")).toBe(false);
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301 ")).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid({ toString: () => "3f2504e0-4f89-41d3-9a0c-0305e82c3301" })).toBe(false);
  });
});

describe("makeJoinCode", () => {
  it("is six characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      expect(makeJoinCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("does not hand out the same code every time", () => {
    const seen = new Set(Array.from({ length: 50 }, () => makeJoinCode()));
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe("exceedsImportBytes", () => {
  it("measures bytes, not UTF-16 code units", () => {
    // Three bytes per character: a document that is under the cap by
    // `.length` and over it by size.
    const doc = "\u20ac".repeat(MAX_IMPORT_BYTES / 3 + 1);
    expect(doc.length).toBeLessThan(MAX_IMPORT_BYTES);
    expect(exceedsImportBytes(doc)).toBe(true);
    expect(exceedsImportBytes("a".repeat(MAX_IMPORT_BYTES))).toBe(false);
    expect(exceedsImportBytes("a".repeat(MAX_IMPORT_BYTES + 1))).toBe(true);
  });
});

describe("sanitizeDecimalInput", () => {
  it("treats a comma as the decimal point", () => {
    expect(sanitizeDecimalInput("22,5")).toBe("22.5");
    expect(sanitizeDecimalInput("22,5", true)).toBe("225".slice(0, 2) + "5");
  });

  it("keeps one dot and drops the rest", () => {
    expect(sanitizeDecimalInput("1.2.3")).toBe("1.23");
    expect(sanitizeDecimalInput("..5")).toBe(".5");
    expect(sanitizeDecimalInput("100")).toBe("100");
  });

  it("strips everything that isn't a digit", () => {
    expect(sanitizeDecimalInput("12kg")).toBe("12");
    expect(sanitizeDecimalInput("-5")).toBe("5");
    expect(sanitizeDecimalInput("")).toBe("");
  });
});

describe("workingSetNumber", () => {
  const sets = [
    { setType: "warmup" },
    { setType: "normal" },
    { setType: "warmup" },
    { setType: "drop" },
    { setType: "normal" },
  ];
  it("does not spend a number on a warm-up", () => {
    expect(sets.map((_, i) => workingSetNumber(sets, i))).toEqual([0, 1, 1, 2, 3]);
  });
});

describe("alignPrevious", () => {
  const prev = [
    { setType: "warmup", w: 40 },
    { setType: "normal", w: 100 },
    { setType: "normal", w: 100 },
  ];
  it("matches warm-ups to warm-ups and working sets to working sets", () => {
    const sets = [
      { setType: "warmup" },
      { setType: "warmup" },
      { setType: "normal" },
      { setType: "normal" },
      { setType: "normal" },
    ];
    expect(alignPrevious(prev, sets).map((p) => p?.w ?? null)).toEqual([
      40, null, 100, 100, null,
    ]);
  });

  it("is not thrown off by a session with no warm-up", () => {
    const sets = [{ setType: "normal" }, { setType: "normal" }];
    expect(alignPrevious(prev, sets).map((p) => p?.w ?? null)).toEqual([100, 100]);
  });
});
