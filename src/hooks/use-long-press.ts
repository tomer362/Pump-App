"use client";

import { useCallback, useEffect, useRef } from "react";
import type * as React from "react";
import { haptic } from "@/lib/utils";

/** Past this much drift the press is a scroll, not a hold. */
const MOVE_TOLERANCE_PX = 8;

/**
 * Press-and-hold on a target that also contains links and buttons.
 *
 * Three things make this hostile on a phone. The page scrolls, so a press that
 * drifts is the start of a scroll and firing on it is infuriating — anything
 * past ~8px cancels. The browser still dispatches a `click` when the finger
 * lifts, so on a target wrapping a `<Link>` a long press would both open
 * whatever it opens *and* navigate away from it. And both iOS and Android pop
 * their own link menu at roughly the same 500ms, over the top of ours.
 *
 * The returned props must all land on the same node: `onClickCapture` is what
 * eats the trailing click, and it only sees it from an ancestor of the link.
 */
export function useLongPress(onLongPress: () => void, delayMs = 480) {
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
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      cancel();
      // A hold that ended without a click (finger lifted off-target) would
      // otherwise leave the suppression armed and swallow the next real tap.
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
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
