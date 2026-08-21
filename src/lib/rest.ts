import { formatDuration } from "@/lib/utils";

/**
 * The durations offered anywhere rest is chosen. `0` is genuinely no rest — the
 * timer never starts — and is distinct from inheriting, which is `null`.
 *
 * Pure, and not in `rest-picker.tsx`, for the same reason `RPE_VALUES` lives in
 * `lib/rpe.ts`: server components render rest too (the routine detail page), and
 * every export of a `"use client"` module is a client reference the server can't
 * call.
 */
export const REST_PRESETS = [0, 30, 45, 60, 90, 120, 180, 240] as const;

export function restLabel(seconds: number) {
  if (seconds === 0) return "Off";
  return seconds < 60 ? `${seconds}s` : formatDuration(seconds);
}
