"use client";

import { useState, useTransition } from "react";
import { watchAction } from "@/components/ui/toast";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, MapPin, Radio, X } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/primitives";
import { checkInAtGym, checkOut } from "@/lib/actions/social";
import type { PresenceEntry } from "@/lib/queries/social";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn, haptic } from "@/lib/utils";
import { useMotionPreset } from "@/hooks/use-motion-preset";

const DURATIONS = [45, 60, 90, 120];

export type PresenceGym = { id: string; name: string; city: string | null };

/**
 * "Who's training right now" strip plus your own check-in control.
 * Presence is a TTL row, so this is accurate at page load without any live
 * connection — which is the only thing Vercel Hobby can support.
 */
export function GymPresenceBar({
  friends,
  checkedIn,
  gyms,
  defaultGymId,
}: {
  friends: PresenceEntry[];
  checkedIn: boolean;
  gyms: PresenceGym[];
  defaultGymId: string | null;
}) {
  const { enabled } = useMotionPreset();
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState("");
  const [minutes, setMinutes] = useState(90);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(checkedIn);
  const [gymId, setGymId] = useState<string | null>(defaultGymId);

  const gymName = gyms.find((g) => g.id === gymId)?.name ?? null;

  function submit() {
    haptic.success();
    setActive(true);
    setSheet(false);
    startTransition(async () => {
      // `null` is a deliberate "don't name a gym", not "unspecified" — the
      // action only falls back to the home gym when the field is absent.
      // Refused (the ten-minute cooldown, mostly): the strip goes back to
      // "not checked in" rather than claiming a broadcast that never went.
      await watchAction(
        checkInAtGym({ gymId, note: note || null, minutes }),
        () => setActive(false),
      );
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
                  await watchAction(checkOut(), () => setActive(true));
                });
              }}
              // 18px tall, and the only way to say you have left the gym —
              // `hit-slop` makes the target 44 without turning a quiet text
              // button into a chunk of chrome in the presence strip.
              className="press hit-slop text-text-3 flex items-center gap-1 text-[12px] font-semibold"
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
              initial={enabled ? { height: 0, opacity: 0 } : { opacity: 0 }}
              animate={
                enabled ? { height: "auto", opacity: 1 } : { opacity: 1 }
              }
              exit={enabled ? { height: 0, opacity: 0 } : { opacity: 0 }}
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
              {gymName
                ? `Your friends can see you're at ${gymName}`
                : "Your friends can see you're training"}
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
          <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            Which gym?
          </p>
          {gyms.length === 0 ? (
            <p className="text-text-3 mb-1 text-[13px] leading-relaxed">
              You haven&apos;t joined a gym yet.{" "}
              <Link href="/gyms" className="text-volt font-semibold">
                Add one
              </Link>{" "}
              and your check-ins can name it.
            </p>
          ) : (
            <div className="border-hairline rounded-card divide-hairline overflow-hidden border divide-y">
              {gyms.map((g) => (
                <GymOption
                  key={g.id}
                  label={g.name}
                  sub={g.city}
                  selected={gymId === g.id}
                  onSelect={() => {
                    haptic.light();
                    setGymId(g.id);
                  }}
                />
              ))}
              <GymOption
                label="Don't say where"
                sub="Friends see you're training, not the gym"
                selected={gymId === null}
                onSelect={() => {
                  haptic.light();
                  setGymId(null);
                }}
              />
            </div>
          )}

          <p className="text-text-3 mt-5 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
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

/**
 * One row of the gym picker. A row, not a chip: gym names are long enough to
 * wrap and there is no useful upper bound on how many gyms someone belongs to.
 */
function GymOption({
  label,
  sub,
  selected,
  onSelect,
}: {
  label: string;
  sub: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "press tap flex w-full items-center gap-3 px-3.5 py-2.5 text-left",
        selected ? "bg-volt-fade" : "bg-surface-2",
      )}
    >
      <MapPin
        className={cn(
          "size-4 shrink-0",
          selected ? "text-volt" : "text-text-3",
        )}
        strokeWidth={2.2}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[14px] font-semibold",
            selected ? "text-volt" : "text-text-1",
          )}
        >
          {label}
        </span>
        {sub && (
          <span className="text-text-3 block truncate text-[12px]">{sub}</span>
        )}
      </span>
      {selected && (
        <Check className="text-volt size-4 shrink-0" strokeWidth={2.8} />
      )}
    </button>
  );
}
