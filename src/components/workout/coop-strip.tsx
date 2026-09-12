"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/primitives";
import { getCoopSnapshot, type CoopSnapshot } from "@/lib/actions/coop";
import { cn, formatDuration } from "@/lib/utils";

const POLL_MS = 3000;

/**
 * Who else is in the room, pinned to the workout header.
 *
 * A co-op session is the one time the lifter cares what someone else is doing
 * *right now*, and the only place that was visible was the `/coop` page — which
 * means leaving the screen you're logging on. This is the same snapshot, one
 * line tall, so it stays readable while the exercises scroll under it.
 *
 * Same constraints as the room: serverless can't hold a socket, so it polls one
 * indexed query over denormalised counters, gated on tab visibility, and stops
 * dead once the session ends. It is the co-op poll, not a second one — this
 * screen is where a participant actually spends the session.
 */
export function CoopStrip({
  initial,
  currentUserId,
}: {
  initial: CoopSnapshot;
  currentUserId: string;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const inFlight = useRef(false);
  const ended = snapshot.endedAt != null;

  const poll = useCallback(async () => {
    if (inFlight.current || document.visibilityState !== "visible") return;
    inFlight.current = true;
    try {
      const next = await getCoopSnapshot(initial.id);
      if (next) setSnapshot(next);
    } catch {
      /* A dropped poll is the next poll's problem; fired every three seconds
         from an interval, an unhandled rejection here was one per tick. */
    } finally {
      inFlight.current = false;
    }
  }, [initial.id]);

  useEffect(() => {
    if (ended) return;
    const id = window.setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ended, poll]);

  const others = snapshot.participants.filter((p) => p.userId !== currentUserId);
  if (!others.length) return null;

  return (
    <div className="hairline-t flex items-center gap-2 overflow-x-auto px-3 py-1.5 scrollbar-none">
      <Link
        href={`/coop/${snapshot.id}`}
        className="press text-text-3 shrink-0 text-[10px] font-bold tracking-[0.1em] uppercase"
      >
        Co-op
      </Link>
      {others.map((p) => (
        <Mate key={p.userId} p={p} />
      ))}
    </div>
  );
}

function Mate({ p }: { p: CoopSnapshot["participants"][number] }) {
  const restingUntil = p.restingUntil ? Date.parse(p.restingUntil) : null;
  const [now, setNow] = useState(() => Date.now());

  // A rest countdown read off a stale snapshot would sit still for three
  // seconds at a time. The endpoint sends the end time; the tick is local.
  useEffect(() => {
    if (restingUntil == null || restingUntil <= Date.now()) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      // Once the rest has run out there is nothing left to count; without
      // this the strip in the sticky header re-rendered once a second for the
      // rest of the session, or until the next poll changed the end time.
      if (t >= restingUntil) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [restingUntil]);

  const restLeft =
    restingUntil != null ? Math.max(0, Math.ceil((restingUntil - now) / 1000)) : 0;
  const done = p.endedAt != null;
  const resting = !done && restLeft > 0;

  return (
    <span className="bg-surface-1 flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1">
      <Avatar src={p.image} name={p.name} size="xs" className="size-6" />
      <span className="max-w-[84px] truncate text-[12px] font-semibold">
        {p.name.split(" ")[0]}
      </span>
      <span
        className={cn(
          "num text-[11px] tabular-nums",
          // Volt is the running-timer colour everywhere else on this screen,
          // and someone else's rest clock is exactly that state.
          resting ? "text-volt" : "text-text-3",
        )}
        // The clock disagrees with the server between polls by design.
        suppressHydrationWarning
      >
        {done
          ? "done"
          : resting
            ? formatDuration(restLeft)
            : `${p.setsCompleted} sets`}
      </span>
    </span>
  );
}
