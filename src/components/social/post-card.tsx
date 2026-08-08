"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { Heart, MessageCircle, Share2, Trophy } from "lucide-react";
import { Avatar, Badge } from "@/components/ui/primitives";
import { toggleLike } from "@/lib/actions/social";
import type { FeedItem } from "@/lib/queries/social";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn, formatDurationLong, formatVolume, haptic } from "@/lib/utils";
import { ENTER, REDUCED } from "@/lib/motion";
import { useMotionPreset } from "@/hooks/use-motion-preset";

export function PostCard({
  item,
  unit,
}: {
  item: FeedItem;
  unit: "kg" | "lb";
}) {
  const { enabled } = useMotionPreset();
  const [liked, setLiked] = useState(item.likedByMe);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [, startTransition] = useTransition();
  const [burst, setBurst] = useState(0);

  function onLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    if (next) {
      haptic.medium();
      setBurst((n) => n + 1);
    }
    startTransition(async () => {
      const res = await toggleLike(item.postId);
      if (res.ok && res.data) {
        setLiked(res.data.liked);
        setLikeCount(res.data.likeCount);
      }
    });
  }

  async function onShare() {
    haptic.light();
    const url = `${window.location.origin}/post/${item.postId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.workout.name, url });
        return;
      } catch {
        /* dismissed */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <article className="border-hairline bg-surface-1 rounded-card border">
      <header className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
        <Link href={`/u/${item.author.username ?? item.author.id}`}>
          <Avatar src={item.author.image} name={item.author.name} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/u/${item.author.username ?? item.author.id}`}
            className="block truncate text-[15px] font-semibold"
          >
            {item.author.name}
          </Link>
          <p className="text-text-3 truncate text-[12px]">
            <TimeAgo date={item.createdAt} />
            {item.author.username && ` · @${item.author.username}`}
          </p>
        </div>
        {item.workout.prCount > 0 && (
          <Badge tone="pr">
            <Trophy className="size-3" strokeWidth={2.6} />
            {item.workout.prCount} PR
          </Badge>
        )}
      </header>

      <Link href={`/history/${item.workout.id}`} className="block px-4">
        <h3 className="text-[17px] leading-tight font-semibold">
          {item.workout.name}
        </h3>
        {item.caption && (
          <p className="text-text-2 mt-1 text-[14px] leading-relaxed">
            {item.caption}
          </p>
        )}

        <div className="border-hairline mt-3 grid grid-cols-3 gap-2 rounded-[12px] border px-3 py-2.5">
          <MiniStat
            label="Time"
            value={formatDurationLong(item.workout.durationSeconds)}
          />
          <MiniStat
            label="Volume"
            value={`${formatVolume(item.workout.totalVolumeKg, unit)} ${unit}`}
          />
          <MiniStat label="Sets" value={String(item.workout.totalSets)} />
        </div>

        {item.exercises.length > 0 && (
          <p className="text-text-3 mt-2 truncate text-[13px]">
            {item.exercises.join(" · ")}
          </p>
        )}

        {item.workout.photoUrl && (
          // 4:3 rather than square: gym photos are overwhelmingly landscape
          // mirror shots, and a square crop cuts the bar out of half of them.
          <div className="bg-surface-2 relative mt-3 aspect-[4/3] overflow-hidden rounded-[12px]">
            <Image
              src={item.workout.photoUrl}
              alt=""
              fill
              sizes="(max-width: 512px) 100vw, 512px"
              className="object-cover"
            />
          </div>
        )}
      </Link>

      <footer className="mt-3 flex items-center gap-1 px-2 pb-1.5">
        <button
          onClick={onLike}
          aria-pressed={liked}
          aria-label={liked ? "Unlike" : "Like"}
          className="press tap relative flex items-center gap-1.5 px-2.5 py-2"
        >
          <motion.span
            key={burst}
            animate={
              liked && burst > 0
                ? { scale: [1, 1.35, 0.92, 1] }
                : { scale: 1 }
            }
            transition={enabled ? ENTER : REDUCED}
            className="inline-flex"
          >
            <Heart
              className={cn(
                "size-[19px] transition-colors",
                liked ? "fill-volt text-volt" : "text-text-3",
              )}
              strokeWidth={2.2}
            />
          </motion.span>
          <span
            className={cn(
              "num text-[13px] font-semibold",
              liked ? "text-volt" : "text-text-3",
            )}
          >
            {likeCount > 0 ? likeCount : ""}
          </span>
        </button>

        <Link
          href={`/post/${item.postId}`}
          className="press tap text-text-3 flex items-center gap-1.5 px-2.5 py-2"
        >
          <MessageCircle className="size-[19px]" strokeWidth={2.2} />
          <span className="num text-[13px] font-semibold">
            {item.commentCount > 0 ? item.commentCount : ""}
          </span>
        </Link>

        <button
          onClick={onShare}
          aria-label="Share workout"
          className="press tap text-text-3 ml-auto px-2.5 py-2"
        >
          <Share2 className="size-[18px]" strokeWidth={2.2} />
        </button>
      </footer>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-text-3 text-[10px] font-bold tracking-[0.06em] uppercase">
        {label}
      </p>
      <p className="num text-text-1 truncate text-[15px] font-bold">{value}</p>
    </div>
  );
}
