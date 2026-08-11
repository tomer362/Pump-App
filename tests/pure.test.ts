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
