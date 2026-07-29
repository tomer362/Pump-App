import { describe, expect, it } from "vitest";
import { estimate1RM, formatWeight, kgToLb, lbToKg } from "@/lib/utils";
import { streaks } from "@/lib/streaks";
import { isBlobUrl } from "@/lib/blob";
import { exerciseVideoLink, isYouTubeUrl } from "@/lib/exercise-video";

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
