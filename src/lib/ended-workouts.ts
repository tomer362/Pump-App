"use client";

import { useSyncExternalStore } from "react";
import { UI_STORAGE_PREFIX, readSession, writeSession } from "@/lib/session-memory";

/* -------------------------------------------------------------------------- *
 * Workouts this tab has watched stop being live.
 *
 * `ActiveWorkoutPill` is rendered by the `(app)` layout, and a layout the
 * Router Cache already holds is not re-rendered by a navigation into it — so
 * after finishing (or discarding) a session the pill could keep docking and
 * ticking over `/history/[id]`, a page that only renders for a workout that
 * *has* ended. Finish and discard are the two places that know for certain,
 * so they latch the id here and the pill stands down on it, whatever payload
 * the layout was served from.
 *
 * Under `pump.ui.` so sign-out's `clearSessionMemory` drops it with the rest.
 * -------------------------------------------------------------------------- */

const KEY = `${UI_STORAGE_PREFIX}ended-workouts`;
/** A tab ends a handful of sessions; bounded so the list can't grow forever. */
const MAX_IDS = 20;

let ended: string[] | null = null;
const listeners = new Set<() => void>();

function load(): string[] {
  if (ended) return ended;
  ended =
    readSession(KEY, (v) =>
      Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : null,
    ) ?? [];
  return ended;
}

export function markWorkoutEnded(id: string) {
  const ids = load();
  if (ids.includes(id)) return;
  ended = [...ids, id].slice(-MAX_IDS);
  writeSession(KEY, ended);
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** True once this tab has seen `id` finished or discarded. */
export function useWorkoutEnded(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => load().includes(id),
    () => false,
  );
}
