"use client";

import { useCallback, useEffect, useRef } from "react";
import type * as React from "react";
import { haptic } from "@/lib/utils";

/** Past this much drift the press is a scroll, not a hold. */
const MOVE_TOLERANCE_PX = 8;

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
 * whatever it opens *and* navigate away from it. And both iOS and Android pop
 * their own link menu at roughly the same 500ms, over the top of ours — see
 * `PRESS_STYLE` for the half of that which `preventDefault` cannot reach.
 *
 * The returned props must all land on the same node: `onClickCapture` is what
 * eats the trailing click, and it only sees it from an ancestor of the link.
 */
export function useLongPress(
  onLongPress: () => void,
  { enabled = true, delayMs = 480 }: { enabled?: boolean; delayMs?: number } = {},
) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const callback = useRef(onLongPress);

  useEffect(() => {
    callback.current = onLongPress;
  }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    style: PRESS_STYLE,
    onPointerDown: (e: React.PointerEvent) => {
      if (!enabled || e.button !== 0) return;
      cancel();
      // A hold that ended without a click (finger lifted off-target) would
      // otherwise leave the suppression armed and swallow the next real tap.
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        // Android Chrome starts its own selection at about the same 500ms as
        // this timer, and on iOS a hold that began on a nested node can raise
        // the handles before the style above applies. Once a range exists,
        // `user-select: none` can't take it back — only this can.
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
        cancel();
      }
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      // Only once we've claimed the gesture — a right-click that never held
      // still deserves its menu.
      if (fired.current) e.preventDefault();
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
