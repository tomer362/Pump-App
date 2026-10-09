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
