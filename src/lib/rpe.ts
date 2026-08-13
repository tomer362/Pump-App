/**
 * RPE — the scale, and the two registers it renders in.
 *
 * There are **two facts** here, and conflating them is the bug this module
 * exists to make impossible. A *prescription* is what a routine told you to aim
 * for (`routine_set.target_rpe`, copied to `workout_set.target_rpe` at start). A
 * *rating* is what the set felt like once you'd done it (`workout_set.rpe`).
 * They were the same column once: `startWorkoutFromRoutine` pre-filled the
 * prescription into `rpe` "like every other target", so every untouched set in a
 * freshly started routine displayed your own effort rating for a lift you hadn't
 * performed. Weight and reps survive that treatment because a text input
 * visibly *is* a target you type over; RPE has no input, only a result-shaped
 * subscript, so a pre-fill there is indistinguishable from a rating.
 *
 * The difference between the two on screen is a **glyph**, never a colour:
 * `→8` is prescribed, `@8` is rated. Two greys at 9px on a phone in a gym are
 * not a difference, and on a completed row's volt tint they collapse entirely.
 * A prescription is also never volt — volt marks state the lifter produced, and
 * a target is the one thing on the screen they haven't.
 *
 * Pure and dependency-light on purpose: the pickers are client components, the
 * inserts are `"use server"` modules where every export is a public endpoint,
 * and `tests/pure.test.ts` needs all of it without a database.
 */

import { z } from "zod";

/** RPE is logged on the half point from 6 up — below that nobody bothers. */
export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

const RPE_MIN = RPE_VALUES[0];
const RPE_MAX = RPE_VALUES[RPE_VALUES.length - 1];

/**
 * The scale as a schema, for the write paths *we* control — the set options
 * sheet and quick-log, which can only ever submit a chip. Anything off the
 * half-point grid from one of those is a bug, not a user's intent.
 *
 * External input (a JSON routine import, an LLM-authored plan) goes through
 * `snapRpe` instead: a document saying 7.3 should become 7.5, not fail.
 */
export const rpeValue = z
  .number()
  .refine((v) => (RPE_VALUES as readonly number[]).includes(v), {
    message: "RPE must be a half point between 6 and 10",
  });

/**
 * The same value arriving from outside: a JSON routine document, or an
 * LLM-authored plan pasted into the importer. Accepts the whole 1–10 band that
 * anyone might reasonably write and snaps it onto the scale, because refusing
 * would throw out an entire 50-exercise import over one set written `7.3`.
 *
 * What still falls below 6 after rounding becomes null — "no prescription" —
 * rather than being pushed up onto the scale. The scale this app displays and
 * edits starts at 6, and a number the picker can't select would leave the
 * builder's chips contradicting the row beside them. Dropping a value we can't
 * represent is honest; inventing one isn't.
 *
 * The bound has to stay 1–10 on both sides: `routineInputSchema` and
 * `routineDocumentSchema` must accept exactly the same documents, or the app
 * writes a file it then refuses to read.
 */
export const rpeInput = z.number().min(1).max(10).transform(snapRpe);

/**
 * Nearest half point, clamped at the top, null below the bottom.
 *
 * The rounding happens first, so 5.9 lands on 6 — its nearest half point is on
 * the scale. Anything still short of 6 afterwards becomes null: pushing 3 up to
 * 6 would state an effort nobody wrote.
 */
export function snapRpe(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  const snapped = Math.round(n * 2) / 2;
  if (snapped < RPE_MIN) return null;
  return Math.min(snapped, RPE_MAX);
}

/** `8`, not `8.0`; `6.5` keeps its half. */
export function formatRpe(v: number): string {
  return String(Math.round(v * 2) / 2);
}

/** Dense-table rating: `@8`, or `@–` for a set that's done but unrated. */
export function ratedToken(rpe: number | null): string {
  return `@${rpe == null ? "–" : formatRpe(rpe)}`;
}

/** Dense-table prescription. The arrow reads as "aim for". */
export function prescribedToken(rpe: number): string {
  return `→${formatRpe(rpe)}`;
}

/**
 * Rating in prose, for labels with room for a word — the history page's row,
 * where the label itself is the 44px tap target. Empty reads `RPE —`, matching
 * the picker's null chip rather than inventing a third placeholder.
 */
export function ratedWord(rpe: number | null): string {
  return `RPE ${rpe == null ? "—" : formatRpe(rpe)}`;
}

export type RpeSubscript = {
  text: string;
  kind: "rated" | "prescribed" | "owed";
};

/**
 * What the subscript under a set number says. One decision table, so the row,
 * its aria-label and the options sheet can't drift into disagreeing about
 * which fact is on screen.
 *
 * A rating always wins: once you've rated a set, what you were told to aim for
 * stops being the useful number. `owed` is the `@–` affordance — a completed
 * set with no rating advertises the gesture that would add one.
 */
export function rpeSubscript(set: {
  rpe: number | null;
  targetRpe: number | null;
  completed: boolean;
}): RpeSubscript | null {
  if (set.rpe != null) return { text: ratedToken(set.rpe), kind: "rated" };
  if (!set.completed && set.targetRpe != null) {
    return { text: prescribedToken(set.targetRpe), kind: "prescribed" };
  }
  if (set.completed) return { text: ratedToken(null), kind: "owed" };
  return null;
}

/** The value every set agrees on, or null if they don't (or there are none). */
export function uniformRpe(values: (number | null | undefined)[]): number | null {
  const first = values[0] ?? null;
  if (first == null) return null;
  return values.every((v) => (v ?? null) === first) ? first : null;
}

/**
 * `"8"` when a fold of sets prescribes one effort, `"7–9"` when it ramps, null
 * when nothing does. Anywhere a header speaks for several sets it has to use
 * this: the builder card read `sets[0].targetRpe`, so a routine ramping 7/8/9
 * announced itself as "RPE 7".
 */
export function rpeRangeLabel(
  values: (number | null | undefined)[],
): string | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  const min = Math.min(...present);
  const max = Math.max(...present);
  // Sets carrying no prescription are ignored rather than widening the range —
  // "7–9" has to mean the efforts written down, not the gaps between them.
  return min === max
    ? formatRpe(min)
    : `${formatRpe(min)}–${formatRpe(max)}`;
}
