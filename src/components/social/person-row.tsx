"use client";

import { useState, useTransition } from "react";
import { useTransient } from "@/hooks/use-transient";
import { watchAction } from "@/components/ui/toast";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, UserPlus, UserCheck, UserMinus, Clock } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  sendFriendRequest,
  toggleFollow,
} from "@/lib/actions/social";
import type { PersonCard } from "@/lib/queries/social";
import { cn, haptic } from "@/lib/utils";
import { useMotionPreset } from "@/hooks/use-motion-preset";

export function PersonRow({
  person,
  showFollow = true,
}: {
  person: PersonCard;
  showFollow?: boolean;
}) {
  const [status, setStatus] = useState(person.friendStatus);
  const [following, setFollowing] = useState(person.isFollowing);
  const [, startTransition] = useTransition();
  // Drives the two-avatars-snap-together confirmation.
  const [justAdded, flashJustAdded] = useTransient(false, 1600);
  // Second-tap confirmation for the destructive actions.
  const [confirming, flashConfirming, stopConfirming] = useTransient(false, 3000);

  function celebrate() {
    haptic.success();
    flashJustAdded(true);
  }

  return (
    <div className="relative flex items-center gap-3 px-4 py-3">
      {/* One link over the avatar and the name, not two to the same profile.
          Separately they were a 40px square and a 41px block, each a little
          under the minimum and each announced on its own to a screen reader;
          together they are the row's identity, which is what a tap here
          means. */}
      <Link
        href={`/u/${person.username ?? person.id}`}
        className="press hit-slop flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar src={person.image} name={person.name} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">
            {person.name}
          </span>
          <span className="text-text-3 block truncate text-[12px]">
            {person.username ? `@${person.username}` : ""}
            {person.workoutCount > 0 &&
              `${person.username ? " · " : ""}${person.workoutCount} workout${
                person.workoutCount === 1 ? "" : "s"
              }`}
          </span>
        </span>
      </Link>

      {/* `gap-2`: these are two different destructive-ish actions — stop
          being friends, stop following — and 6px apart a thumb picks whichever
          it likes. */}
      <div className="flex shrink-0 items-center gap-2">
        {status === "friends" ? (
          // Two taps to unfriend, with no modal: the second tap confirms and
          // the state reverts on its own if it was a mis-tap.
          <button
            onClick={() => {
              if (!confirming) {
                haptic.light();
                flashConfirming(true);
                return;
              }
              stopConfirming();
              setStatus("none");
              haptic.medium();
              startTransition(async () => {
                await watchAction(removeFriend(person.id), () =>
                  setStatus("friends"),
                );
              });
            }}
            className={cn(
              "press hit-slop flex items-center gap-1 rounded-full px-2 py-1.5 text-[12px] font-semibold",
              confirming ? "bg-danger-fade text-danger" : "text-volt",
            )}
          >
            {confirming ? (
              <>
                <UserMinus className="size-3.5" strokeWidth={2.4} />
                Remove?
              </>
            ) : (
              <>
                <UserCheck className="size-4" strokeWidth={2.4} />
                Friends
              </>
            )}
          </button>
        ) : status === "pending_out" ? (
          // Cancelling deletes the request row, which is what removeFriend
          // does — there is no separate "withdraw" state to model.
          <button
            onClick={() => {
              if (!confirming) {
                haptic.light();
                flashConfirming(true);
                return;
              }
              stopConfirming();
              setStatus("none");
              startTransition(async () => {
                await watchAction(removeFriend(person.id), () =>
                  setStatus("pending_out"),
                );
              });
            }}
            className={cn(
              "press hit-slop flex items-center gap-1 rounded-full px-2 py-1.5 text-[12px] font-semibold",
              confirming ? "bg-danger-fade text-danger" : "text-text-3",
            )}
          >
            <Clock className="size-3.5" strokeWidth={2.4} />
            {confirming ? "Cancel it?" : "Requested"}
          </button>
        ) : status === "pending_in" ? (
          <>
            <Button
              size="sm"
              variant="volt"
              onClick={() => {
                setStatus("friends");
                celebrate();
                startTransition(async () => {
                  await watchAction(acceptFriendRequest(person.id), () =>
                    setStatus("pending_in"),
                  );
                });
              }}
            >
              <Check className="size-3.5" strokeWidth={3} />
              Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStatus("none");
                startTransition(async () => {
                  await watchAction(declineFriendRequest(person.id), () =>
                    setStatus("pending_in"),
                  );
                });
              }}
            >
              Ignore
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="solid"
            onClick={() => {
              setStatus("pending_out");
              haptic.light();
              startTransition(async () => {
                // "Requested" was painted before the ask and never taken
                // back when the ask was refused.
                const res = await watchAction(sendFriendRequest(person.id), () =>
                  setStatus("none"),
                );
                if (res.ok && res.data?.status === "friends") {
                  setStatus("friends");
                  celebrate();
                }
              });
            }}
          >
            <UserPlus className="size-3.5" strokeWidth={2.4} />
            Add
          </Button>
        )}

        {showFollow && status !== "pending_in" && (
          <button
            onClick={() => {
              const next = !following;
              setFollowing(next);
              haptic.light();
              startTransition(async () => {
                const res = await watchAction(toggleFollow(person.id), () =>
                  setFollowing(!next),
                );
                if (res.ok && res.data) setFollowing(res.data.following);
              });
            }}
            className={cn(
              "press hit-slop rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
              following
                ? "text-text-3"
                : "bg-surface-2 text-text-1",
            )}
          >
            {following ? "Following" : "Follow"}
          </button>
        )}
      </div>

      <AnimatePresence>{justAdded && <FriendSnap person={person} />}</AnimatePresence>
    </div>
  );
}

/**
 * Friend-added confirmation: the two avatars fly in from opposite sides and
 * snap together, then the row settles back. Short and non-blocking — you can
 * keep scrolling through it.
 */
function FriendSnap({ person }: { person: PersonCard }) {
  // The one animation in the app built entirely out of travel, so reduced
  // motion doesn't just shorten it — the avatars stop moving and only the
  // confirmation fades in.
  const { enabled, spring } = useMotionPreset();
  const fly = (from: number, to: number) =>
    enabled
      ? {
          initial: { x: from, opacity: 0, scale: 0.7 },
          animate: { x: to, opacity: 1, scale: 1 },
          transition: { ...spring.snap, delay: 0.05 },
        }
      : {
          initial: { opacity: 0 },
          animate: { x: to, opacity: 1 },
          transition: spring.snap,
        };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-bg/92 pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-0"
    >
      <motion.span {...fly(-46, 6)}>
        <Avatar name={person.name} src={person.image} size="md" />
      </motion.span>
      <motion.span
        {...fly(46, -6)}
        className="ring-bg rounded-full ring-2"
      >
        <span className="bg-volt grid size-10 place-items-center rounded-full text-black">
          <Check className="size-5" strokeWidth={3.2} />
        </span>
      </motion.span>
      <motion.span
        initial={{ opacity: 0, y: enabled ? 6 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: enabled ? 0.3 : 0 }}
        className="text-volt ml-3 text-[13px] font-bold"
      >
        Friends
      </motion.span>
    </motion.div>
  );
}
