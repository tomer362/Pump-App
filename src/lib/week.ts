/**
 * Which day a lifter's week starts on — a display preference, like `unit`.
 *
 * Stored as the JavaScript `getDay()` number (0 = Sunday … 6 = Saturday) so
 * the client can compare it to a date without a lookup. Only the three days a
 * calendar anywhere actually starts on are offered: Monday (ISO, and the
 * default the app always drew), Sunday (the Americas, Israel, Japan) and
 * Saturday (much of the Middle East).
 *
 * Pure, like `lib/rest.ts`: the stats queries, the achievement check and the
 * client heatmap all need it, and every export of a `"use client"` module is a
 * client reference the server can't call.
 */
export const WEEK_START_DAYS = [1, 0, 6] as const;
export type WeekStart = (typeof WEEK_START_DAYS)[number];
export const DEFAULT_WEEK_START: WeekStart = 1;

const NAMES: Record<WeekStart, string> = {
  0: "Sunday",
  1: "Monday",
  6: "Saturday",
};

export const WEEK_START_OPTIONS = WEEK_START_DAYS.map((d) => ({
  value: String(d) as `${WeekStart}`,
  label: NAMES[d],
}));

export function isWeekStart(n: unknown): n is WeekStart {
  return WEEK_START_DAYS.includes(n as WeekStart);
}

/** A stored value that somehow isn't one of the three reads as the default. */
export function toWeekStart(n: unknown): WeekStart {
  return isWeekStart(n) ? n : DEFAULT_WEEK_START;
}

export function weekStartName(ws: WeekStart) {
  return NAMES[ws];
}

/**
 * Days to add before Postgres' `DATE_TRUNC('week', …)` — which always cuts on
 * Monday — and subtract after, so the cut lands on `ws` instead. Sunday is 1
 * (Sunday + 1 = Monday), Saturday 2, Monday 0.
 */
export function weekTruncShiftDays(ws: WeekStart) {
  return (8 - ws) % 7;
}

/** Days from `day` (a `getDay()` number) back to the start of its week. */
export function daysIntoWeek(day: number, ws: WeekStart) {
  return (day - ws + 7) % 7;
}

/**
 * The onboarding default, from the browser's locale. `Intl.Locale#getWeekInfo`
 * (or the older `weekInfo` getter) reports ISO days, 1 = Monday … 7 = Sunday;
 * anything it can't answer, or answers with a day we don't offer, is Monday.
 * Client-only: read it through `useSyncExternalStore` with a server snapshot.
 */
export function guessWeekStart(): WeekStart {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const first = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay;
    return toWeekStart(first === 7 ? 0 : first);
  } catch {
    return DEFAULT_WEEK_START;
  }
}
