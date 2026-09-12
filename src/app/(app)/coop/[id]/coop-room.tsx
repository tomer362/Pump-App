"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTransient } from "@/hooks/use-transient";
import { watchAction } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Copy, Dumbbell, LogOut, Square } from "lucide-react";
import { Avatar, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  endCoopSession,
  getCoopSnapshot,
  leaveCoopSession,
  type CoopSnapshot,
} from "@/lib/actions/coop";
import { Elapsed } from "@/components/ui/elapsed";
import { cn, formatDuration, formatVolume, haptic } from "@/lib/utils";
import { useMotionPreset } from "@/hooks/use-motion-preset";

const POLL_MS = 3000;

/**
 * Live-ish co-op room.
 *
 * Vercel's serverless functions can't hold a WebSocket, so this polls a single
 * cheap query. Polling is gated on tab visibility and stops entirely once the
 * session ends, so an idle phone in a pocket isn't burning invocations.
 */
export function CoopRoom({
  initial,
  currentUserId,
  unit,
}: {
  initial: CoopSnapshot;
  currentUserId: string;
  unit: "kg" | "lb";
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [copied, flashCopied] = useTransient(false, 2000);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const ended = snapshot.endedAt != null;
  const isHost = snapshot.hostId === currentUserId;
  const me = snapshot.participants.find((p) => p.userId === currentUserId);

  const poll = useCallback(async () => {
    if (inFlight.current || document.visibilityState !== "visible") return;
    inFlight.current = true;
    try {
      const next = await getCoopSnapshot(initial.id);
      if (next) setSnapshot(next);
    } finally {
      inFlight.current = false;
    }
  }, [initial.id]);

  useEffect(() => {
    if (ended) return;
    const id = window.setInterval(poll, POLL_MS);
    // Catch up immediately on returning to the tab rather than waiting a tick.
    const onVisible = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll, ended]);

  async function copyCode() {
    haptic.light();
    try {
      await navigator.clipboard.writeText(snapshot.joinCode);
      flashCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-5 px-4">
      <Card className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-text-3 text-[11px] font-semibold tracking-[0.08em] uppercase">
              {ended ? "Session ended" : "Join code"}
            </p>
            <button
              onClick={copyCode}
              disabled={ended}
              className="press num mt-0.5 flex items-center gap-2 text-[24px] font-bold tracking-[0.18em]"
            >
              {snapshot.joinCode}
              {!ended &&
                (copied ? (
                  <Check className="text-volt size-4" strokeWidth={3} />
                ) : (
                  <Copy className="text-text-3 size-4" />
                ))}
            </button>
          </div>
          {!ended && (
            <span className="relative flex size-2.5">
              <span className="bg-volt absolute inline-flex size-full animate-ping rounded-full opacity-70" />
              <span className="bg-volt relative inline-flex size-2.5 rounded-full" />
            </span>
          )}
        </div>
        <p className="text-text-3 mt-2 text-[12px] leading-relaxed">
          Share the code. Everyone logs their own sets — this screen just shows
          how each of you is doing.
        </p>
        {snapshot.loadMultiplier !== 1 && (
          <p className="text-text-2 num mt-2 text-[12px]">
            Running at{" "}
            <span className="text-volt font-bold">
              {Math.round(snapshot.loadMultiplier * 100)}%
            </span>{" "}
            of the prescribed load.
          </p>
        )}
      </Card>

      {me?.workoutId && !ended && (
        <Button
          block
          variant="volt"
          size="lg"
          onClick={() => router.push(`/workout/${me.workoutId}`)}
        >
          <Dumbbell className="size-4" strokeWidth={2.4} />
          Open my workout
        </Button>
      )}

      <div>
        <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
          {snapshot.participants.length} training
        </p>
        <div className="space-y-2">
          {snapshot.participants.map((p) => (
            <ParticipantCard
              key={p.userId}
              participant={p}
              isMe={p.userId === currentUserId}
              unit={unit}
            />
          ))}
        </div>
      </div>

      {!ended && (
        <div className="space-y-2 pt-2">
          {isHost ? (
            <Button
              block
              variant="ghost"
              className="text-danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const res = await watchAction(endCoopSession(snapshot.id));
                if (res.ok) router.refresh();
                setBusy(false);
              }}
            >
              <Square className="size-4" />
              End session for everyone
            </Button>
          ) : (
            <Button
              block
              variant="ghost"
              className="text-text-3"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                const res = await watchAction(leaveCoopSession(snapshot.id));
                if (!res.ok) {
                  setBusy(false);
                  return;
                }
                router.replace("/start");
                router.refresh();
              }}
            >
              <LogOut className="size-4" />
              Leave session
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ParticipantCard({
  participant: p,
  isMe,
  unit,
}: {
  participant: CoopSnapshot["participants"][number];
  isMe: boolean;
  unit: "kg" | "lb";
}) {
  const { enabled } = useMotionPreset();
  const finished = p.endedAt != null;
  // A finished lifter shows their final duration, not a clock that ticks
  // forever — <Elapsed> is only mounted while they're still training.
  const finalSeconds =
    finished && p.startedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(p.endedAt!).getTime() - new Date(p.startedAt).getTime()) /
              1000,
          ),
        )
      : 0;
  const restingLeft = useRestingCountdown(finished ? null : p.restingUntil);

  return (
    <Card
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        isMe && "border-volt/40",
      )}
    >
      <Avatar
        src={p.image}
        name={p.name}
        size="md"
        ring={!finished && restingLeft === null && p.setsCompleted > 0}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold">
          {p.name}
          {isMe && <span className="text-text-3 ml-1.5 text-[12px]">you</span>}
        </p>
        <p className="text-text-3 num text-[12px]">
          {p.setsCompleted} set{p.setsCompleted === 1 ? "" : "s"} ·{" "}
          {formatVolume(p.volumeKg, unit)} {unit}
          {p.startedAt && (
            <>
              {" · "}
              {finished ? (
                formatDuration(finalSeconds)
              ) : (
                // Ticks against wall-clock, so it has to survive hydration.
                <Elapsed start={p.startedAt} />
              )}
            </>
          )}
        </p>
      </div>

      {finished && (
        <span className="bg-surface-2 text-text-2 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold">
          <Check className="size-3.5" strokeWidth={3} />
          Done
        </span>
      )}

      {!finished && restingLeft !== null && (
        <motion.span
          initial={{ opacity: 0, scale: enabled ? 0.9 : 1 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-volt-fade text-volt num shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold"
        >
          {formatDuration(restingLeft)}
        </motion.span>
      )}
    </Card>
  );
}

/** Seconds left on someone else's rest, or null when they're working. */
function useRestingCountdown(restingUntil: string | null) {
  const [ticked, setTicked] = useState<number | null>(null);
  // Derived so clearing doesn't need a state write from inside an effect.
  const left = restingUntil ? ticked : null;

  useEffect(() => {
    if (!restingUntil) return;
    const end = new Date(restingUntil).getTime();
    const tick = () => {
      const secs = Math.ceil((end - Date.now()) / 1000);
      setTicked(secs > 0 ? secs : null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [restingUntil]);

  return left;
}
