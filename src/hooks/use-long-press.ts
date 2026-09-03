"use client";

import { useCallback, useEffect, useRef } from "react";
import type * as React from "react";
import { haptic } from "@/lib/utils";

/** Past this much drift the press is a scroll, not a hold. */
const MOVE_TOLERANCE_PX = 8;

/**
 * How long a finger has to stay down before the target admits it noticed.
 * Shorter than a tap ever lasts, so tapping a button inside the target never
 * flickers; long enough that the tint reads as "keep holding", not "pressed".
 */
const HOLD_FEEDBACK_MS = 150;

/**
 * Set on the press target from `HOLD_FEEDBACK_MS` in until the hold fires or
 * dies. Written straight onto the node rather than through React state: the
 * workout header sits on a block that is a whole table, and re-rendering it
 * twice per hold to change one background is not a trade worth making. A
 * consumer opts in with `data-[holding]:bg-surface-2`; where nobody styles it
 * the attribute is inert, which is how the unadvertised header hold stays
 * unadvertised.
 */
export const HOLDING_ATTR = "data-holding";

/**
 * What actually stops iOS from claiming the gesture.
 *
 * A hold on an `<a>` in mobile Safari raises the system link preview — the
 * card that floats the page up with "Open / Copy / Share" under it. It is not
 * a `contextmenu` event, so `preventDefault()` never sees it, and it is not a
 * text selection, so `select-none` doesn't touch it either: the reorder sheet
 * opened *behind* Apple's card. `-webkit-touch-callout` is the only switch for
 * it, and because the property inherits, setting it on the press target covers
 * the links and buttons nested inside. `-webkit-user-drag` is the other half —
 * without it a hold that drifts drags the link's URL around instead.
 *
 * Selection is the third of the three, and it travels with the hook rather than
 * being left to the consumer remembering `select-none`: a hold that raises iOS's
 * selection handles leaves them over the row *behind* whatever the press opened,
 * and there was no reason two of the three properties came with the hook and the
 * one that fires most often did not.
 *
 * Spread onto the same node as the handlers below, which means a consumer that
 * needs its own inline styles has to merge rather than replace this.
 */
const PRESS_STYLE = {
  WebkitTouchCallout: "none",
  WebkitUserDrag: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
} as React.CSSProperties;

/**
 * Press-and-hold on a target that also contains links and buttons.
 *
 * Three things make this hostile on a phone. The page scrolls, so a press that
 * drifts is the start of a scroll and firing on it is infuriating — anything
 * past ~8px cancels. The browser still dispatches a `click` when the finger
 * lifts, so on a target wrapping a `<Link>` a long press would both open
 * whatever it opens *and* navigate away from it. And both platforms answer a
 * hold with something of their own — see `PRESS_STYLE` for the half of that
 * which `preventDefault` cannot reach, and below for the half it can.
 *
 * **Chrome's long press lands before ours, so the gesture is claimed on the
 * way down, not once the timer fires.** Android's long-press timeout is 400 ms
 * (`ViewConfiguration`; the accessibility setting only makes it longer), which
 * is under the 480 ms here, and Chrome dispatches `contextmenu` at that moment
 * — for the exercise name that is a link, so it drew its link card, and with
 * link-text selection on, a selection too. This used to `preventDefault()` only
 * *after* the hold had fired, so on every hold Chrome went first, and 80 ms
 * later the reorder sheet slid up over what it had done. So the menu is refused
 * for the whole of a touch press, and the selection is cleared in the very same
 * handler: Chromium selects *before* it dispatches the event, and refusing the
 * event does not undo the selection it just made — clearing the range at the
 * timer would have shown the handles for those 80 ms. `dragstart` is refused
 * for the same span, which reaches the nested `<a>` by bubbling rather than by
 * inheritance. A mouse right-click never starts a press (`button !== 0`), so
 * desktop keeps its menu.
 *
 * The returned props must all land on the same node: `onClickCapture` is what
 * eats the trailing click, and it only sees it from an ancestor of the link.
 */
export function useLongPress(
  onLongPress: () => void,
  { enabled = true, delayMs = 480 }: { enabled?: boolean; delayMs?: number } = {},
) {
  const timer = useRef<number | null>(null);
  const feedback = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const target = useRef<HTMLElement | null>(null);
  /** A primary-button press is down on the target, hold still live or not. */
  const pressing = useRef(false);
  /** …and it is a finger or a pen, the pointers a browser answers with a menu. */
  const touch = useRef(false);
  const fired = useRef(false);
  const callback = useRef(onLongPress);

  useEffect(() => {
    callback.current = onLongPress;
  }, [onLongPress]);

  /** The hold is over — timers and the tint — but the finger may still be down. */
  const settle = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (feedback.current != null) {
      window.clearTimeout(feedback.current);
      feedback.current = null;
    }
    target.current?.removeAttribute(HOLDING_ATTR);
    origin.current = null;
  }, []);

  /** The press is over. */
  const cancel = useCallback(() => {
    settle();
    pressing.current = false;
    touch.current = false;
    target.current = null;
  }, [settle]);

  useEffect(() => cancel, [cancel]);

  return {
    style: PRESS_STYLE,
    onPointerDown: (e: React.PointerEvent) => {
      // A hold that ended without a click (finger lifted off-target, or an
      // Android long press, which produces no click at all) would otherwise
      // leave the suppression armed and swallow the next real tap — or, being
      // the same flag, refuse the next right-click its menu.
      fired.current = false;
      if (!enabled || e.button !== 0) return;
      cancel();
      pressing.current = true;
      touch.current = e.pointerType !== "mouse";
      target.current = e.currentTarget as HTMLElement;
      origin.current = { x: e.clientX, y: e.clientY };
      feedback.current = window.setTimeout(() => {
        feedback.current = null;
        target.current?.setAttribute(HOLDING_ATTR, "");
      }, HOLD_FEEDBACK_MS);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        // Whatever opens now is the feedback; the tint goes with the timer.
        settle();
        // Belt to `onContextMenu`'s braces — a selection that reached here
        // through some path that raised no menu (iOS can raise handles out of
        // a hold that began on a nested node) still has to go.
        window.getSelection()?.removeAllRanges();
        haptic.medium();
        callback.current();
      }, delayMs);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const from = origin.current;
      if (!from || timer.current == null) return;
      if (
        Math.abs(e.clientX - from.x) > MOVE_TOLERANCE_PX ||
        Math.abs(e.clientY - from.y) > MOVE_TOLERANCE_PX
      ) {
        // The hold is dead but the finger is still down, so the press stays
        // claimed: Chrome's own slop is not ours, and a menu it raises out of
        // a drift it didn't count as a scroll is still not wanted.
        settle();
      }
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      // Chrome Android sends this mid-press, at its own 400 ms; Firefox Android
      // on release, after ours has fired. Either way it is the hold's, not the
      // browser's. A right-click on desktop starts no press and gets through.
      if (fired.current || (pressing.current && touch.current)) {
        e.preventDefault();
        // Already made by the time this dispatches, and not undone by the
        // preventDefault above — this is the only moment it can be cleared
        // before it paints.
        window.getSelection()?.removeAllRanges();
      }
    },
    onDragStart: (e: React.DragEvent) => {
      // Bubbles up from the `<a>` inside, so this needs no inheritance to
      // reach it: a hold that Chrome reads as the start of a link drag would
      // otherwise carry a ghost of the exercise name up with the sheet.
      if (pressing.current) e.preventDefault();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      // preventDefault for the anchor's native navigation, stopPropagation for
      // the React handler Link navigates from. Both, or one of them gets through.
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
