/**
 * Calendar days, `YYYY-MM-DD`.
 *
 * The app stores instants everywhere else, but a backdated quick log is a
 * *date* — the user picked a day off a wheel and never said what time. Encoding
 * it as an instant would claim a precision they didn't give, and the server
 * would have to invent the missing time-of-day anyway.
 *
 * Pure and dependency-free on purpose. `lib/actions/quick-log.ts` is a
 * `"use server"` module, where every export is a public POST endpoint, so
 * helpers cannot live there; and the sheet needs the identical notion of a day,
 * which must not be written twice.
 */

/** A calendar day with no time and no zone. */
export type DayKey = string;

/** The local calendar day a `Date` falls on. */
export function toDayKey(d: Date): DayKey {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

/** Shift by whole days. Negative goes back. */
export function shiftDay(key: DayKey, days: number): DayKey {
  const [y, m, d] = key.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * Shape *and* calendar validity — `2026-13-40` matches the regex and would
 * otherwise sail through into an Invalid Date.
 */
export function isDayKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return (
    at.getUTCFullYear() === y &&
    at.getUTCMonth() === m - 1 &&
    at.getUTCDate() === d
  );
}

/**
 * The instant a backdated row is stamped with: **noon UTC** on that day.
 *
 * `timestamp` columns here carry no zone, and drizzle serialises a `Date`
 * through `toISOString()`, so what Postgres stores is the UTC clock time —
 * which is exactly what CLAUDE.md means by "timezone-naive server time". Noon
 * is the only choice that survives both directions: `DATE(started_at)` is the
 * day the user picked, and a client rendering it with `toLocaleDateString`
 * reads back the same date at every offset in (-12, +12).
 *
 * Midnight would render as the *previous* day for every negative offset, so the
 * history header and the consistency heatmap would contradict the picker. The
 * residual skew at UTC+13/+14 and UTC-12 is accepted: closing it needs a stored
 * user timezone, which the app deliberately doesn't have.
 */
export function dayKeyToNoonUtc(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/** Half-open `[start, end)` in UTC, for scoping a query to one day. */
export function dayKeyBounds(key: DayKey): { start: Date; end: Date } {
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** Local midnight, so `formatDayLabel` compares against the right "today". */
export function dayKeyToLocalDate(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
