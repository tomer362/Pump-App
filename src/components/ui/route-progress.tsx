"use client";

import * as React from "react";
import { useLinkStatus } from "next/link";

/**
 * A 2px volt rail under the status bar while a navigation is in flight.
 *
 * `useLinkStatus` only reports from *inside* a `<Link>`, so a single global
 * indicator can't call it directly. Each `PendingLink` mounts a `<LinkPending>`
 * reporter in its subtree and this module counts them — a plain module-level
 * store rather than context, because the rail and the links have no common
 * ancestor worth threading a provider through.
 *
 * The rail waits ~120ms before appearing. Every prefetched navigation resolves
 * well inside that, so the common case shows nothing at all; a flash on an
 * instant transition would read as jank rather than feedback.
 */

let pending = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const getSnapshot = () => pending;
const getServerSnapshot = () => 0;

/**
 * Call from inside a `<Link>`: returns whether that link's navigation is in
 * flight, and reports it to the rail for as long as it is. Must be a
 * descendant of the `<Link>` — `useLinkStatus` reads it from context.
 */
export function useLinkPending(): boolean {
  const { pending: isPending } = useLinkStatus();

  React.useEffect(() => {
    if (!isPending) return;
    pending += 1;
    emit();
    return () => {
      pending -= 1;
      emit();
    };
  }, [isPending]);

  return isPending;
}

export function RouteProgress() {
  const count = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [waited, setWaited] = React.useState(false);

  React.useEffect(() => {
    // Arming and disarming both happen on a timer: the rail is hidden the
    // instant the count drops (see `visible` below), and the delayed reset only
    // re-arms the grace period for the next navigation.
    const t =
      count === 0
        ? setTimeout(() => setWaited(false), 150)
        : setTimeout(() => setWaited(true), 120);
    return () => clearTimeout(t);
  }, [count]);

  const visible = count > 0 && waited;

  // Unmounted rather than faded out when the route lands: the rail's whole job
  // is "still waiting", and an exit animation would keep claiming that after
  // the answer is already on screen.
  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 pt-safe"
    >
      <div className="bg-volt animate-route-rail h-[2px] origin-left" />
    </div>
  );
}
