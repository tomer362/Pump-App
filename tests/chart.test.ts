import { describe, expect, it } from "vitest";
import {
  MIN_SPAN_DAYS,
  change,
  compactNumber,
  nearestIndex,
  niceScale,
  niceStep,
  signed,
  timeDomain,
  timeTicks,
} from "@/lib/chart";

const DAY = 86_400_000;

describe("niceStep", () => {
  it("rounds an interval up to 1 / 2 / 2.5 / 5 × 10ⁿ", () => {
    expect(niceStep(1.3)).toBe(2);
    expect(niceStep(2.2)).toBe(2.5);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(130)).toBe(200);
    expect(niceStep(0.3)).toBe(0.5);
  });

  it("survives a degenerate interval", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-4)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
  });
});

describe("niceScale", () => {
  it("covers the range with three to five clean ticks", () => {
    const s = niceScale(12.7, 16.7);
    expect(s.lo).toBeLessThanOrEqual(12.7);
    expect(s.hi).toBeGreaterThanOrEqual(16.7);
    expect(s.ticks.length).toBeGreaterThanOrEqual(3);
    expect(s.ticks.length).toBeLessThanOrEqual(5);
    expect(s.ticks).toEqual([12, 14, 16, 18]);
  });

  it("pins the floor at zero for a bar chart, whatever the data does", () => {
    const s = niceScale(800, 2400, { zero: true });
    expect(s.lo).toBe(0);
    expect(s.ticks[0]).toBe(0);
    expect(s.hi).toBeGreaterThanOrEqual(2400);
  });

  it("gives a flat series a band to sit in rather than a zero-height axis", () => {
    const s = niceScale(60, 60);
    expect(s.hi).toBeGreaterThan(60);
    expect(s.lo).toBeLessThan(60);
    expect(s.ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("does not print floating-point residue on a tick", () => {
    const s = niceScale(0.1, 0.7);
    for (const t of s.ticks) expect(String(t).length).toBeLessThanOrEqual(4);
  });

  it("handles a bar chart of small counts without inventing fractions", () => {
    const s = niceScale(0, 3, { zero: true, maxTicks: 4 });
    expect(s.ticks.every((t) => Number.isInteger(t))).toBe(true);
    expect(s.hi).toBeGreaterThanOrEqual(3);
  });
});

describe("timeDomain", () => {
  const now = Date.UTC(2026, 8, 6, 12);

  it("starts at the first session inside the range and ends now", () => {
    const first = new Date(now - 80 * DAY);
    const d = timeDomain([first, new Date(now - 10 * DAY)], 365, now);
    expect(d.start).toBe(first.getTime());
    expect(d.end).toBe(now);
  });

  it("clips to the range when the history is older than it", () => {
    const d = timeDomain([new Date(now - 400 * DAY)], 90, now);
    expect(d.start).toBe(now - 90 * DAY);
  });

  it("never draws a window shorter than a week", () => {
    const d = timeDomain([new Date(now - 2 * DAY), new Date(now - DAY)], null, now);
    expect(d.end - d.start).toBe(MIN_SPAN_DAYS * DAY);
  });
});

describe("timeTicks", () => {
  it("labels a year by quarter and carries the year", () => {
    const end = new Date(2026, 8, 6).getTime();
    const start = end - 365 * DAY;
    const ticks = timeTicks(start, end);
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks[0].label).toMatch(/’2[56]$/);
    // Every tick is a month boundary inside the window.
    for (const t of ticks) {
      expect(new Date(t.at).getDate()).toBe(1);
      expect(t.at).toBeGreaterThanOrEqual(start);
      expect(t.at).toBeLessThanOrEqual(end);
    }
  });

  it("labels three months by month, without a year", () => {
    const end = new Date(2026, 8, 6).getTime();
    const ticks = timeTicks(end - 90 * DAY, end);
    expect(ticks.map((t) => t.label)).toEqual(["Jul", "Aug", "Sep"]);
  });

  it("falls back to weeks on a short window", () => {
    const end = new Date(2026, 8, 6).getTime();
    const ticks = timeTicks(end - 28 * DAY, end);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(5);
    expect(ticks[0].label).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/);
  });
});

describe("nearestIndex", () => {
  const xs = [0, 10, 20, 30];
  it("snaps to the closest position, either side", () => {
    expect(nearestIndex(xs, -5)).toBe(0);
    expect(nearestIndex(xs, 4)).toBe(0);
    expect(nearestIndex(xs, 6)).toBe(1);
    expect(nearestIndex(xs, 24)).toBe(2);
    expect(nearestIndex(xs, 26)).toBe(3);
    expect(nearestIndex(xs, 99)).toBe(3);
  });
  it("is -1 on nothing", () => {
    expect(nearestIndex([], 3)).toBe(-1);
  });
});

describe("figures", () => {
  it("change carries both the absolute and the percentage", () => {
    expect(change(100, 125)).toEqual({ abs: 25, pct: 25 });
    expect(change(0, 5).pct).toBeNull();
  });

  it("compactNumber keeps a tick label short", () => {
    expect(compactNumber(16.7)).toBe("16.7");
    expect(compactNumber(2.5)).toBe("2.5");
    expect(compactNumber(120)).toBe("120");
    expect(compactNumber(2430)).toBe("2.4k");
    expect(compactNumber(12000)).toBe("12k");
    expect(compactNumber(1_500_000)).toBe("1.5M");
  });

  it("signed uses a real minus", () => {
    const f = (n: number) => String(n);
    expect(signed(1.5, f)).toBe("+1.5");
    expect(signed(-2, f)).toBe("−2");
    expect(signed(0, f)).toBe("0");
  });
});
