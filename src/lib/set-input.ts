/**
 * Pure helpers for the set table, shared by the workout screen, the quick-log
 * sheet and the routine builder — and pinned by `tests/pure.test.ts`.
 */

/**
 * What a numeric cell keeps of a keystroke.
 *
 * A comma is the decimal separator on most European keyboards, and iOS puts
 * it on the `decimal` keypad by locale — so `22,5` stripped to digits became
 * `225`, a tenfold weight logged silently. A second dot is dropped too: the
 * old strip let `1.2.3` through, `Number("1.2.3")` is NaN, the commit was
 * refused without a word and the cell kept showing what the set didn't hold.
 */
export function sanitizeDecimalInput(raw: string, integer = false): string {
  const digits = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  if (integer) return digits.replace(/\./g, "");
  const dot = digits.indexOf(".");
  if (dot === -1) return digits;
  return digits.slice(0, dot + 1) + digits.slice(dot + 1).replace(/\./g, "");
}

/** The number a sanitised cell holds, or `null` for empty / not-a-number. */
export function parseCell(raw: string): number | null | typeof NaN {
  if (raw === "") return null;
  return Number(raw);
}

/** A set as the table numbers it: warm-ups take no number. */
export function workingSetNumber(
  sets: readonly { setType: string }[],
  index: number,
): number {
  let n = 0;
  for (let i = 0; i <= index && i < sets.length; i++) {
    if (sets[i].setType !== "warmup") n++;
  }
  return n;
}

export type PreviousLike = { setType?: string | null };

/**
 * Line last session's sets up against this session's, like for like.
 *
 * "Previous" used to be indexed positionally — `previous[i]` for the i-th row
 * — so adding a warm-up this session, or having done one fewer last time,
 * shifted every row's previous by one, and the rest bar's "Next" target with
 * it. Warm-ups match warm-ups in order and working sets match working sets in
 * order; a row with no counterpart gets `null`.
 */
export function alignPrevious<P extends PreviousLike>(
  previous: readonly P[],
  sets: readonly { setType: string }[],
): (P | null)[] {
  const warmups = previous.filter((p) => p.setType === "warmup");
  const working = previous.filter((p) => p.setType !== "warmup");
  let w = 0;
  let k = 0;
  return sets.map((s) =>
    s.setType === "warmup" ? (warmups[w++] ?? null) : (working[k++] ?? null),
  );
}
