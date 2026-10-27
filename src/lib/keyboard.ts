/**
 * Keyboard arithmetic over `visualViewport` readings. Pure, so the two
 * questions below can be pinned without a DOM.
 *
 * They are different questions, and conflating them made the workout screen
 * jump on every keystroke. Typing re-reveals the caret, which *pans* the
 * visual viewport (`offsetTop` moves); subtracting that pan from the keyboard
 * made the keyboard appear to shrink — past the threshold, to close — while it
 * was still up. The screen's bottom padding collapsed and regrew, the jump
 * pill sprang in and out, and `DocumentScrollGuard`, believing the keyboard
 * gone, put the document back to zero for the next keystroke to pan again.
 *
 * And `innerHeight` is not a fixed reference either. In an installed iOS 26
 * PWA the keyboard shrinks `innerHeight` *with* `visualViewport.height` (and
 * `100dvh` with them), so `innerHeight − vv.height` reads 0 with the keyboard
 * up. That is the bounce on a low row: iOS scrolls the document a few px on
 * every keystroke to keep the caret clear of the keyboard, the guard — told
 * the keyboard was closed — scrolled it back, and the next digit did it again.
 * So the height we subtract from is the one seen while nothing was being
 * typed into (`layoutHeightOf`).
 */

export type ViewportReading = {
  innerHeight: number;
  vvHeight: number;
  offsetTop: number;
};

/** The URL bar collapsing is not a keyboard. */
const MIN_KEYBOARD_PX = 120;

function threshold(px: number): number {
  return px > MIN_KEYBOARD_PX ? Math.round(px) : 0;
}

/**
 * How tall the keyboard is. Unchanged by a pan, so this is the one to ask
 * "is the keyboard up" and to size padding inside the page by.
 */
export function keyboardHeightOf(r: ViewportReading): number {
  return threshold(r.innerHeight - r.vvHeight);
}

/**
 * How much of the *layout* viewport's bottom edge the keyboard hides right
 * now. Only right for placing a `position: fixed` element against the visible
 * bottom edge, which moves when the page pans.
 */
export function keyboardOverlapOf(r: ViewportReading): number {
  return threshold(r.innerHeight - r.vvHeight - r.offsetTop);
}

export type LayoutBaseline = { height: number; width: number };

/**
 * The layout viewport's height with the keyboard down. While a field is being
 * edited the live `innerHeight` may already have shrunk for the keyboard, so
 * the height last seen *before* editing stands in — for as long as the width
 * still matches, since a rotation makes it a reading of a different screen.
 */
export function layoutHeightOf(r: {
  innerHeight: number;
  innerWidth: number;
  editing: boolean;
  baseline: LayoutBaseline | null;
}): number {
  if (!r.editing || !r.baseline || r.baseline.width !== r.innerWidth)
    return r.innerHeight;
  return Math.max(r.innerHeight, r.baseline.height);
}
