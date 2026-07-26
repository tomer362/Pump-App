"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, Radio, X } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/primitives";
import { checkInAtGym, checkOut } from "@/lib/actions/social";
import type { PresenceEntry } from "@/lib/queries/social";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn, haptic } from "@/lib/utils";

const DURATIONS = [45, 60, 90, 120];

/**
 * "Who's training right now" strip plus your own check-in control.
 * Presence is a TTL row, so this is accurate at page load without any live
 * connection — which is the only thing Vercel Hobby can support.
 */
export function GymPresenceBar({
  friends,
  checkedIn,
  homeGymName,
}: {
  friends: PresenceEntry[];
  checkedIn: boolean;
  homeGymName: string | null;
}) {
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState("");
  const [minutes, setMinutes] = useState(90);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(checkedIn);

  function submit() {
    haptic.success();
    setActive(true);
    setSheet(false);
    startTransition(async () => {
      await checkInAtGym({ note: note || null, minutes });
    });
  }

  return (
    <div className="px-4 pb-4">
      <div className="border-hairline bg-surface-1 rounded-card overflow-hidden border">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <Radio
            className={cn(
              "size-4",
              friends.length > 0 ? "text-volt" : "text-text-3",
            )}
            strokeWidth={2.4}
          />
          <p className="flex-1 text-[13px] font-semibold">
            {friends.length > 0
              ? `${friends.length} friend${friends.length === 1 ? "" : "s"} training now`
              : "Nobody at the gym right now"}
          </p>
          {active ? (
            <button
              onClick={() => {
                haptic.light();
                setActive(false);
                startTransition(async () => {
                  await checkOut();
                });
              }}
              className="press text-text-3 flex items-center gap-1 text-[12px] font-semibold"
            >
              <X className="size-3.5" strokeWidth={2.6} />
              End
            </button>
          ) : (
            <button
              onClick={() => {
                haptic.light();
                setSheet(true);
              }}
              className="press text-volt text-[12px] font-bold"
            >
              I&apos;m here
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {friends.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-3 overflow-x-auto px-4 pt-1 pb-3.5 scrollbar-none">
                {friends.map((f) => (
                  <Link
                    key={f.userId}
                    href={`/u/${f.username ?? f.userId}`}
                    className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                  >
                    <Avatar src={f.image} name={f.name} size="lg" ring />
                    <span className="w-full truncate text-center text-[11px] font-medium">
                      {f.name.split(" ")[0]}
                    </span>
                    <TimeAgo
                      date={f.startedAt}
                      className="text-text-3 num -mt-1 text-[10px]"
                    />
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {active && (
          <div className="bg-volt-fade hairline-t flex items-center gap-2 px-4 py-2">
            <span className="relative flex size-2">
              <span className="bg-volt absolute inline-flex size-full animate-ping rounded-full opacity-70" />
              <span className="bg-volt relative inline-flex size-2 rounded-full" />
            </span>
            <p className="text-volt text-[12px] font-semibold">
              Your friends can see you&apos;re training
            </p>
          </div>
        )}
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Let your friends know"
        footer={
          <Button block variant="volt" onClick={submit} loading={pending}>
            Broadcast for {minutes} min
          </Button>
        }
      >
        <div className="px-4 pb-4">
          {homeGymName && (
            <p className="text-text-3 mb-4 flex items-center gap-1.5 text-[13px]">
              <MapPin className="size-3.5" />
              {homeGymName}
            </p>
          )}

          <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            Add a note (optional)
          </p>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Leg day, come suffer with me"
            maxLength={80}
          />

          <p className="text-text-3 mt-5 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            For how long?
          </p>
          <div className="flex gap-2">
            {DURATIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                className={cn(
                  "press num rounded-field h-11 flex-1 border text-[14px] font-semibold",
                  minutes === m
                    ? "border-volt bg-volt-fade text-volt"
                    : "border-hairline bg-surface-2 text-text-2",
                )}
              >
                {m}m
              </button>
            ))}
          </div>

          <p className="text-text-3 mt-4 text-[12px] leading-relaxed">
            Only accepted friends see this, and it disappears on its own when
            the time is up.
          </p>
        </div>
      </Sheet>
    </div>
  );
}
