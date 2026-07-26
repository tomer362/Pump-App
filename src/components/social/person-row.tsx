"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Check, UserPlus, UserCheck, Clock } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  acceptFriendRequest,
  declineFriendRequest,
  sendFriendRequest,
  toggleFollow,
} from "@/lib/actions/social";
import type { PersonCard } from "@/lib/queries/social";
import { cn, haptic } from "@/lib/utils";

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
  const [justAdded, setJustAdded] = useState(false);

  function celebrate() {
    haptic.success();
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  }

  return (
    <div className="relative flex items-center gap-3 px-4 py-3">
      <Link href={`/u/${person.username ?? person.id}`}>
        <Avatar src={person.image} name={person.name} size="md" />
      </Link>

      <Link
        href={`/u/${person.username ?? person.id}`}
        className="min-w-0 flex-1"
      >
        <p className="truncate text-[15px] font-medium">{person.name}</p>
        <p className="text-text-3 truncate text-[12px]">
          {person.username ? `@${person.username}` : ""}
          {person.workoutCount > 0 &&
            `${person.username ? " · " : ""}${person.workoutCount} workout${
              person.workoutCount === 1 ? "" : "s"
            }`}
        </p>
      </Link>

      <div className="flex shrink-0 items-center gap-1.5">
        {status === "friends" ? (
          <span className="text-volt flex items-center gap-1 text-[12px] font-semibold">
            <UserCheck className="size-4" strokeWidth={2.4} />
            Friends
          </span>
        ) : status === "pending_out" ? (
          <span className="text-text-3 flex items-center gap-1 text-[12px] font-semibold">
            <Clock className="size-3.5" strokeWidth={2.4} />
            Requested
          </span>
        ) : status === "pending_in" ? (
          <>
            <Button
              size="sm"
              variant="volt"
              onClick={() => {
                setStatus("friends");
                celebrate();
                startTransition(async () => {
                  await acceptFriendRequest(person.id);
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
                  await declineFriendRequest(person.id);
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
                const res = await sendFriendRequest(person.id);
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
              setFollowing((v) => !v);
              haptic.light();
              startTransition(async () => {
                const res = await toggleFollow(person.id);
                if (res.ok && res.data) setFollowing(res.data.following);
              });
            }}
            className={cn(
              "press rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
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
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-bg/92 pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-0"
    >
      <motion.span
        initial={{ x: -46, opacity: 0, scale: 0.7 }}
        animate={{ x: 6, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.05 }}
      >
        <Avatar name={person.name} src={person.image} size="md" />
      </motion.span>
      <motion.span
        initial={{ x: 46, opacity: 0, scale: 0.7 }}
        animate={{ x: -6, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.05 }}
        className="ring-bg rounded-full ring-2"
      >
        <span className="bg-volt grid size-10 place-items-center rounded-full text-black">
          <Check className="size-5" strokeWidth={3.2} />
        </span>
      </motion.span>
      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-volt ml-3 text-[13px] font-bold"
      >
        Friends
      </motion.span>
    </motion.div>
  );
}
