/**
 * Time windows the analytics screens offer. Plain module, not a `"use server"`
 * one — those may only export async functions — so both the client components
 * and the action that validates against them can import it.
 */

export const MUSCLE_WINDOWS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
] as const;

export const CHART_RANGES = [
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 182 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: null },
] as const;

export type ChartRangeKey = (typeof CHART_RANGES)[number]["key"];

/** Keeps a series to the selected window. `null` days means "everything". */
export function withinRange<T extends { date: Date }>(
  points: T[],
  days: number | null,
): T[] {
  if (days == null) return points;
  const cutoff = Date.now() - days * 86_400_000;
  return points.filter((p) => p.date.getTime() >= cutoff);
}
