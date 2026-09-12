"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check } from "lucide-react";
import { useMotionPreset } from "@/hooks/use-motion-preset";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/user";

/**
 * The one feedback channel for a write that failed after the screen already
 * moved on.
 *
 * Every mutation in the app is optimistic — a tick paints volt before the
 * server answers — and until now a refused or dropped write said nothing: the
 * row stayed ticked, the rest ran, and the set was not in the database. This
 * is deliberately small. One line, neutral surface, docked in the thumb zone
 * above the tab bar, gone in a few seconds, and never volt: a toast reports
 * state, it is not state that matters.
 *
 * Module state rather than context so a server action's `.then` can reach it
 * from anywhere, including hooks with no component tree to thread through.
 */
type Toast = { id: number; message: string; kind: "error" | "info" };

let current: Toast | null = null;
let seq = 0;
let hideTimer: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function showToast(
  message: string,
  kind: Toast["kind"] = "error",
  ms = 3500,
) {
  if (typeof window === "undefined") return;
  current = { id: ++seq, message, kind };
  if (hideTimer != null) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(hideToast, ms);
  emit();
}

export function hideToast() {
  if (hideTimer != null) window.clearTimeout(hideTimer);
  hideTimer = null;
  current = null;
  emit();
}

const OFFLINE = "Couldn't save that. Check your connection and try again.";

/**
 * Watch a fire-and-forget action. A refusal shows its message; a rejected
 * promise (the network, a thrown action) shows a generic one. `onFail` is
 * where the optimistic state gets rolled back.
 */
export function watchAction<T>(
  promise: Promise<ActionResult<T>>,
  onFail?: (error: string) => void,
): Promise<ActionResult<T>> {
  return promise.then(
    (res) => {
      if (!res.ok) {
        onFail?.(res.error);
        showToast(res.error);
      }
      return res;
    },
    () => {
      onFail?.(OFFLINE);
      showToast(OFFLINE);
      return { ok: false, error: OFFLINE } as ActionResult<T>;
    },
  );
}

/** Mounted once, in the root layout. */
export function Toaster() {
  const toast = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  const motionPreset = useMotionPreset();

  // A toast left up across a navigation is a claim about a screen that is
  // gone; the id changing is how the next one replaces it cleanly.
  useEffect(() => () => hideToast(), []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
      // Above the tab bar and the active-workout pill; on the workout screen,
      // which has neither, above the docked rest bar.
      style={{ bottom: "calc(var(--bottom-dock) + 64px)" }}
    >
      <AnimatePresence>
        {toast && (
          <motion.button
            key={toast.id}
            type="button"
            role="status"
            onClick={hideToast}
            initial={motionPreset.enabled ? { opacity: 0, y: 12 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={motionPreset.enabled ? motionPreset.spring.snappy : motionPreset.enter}
            className={cn(
              "pointer-events-auto flex max-w-lg items-center gap-2.5 rounded-field border px-3.5 py-2.5 text-left text-[13px] font-medium shadow-none",
              "bg-surface-2 border-hairline text-text-1",
            )}
          >
            {toast.kind === "error" ? (
              <AlertCircle className="text-danger size-4 shrink-0" strokeWidth={2.4} />
            ) : (
              <Check className="text-text-2 size-4 shrink-0" strokeWidth={2.6} />
            )}
            <span className="min-w-0">{toast.message}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
