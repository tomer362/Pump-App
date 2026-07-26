import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Haptic feedback. Android/Chrome honours this; iOS Safari still does not
 * implement the Vibration API, so this is progressive enhancement only —
 * never make it the sole confirmation that something happened.
 */
export const haptic = {
  light: () => vibrate(10),
  medium: () => vibrate(20),
  success: () => vibrate([12, 40, 24]),
  warn: () => vibrate([30, 60, 30]),
};

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* Safari throws on some versions rather than no-op'ing. */
  }
}

/** `1:05:12` past an hour, `05:12` under it. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Compact human duration for summaries: `1h 12m`, `48m`. */
export function formatDurationLong(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/**
 * Epley estimated 1RM: w * (1 + r/30). Stored per set so PR detection is a
 * single numeric comparison rather than a recompute over history.
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number) {
  return kg * LB_PER_KG;
}
export function lbToKg(lb: number) {
  return lb / LB_PER_KG;
}

/** Display a stored-kg value in the user's unit, trimming pointless decimals. */
export function formatWeight(kg: number, unit: "kg" | "lb"): string {
  const v = unit === "kg" ? kg : kgToLb(kg);
  const rounded = Math.round(v * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatVolume(kg: number, unit: "kg" | "lb"): string {
  const v = unit === "kg" ? kg : kgToLb(kg);
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}

/** `Today` / `Yesterday` / `Mon 14 Apr` — feed and history headers. */
export function formatDayLabel(date: Date): string {
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-GB", { weekday: "long" });
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

/** Relative time for feed items: `now`, `12m`, `5h`, `3d`, then a date. */
export function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86_400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 604_800) return `${Math.floor(secs / 86_400)}d`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** `weight_reps` → `Weight Reps`. Used for muscle, equipment and tracking labels. */
export function labelize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
