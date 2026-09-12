"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn, haptic } from "@/lib/utils";
import { SPRING } from "@/lib/motion";

/**
 * Every sheet currently on screen, oldest first.
 *
 * The picker opens the About sheet on top of itself, and two `aria-modal`
 * dialogs listening on `window` both act on one Escape — the inner sheet and
 * the list behind it would close together. Only the top of this stack handles
 * a key, which is also what keeps the Tab trap belonging to one dialog.
 */
const openSheets: symbol[] = [];

/**
 * The body scroll lock is ref-counted for the same reason. Each instance
 * captured and restored `body.style.overflow` on its own, so two unmounting in
 * one commit could restore "hidden" after the outer had restored the original
 * and leave the page locked with nothing on top of it.
 */
let lockCount = 0;
let lockedFrom = "";

/**
 * Bottom sheet with drag-to-dismiss, the dominant modal pattern on phones —
 * it keeps the dismiss gesture in the thumb zone instead of a corner X.
 */
export function Sheet({
  open,
  onClose,
  title,
  titleAction,
  children,
  /** Sheet grows to content by default; set to cap it and scroll inside. */
  maxHeight = "88dvh",
  footer,
  dismissLabel,
  dragToDismiss = true,
  initialFocus = "auto",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Rendered flush right in the title row. For a destructive shortcut that must
   * not be scrolled to: these option sheets run to rest, order, superset,
   * interval and a note before the one control somebody opened them in a hurry
   * for. Ignored without a `title` — there is no row to sit in.
   */
  titleAction?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: string;
  footer?: React.ReactNode;
  /**
   * Renders a full-width button that just closes the sheet, for content that
   * commits as you touch it and so has nothing to confirm.
   *
   * A settings sheet without one is dismissible only by dragging the handle,
   * tapping the backdrop, or Escape — none of which is drawn on the screen, so
   * the sheet reads as having no way out. The footer is where a phone's dismiss
   * belongs anyway (a corner X is out of thumb reach, which is why this
   * component has never had one). Ignored when `footer` is given: a sheet with a
   * real action already answers "how do I finish".
   */
  dismissLabel?: string;
  /**
   * Set false when the content owns the vertical drag itself. Motion arbitrates
   * two overlapping y-drags with a single global lock claimed by whichever pan
   * crosses its threshold first — and that is this panel, whose native listener
   * on the element beats a child's controls started from a delegated React
   * handler. The child would silently never move. Sheets that turn this off
   * still close by backdrop, Escape and their own footer button.
   */
  dragToDismiss?: boolean;
  /**
   * `"input"` focuses the first field even on a touch device, for a sheet
   * that exists to collect one value (a join code, a gym name) and wants the
   * keyboard up. The default keeps focus on the panel there. Callers used
   * `autoFocus` on the input for this, and the two fought: React focused the
   * field on mount, the sheet then moved focus to the panel a frame later,
   * and the keyboard opened and closed again.
   */
  initialFocus?: "auto" | "input";
}) {
  const reduce = useReducedMotion();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusTo = React.useRef<HTMLElement | null>(null);
  // This instance's identity in `openSheets`. A symbol, so two sheets opened in
  // the same commit can never collide.
  const [id] = React.useState(() => Symbol("sheet"));

  // Read through a ref so the focus effect below never depends on `onClose`.
  // Callers pass an inline arrow, so its identity changes on every parent
  // render; a dep on it re-runs the effect mid-session and the cleanup yanks
  // focus off whatever the user is typing in. On Android that closes the
  // keyboard, which resizes the visual viewport, which re-renders the
  // parent — a flicker loop that never settles.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Lock the page behind the sheet so scrolling the sheet doesn't chain.
  React.useEffect(() => {
    if (!open) return;
    if (lockCount === 0) lockedFrom = document.body.style.overflow;
    lockCount += 1;
    document.body.style.overflow = "hidden";
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.body.style.overflow = lockedFrom;
    };
  }, [open]);

  /**
   * Focus management. `aria-modal="true"` tells assistive tech the rest of the
   * page is inert, so Tab must actually behave that way — otherwise a screen
   * reader user is told one thing while the keyboard does another. Focus moves
   * in on open and returns to the trigger on close, so the next Tab doesn't
   * restart from the top of the document.
   */
  React.useEffect(() => {
    if (!open) return;

    openSheets.push(id);

    // Held for the cleanup, which runs after React has detached the node.
    const panel = panelRef.current;

    restoreFocusTo.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Wait for the enter animation to mount the content before focusing.
    const raf = requestAnimationFrame(() => {
      // On a touch device, focusing a text field summons the on-screen
      // keyboard, which swallows the bottom half of the sheet before the user
      // has said they want to type. Move focus to the panel instead — it is
      // `tabIndex={-1}`, so `aria-modal` and the Tab trap still hold.
      if (
        initialFocus !== "input" &&
        window.matchMedia?.("(pointer: coarse)").matches
      ) {
        panelRef.current?.focus?.();
        return;
      }
      const items = focusables();
      // Prefer a text field — most sheets exist to collect one value.
      const preferred =
        items.find(
          (el) =>
            el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement,
        ) ??
        items[0] ??
        panelRef.current;
      preferred?.focus?.();
    });

    const onKey = (e: KeyboardEvent) => {
      // Only the topmost sheet answers. A sheet with another one over it is
      // not the dialog the key was meant for.
      if (openSheets[openSheets.length - 1] !== id) return;
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (
        e.shiftKey &&
        (active === first || !panelRef.current?.contains(active))
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      const at = openSheets.lastIndexOf(id);
      if (at !== -1) openSheets.splice(at, 1);
      // Only restore if the trigger is still in the document and focus hasn't
      // already moved somewhere deliberate outside the sheet.
      const active = document.activeElement;
      const focusWasOurs =
        active === document.body ||
        active === null ||
        (panel?.contains(active) ?? false);
      if (focusWasOurs && restoreFocusTo.current?.isConnected) {
        restoreFocusTo.current.focus?.();
      }
    };
  }, [open, id, initialFocus]);

  // Neutral, not volt: nothing is being committed — these sheets have already
  // written every change as it was tapped — and the accent is reserved for
  // state that matters.
  const foot =
    footer ??
    (dismissLabel ? (
      <Button block variant="solid" onClick={onClose}>
        {dismissLabel}
      </Button>
    ) : null);

  // Render into a portal on `document.body`. Sheets are opened from triggers
  // that can sit inside a stacking context — the NavBar is `sticky … z-30`, so
  // a sheet mounted in its subtree has its own `z-50` scoped *inside* that z-30
  // and is painted under the tab bar and the active-workout pill (z-40) docked
  // over the same bottom strip the sheet occupies. Portalling to the body top
  // layer makes `z-50` mean z-50 against the whole page. `open` starts false on
  // both server and first client render, so a closed sheet emits no DOM either
  // way — nothing to mismatch — and the portal only ever produces nodes after a
  // client-side open.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Dialog"}
            tabIndex={-1}
            className={cn(
              "bg-surface-1 relative w-full max-w-lg overflow-hidden",
              "rounded-t-sheet border-hairline border-t",
              "flex flex-col",
            )}
            style={{ maxHeight }}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={reduce ? { duration: 0.15 } : SPRING.sheet}
            drag={reduce || !dragToDismiss ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              // Dismiss on a decisive flick or a past-halfway drag.
              if (info.offset.y > 120 || info.velocity.y > 600) {
                haptic.light();
                onClose();
              }
            }}
          >
            <div aria-hidden className="flex justify-center pt-2.5 pb-1">
              <span className="bg-surface-3 h-1 w-9 rounded-full" />
            </div>

            {title && (
              <div className="flex items-center gap-2 px-4 pt-1 pb-3">
                <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold">
                  {title}
                </h2>
                {titleAction}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>

            {foot ? (
              <div className="hairline-t bg-surface-1 px-4 pt-3 pb-3 mb-safe">
                {foot}
              </div>
            ) : (
              <div className="pb-safe" />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
