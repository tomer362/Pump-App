/**
 * The arithmetic behind every chart: axis ticks, time scales, nearest-point
 * lookup. Pure, so `tests/chart.test.ts` can hold it without a browser, and so
 * a server component can import a formatter from here without dragging a
 * `"use client"` module along.
 *
 * Why this exists at all: the first version of the exercise chart spread its
 * sessions evenly along the x-axis (`x = i / (n - 1)`), which drew a session
 * from January and one from August the same distance apart as two a week
 * apart — the *shape* of the trend, which is the whole point of a line, was an
 * artefact of how often you trained. And its "grid" was three lines at fixed
 * fractions of the height that corresponded to no value, with the only numbers
 * on the screen being "low"/"high" printed underneath. Charts here now have a
 * real time axis and real ticks.
 */

const DAY_MS = 86_400_000;

/** The shortest window a time axis will draw, so two sessions three days apart
 *  don't stretch across the whole plot and read as a long stretch of training. */
export const MIN_SPAN_DAYS = 7;

/** Round a raw interval up to the nearest 1 / 2 / 2.5 / 5 × 10ⁿ. */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
  return nice * mag;
}

export type Scale = { lo: number; hi: number; ticks: number[] };

/**
 * Clean tick values covering `[min, max]`, three to five of them.
 *
 * `zero` pins the floor at 0 — mandatory for anything drawn as a bar, since a
 * bar's length is the value and a raised floor would lie about it. A line can
 * zoom to its range: the trend is the reading, and the ticks say what the
 * range is.
 */
export function niceScale(
  min: number,
  max: number,
  { zero = false, maxTicks = 5 }: { zero?: boolean; maxTicks?: number } = {},
): Scale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { lo: 0, hi: 1, ticks: [0, 1] };
  }
  if (zero) min = Math.min(0, min);
  if (max === min) {
    // A flat series still needs a band to sit in.
    const pad = Math.abs(max) * 0.1 || 1;
    if (!zero || min < 0) min -= pad;
    max += pad;
  }

  // Aim for three intervals; coarsen until the tick count fits.
  let target = 3;
  for (;;) {
    const step = niceStep((max - min) / target);
    const lo = Math.floor(min / step + 1e-9) * step;
    const hi = Math.ceil(max / step - 1e-9) * step;
    const ticks: number[] = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(roundTo(v, step));
    if (ticks.length <= maxTicks || target === 1) {
      return { lo: ticks[0], hi: ticks[ticks.length - 1], ticks };
    }
    target -= 1;
  }
}

function roundTo(v: number, step: number) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(v.toFixed(decimals));
}

/**
 * The window a time axis spans. Starts at the range boundary or the first
 * session, whichever is later — a 1Y view of a lift first logged in June is
 * June onwards, not six months of nothing — and ends at *now*, so the weeks
 * since the last session are visible: a line that stops short of the right
 * edge is a lift you have not done lately, and that is a reading too.
 */
export function timeDomain(
  dates: readonly Date[],
  rangeDays: number | null,
  now: number = Date.now(),
): { start: number; end: number } {
  const first = dates.length ? Math.min(...dates.map((d) => d.getTime())) : now;
  let start = rangeDays == null ? first : Math.max(first, now - rangeDays * DAY_MS);
  const end = Math.max(now, first);
  if (end - start < MIN_SPAN_DAYS * DAY_MS) start = end - MIN_SPAN_DAYS * DAY_MS;
  return { start, end };
}

export type TimeTick = { at: number; label: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Where to label a time axis, at most `max` labels. Months for anything
 * longer than about two of them, otherwise weeks — and the year rides along
 * once the window is long enough that "Sep" alone is ambiguous.
 */
export function timeTicks(start: number, end: number, max = 5): TimeTick[] {
  const spanDays = (end - start) / DAY_MS;
  const withYear = spanDays > 330;

  if (spanDays <= 70) {
    // Weekly, from the first midnight on or after `start`.
    const first = new Date(start);
    first.setHours(0, 0, 0, 0);
    if (first.getTime() < start) first.setDate(first.getDate() + 1);
    const all: TimeTick[] = [];
    for (let d = new Date(first); d.getTime() <= end; d.setDate(d.getDate() + 7)) {
      all.push({ at: d.getTime(), label: `${d.getDate()} ${MONTHS[d.getMonth()]}` });
    }
    return thin(all, max);
  }

  const all: TimeTick[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  if (d.getDate() !== 1 || d.getTime() < start) {
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
  }
  for (; d.getTime() <= end; d.setMonth(d.getMonth() + 1)) {
    const m = MONTHS[d.getMonth()];
    all.push({
      at: d.getTime(),
      label: withYear ? `${m} ’${String(d.getFullYear()).slice(2)}` : m,
    });
  }
  // Prefer a stride that lands on the quarters or the half-year, so a long
  // window is labelled Jan / Apr / Jul / Oct rather than at arbitrary months.
  for (const stride of [1, 2, 3, 4, 6, 12, 24]) {
    const picked = all.filter((_, i) => i % stride === 0);
    if (picked.length <= max) return picked;
  }
  return thin(all, max);
}

function thin<T>(all: T[], max: number): T[] {
  if (all.length <= max) return all;
  const stride = Math.ceil(all.length / max);
  return all.filter((_, i) => i % stride === 0);
}

/** Index of the entry whose position is closest to `x`. `xs` is ascending. */
export function nearestIndex(xs: readonly number[], x: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(xs[lo - 1] - x) <= Math.abs(xs[lo] - x)) return lo - 1;
  return lo;
}

/** The change from `from` to `to`, as an absolute and a percentage. */
export function change(from: number, to: number): { abs: number; pct: number | null } {
  return { abs: to - from, pct: from === 0 ? null : ((to - from) / Math.abs(from)) * 100 };
}

/** `1.2k` / `860` / `16.7` — a tick label, never wider than five characters. */
export function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${trim(v / 1_000_000, 1)}M`;
  if (abs >= 10_000) return `${trim(v / 1000, 0)}k`;
  if (abs >= 1000) return `${trim(v / 1000, 1)}k`;
  return trim(v, abs < 100 ? 1 : 0);
}

function trim(v: number, decimals: number): string {
  const r = Number(v.toFixed(decimals));
  return String(r);
}

/** A signed figure for a delta: `+1.2`, `−0.5`, `0`. A real minus, not a hyphen. */
export function signed(v: number, format: (abs: number) => string): string {
  if (v > 0) return `+${format(v)}`;
  if (v < 0) return `−${format(-v)}`;
  return format(0);
}
