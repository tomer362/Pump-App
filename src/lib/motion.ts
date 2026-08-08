/**
 * The shared vocabulary for choreographed motion.
 *
 * These numbers were duplicated across a dozen files — the same spring written
 * out in `workout-screen`, `rest-timer` and `sheet` with three different
 * damping values that were meant to be one, and `[0.25, 1, 0.5, 1]` typed by
 * hand in nine places even though it is already the `--ease-out-quart` token in
 * globals.css. Two of anything drift; naming them makes a change to the app's
 * feel a one-line edit rather than a search.
 *
 * A plain module, not a client component: server files can import the constants
 * to pass down as props.
 */

/** Mirrors `--ease-out-quart` in globals.css — keep the two in step. */
export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const;

export const DUR = {
  /** Routine state changes. Anything faster reads as a jump. */
  fast: 0.15,
  base: 0.2,
  /** Deliberate moments only — the finish screen, an unlocked achievement. */
  slow: 0.4,
} as const;

export const SPRING = {
  /** The default. Docking bars, sheets sliding into place, header swaps. */
  snappy: { type: "spring", stiffness: 420, damping: 36 },
  /** Sheets: slightly softer landing over a taller travel. */
  sheet: { type: "spring", stiffness: 420, damping: 38, mass: 0.9 },
  /** Badges and burst-ins — overshoots on purpose. */
  pop: { type: "spring", stiffness: 500, damping: 24 },
  /** Two things snapping together (the friend-add avatars). */
  snap: { type: "spring", stiffness: 420, damping: 18 },
} as const;

/**
 * Per-item delay when a group of things enters together. Small on purpose: a
 * 35ms cascade is a rhythm, while anything longer over a list of thirty rows is
 * a second of content the user cannot read yet.
 */
export const STAGGER = 0.035;

/** Entering list rows and cards. */
export const ENTER = {
  duration: DUR.slow,
  ease: EASE_OUT_QUART,
} as const;

/**
 * What a transition becomes when the OS asks for reduced motion.
 *
 * The CSS kill-switch in globals.css zeroes CSS transitions and animations
 * only — it cannot reach a JS-driven transform, which is what `motion` uses. So
 * every motion component has to opt in, and thirteen of seventeen didn't.
 * Effectively instant rather than zero: a 0-duration transition can skip
 * motion's completion callbacks.
 */
export const REDUCED = { duration: 0.01 } as const;
