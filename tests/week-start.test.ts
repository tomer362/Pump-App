import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getWeeklyTrend } from "@/lib/queries/stats";
import {
  daysIntoWeek,
  toWeekStart,
  weekTruncShiftDays,
  type WeekStart,
} from "@/lib/week";
import { unitForLocale } from "@/lib/unit";
import { cleanup, makeExercise, makeFinishedWorkout, makeUser } from "./helpers";

describe("week-start arithmetic", () => {
  it("shifts Postgres' Monday cut onto the chosen day", () => {
    expect(weekTruncShiftDays(1)).toBe(0);
    expect(weekTruncShiftDays(0)).toBe(1);
    expect(weekTruncShiftDays(6)).toBe(2);
  });

  it("counts days back to the start of the week", () => {
    // Sunday is day 0 of a Sunday week and day 6 of a Monday one.
    expect(daysIntoWeek(0, 0)).toBe(0);
    expect(daysIntoWeek(0, 1)).toBe(6);
    expect(daysIntoWeek(1, 1)).toBe(0);
    expect(daysIntoWeek(5, 6)).toBe(6);
    expect(daysIntoWeek(6, 6)).toBe(0);
  });

  it("reads anything unexpected as Monday", () => {
    expect(toWeekStart(0)).toBe(0);
    expect(toWeekStart(3)).toBe(1);
    expect(toWeekStart(null)).toBe(1);
  });
});

/**
 * The shift is only worth anything if Postgres agrees with it, so this puts a
 * Sunday session through the real query under each start day.
 */
describe("getWeeklyTrend — the week a Sunday session lands in", () => {
  let userId: string;
  let exerciseId: string;
  let sunday: Date;

  beforeAll(async () => {
    userId = await makeUser();
    exerciseId = await makeExercise();
    // A Sunday at least a week back, so it is inside the 12-week window and
    // never "later today". Noon UTC: the query cuts on the stored UTC clock.
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay() - 7);
    sunday = d;
    // Ended an hour after it started; startedAt is what the query buckets.
    await makeFinishedWorkout(
      userId,
      exerciseId,
      [{ weightKg: 60, reps: 5 }],
      new Date(sunday.getTime() + 3_600_000),
    );
  });

  afterAll(async () => {
    await cleanup([userId], [exerciseId]);
  });

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const minusDays = (n: number) =>
    dayKey(new Date(sunday.getTime() - n * 86_400_000));

  it.each<[WeekStart, number]>([
    [1, 6], // Monday week: the Monday six days earlier
    [0, 0], // Sunday week: that Sunday itself
    [6, 1], // Saturday week: the day before
  ])("week start %i puts it in the week beginning %i days earlier", async (ws, back) => {
    const trend = await getWeeklyTrend(userId, 12, ws);
    expect(trend).toHaveLength(1);
    expect(dayKey(trend[0].weekStart)).toBe(minusDays(back));
    expect(trend[0].workouts).toBe(1);
  });
});

describe("unitForLocale — the onboarding default", () => {
  it.each([
    ["en-US", "lb"],
    ["en", "lb"], // a bare `en` maximises to the US
    ["es-US", "lb"],
    ["en-GB", "kg"],
    ["he-IL", "kg"],
    ["de", "kg"],
    ["not a locale", "kg"],
  ])("%s → %s", (tag, unit) => {
    expect(unitForLocale(tag)).toBe(unit);
  });
});
