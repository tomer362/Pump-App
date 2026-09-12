"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Trophy,
  UserCheck,
  UserPlus,
  Radio,
  Bell,
} from "lucide-react";
import { Avatar, Card, EmptyState } from "@/components/ui/primitives";
import { TimeAgo } from "@/components/ui/time-ago";
import { markNotificationsRead } from "@/lib/actions/notification-actions";
import type { NotificationItem } from "@/lib/actions/notify";
import type { NotificationType } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const ICONS: Record<
  NotificationType,
  { icon: typeof Heart; tone: string }
> = {
  like: { icon: Heart, tone: "text-volt" },
  comment: { icon: MessageCircle, tone: "text-text-2" },
  comment_reply: { icon: MessageCircle, tone: "text-text-2" },
  friend_request: { icon: UserPlus, tone: "text-text-2" },
  friend_accepted: { icon: UserCheck, tone: "text-volt" },
  gym_presence: { icon: Radio, tone: "text-volt" },
  achievement: { icon: Trophy, tone: "text-pr" },
  routine_like: { icon: Heart, tone: "text-volt" },
  routine_save: { icon: Bookmark, tone: "text-text-2" },
};

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const [, startTransition] = useTransition();
  const hasUnread = items.some((n) => n.readAt == null);

  // Opening the inbox is the read receipt. Deliberately after paint, so the
  // unread highlight is visible for the moment the user arrives.
  useEffect(() => {
    if (!hasUnread) return;
    const id = window.setTimeout(() => {
      startTransition(async () => {
        await markNotificationsRead();
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [hasUnread]);

  if (!items.length) {
    return (
      <EmptyState
        icon={Bell}
        title="Nothing yet"
        body="Likes, comments, friend requests and gym check-ins land here."
      />
    );
  }

  return (
    <Card className="divide-hairline divide-y overflow-hidden">
      {items.map((n) => {
        const { icon: Icon, tone } = ICONS[n.type] ?? ICONS.like;
        const href = n.postId
          ? `/post/${n.postId}`
          : n.type === "friend_request"
            ? "/friends"
            : n.actor
              ? `/u/${n.actor.username ?? n.actor.id}`
              : "/feed";

        return (
          <Link
            key={n.id}
            href={href}
            className="press relative flex items-center gap-3 px-4 py-3"
          >
            {/* A dot, not a tinted row: an inbox opened after a week was a
                screen of volt blocks, which is the decoration the accent rule
                forbids. The tab bar marks unread with the same dot. */}
            {n.readAt == null && (
              <span
                aria-label="Unread"
                className="bg-volt absolute top-1/2 left-1.5 size-1.5 -translate-y-1/2 rounded-full"
              />
            )}
            {n.actor ? (
              <Avatar src={n.actor.image} name={n.actor.name} size="md" />
            ) : (
              <span className="bg-surface-2 grid size-10 shrink-0 place-items-center rounded-full">
                <Icon className={cn("size-[18px]", tone)} strokeWidth={2.2} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug">{n.body}</p>
              <TimeAgo
                date={n.createdAt}
                className="text-text-3 text-[12px]"
              />
            </div>

            {n.actor && (
              <Icon className={cn("size-4 shrink-0", tone)} strokeWidth={2.2} />
            )}
          </Link>
        );
      })}
    </Card>
  );
}
