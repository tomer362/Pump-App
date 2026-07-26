import Link from "next/link";
import { Compass, Dumbbell, UserPlus } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/social/post-card";
import { GymPresenceBar } from "@/components/social/gym-presence-bar";
import { requireUser } from "@/lib/session";
import {
  getDiscoveryFeed,
  getFollowingFeed,
  getFriendsAtGym,
  getMyPresence,
} from "@/lib/queries/social";
import { db } from "@/lib/db";
import { gym } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function FeedPage() {
  const me = await requireUser();

  const [items, atGym, presence, discovery] = await Promise.all([
    getFollowingFeed(me.id, { limit: 20 }),
    getFriendsAtGym(me.id),
    getMyPresence(me.id),
    getDiscoveryFeed(me.id, 6),
  ]);

  const homeGymName = me.homeGymId
    ? ((
        await db
          .select({ name: gym.name })
          .from(gym)
          .where(eq(gym.id, me.homeGymId))
          .limit(1)
      )[0]?.name ?? null)
    : null;

  return (
    <div className="pb-6">
      <NavBar
        title="Feed"
        right={
          <Link
            href="/friends"
            aria-label="Find people"
            className="press tap text-text-2 grid place-items-center px-2"
          >
            <UserPlus className="size-[22px]" strokeWidth={2.2} />
          </Link>
        }
      />

      <GymPresenceBar
        friends={atGym}
        checkedIn={presence != null}
        homeGymName={homeGymName}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Your feed is quiet"
          body="Finish a workout, or follow some people — their sessions land here as they log them."
          action={
            <div className="flex gap-2">
              <Link href="/start">
                <Button variant="volt">Start a workout</Button>
              </Link>
              <Link href="/friends">
                <Button variant="outline">Find people</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-3 px-4">
          {items.map((item) => (
            <PostCard key={item.postId} item={item} unit={me.unit} />
          ))}
        </div>
      )}

      {discovery.length > 0 && (
        <div className="mt-8 px-4">
          <SectionTitle
            action={
              <Link
                href="/discover"
                className="text-volt flex items-center gap-1 text-[13px] font-semibold"
              >
                <Compass className="size-3.5" />
                More
              </Link>
            }
          >
            Discover
          </SectionTitle>
          <div className="space-y-3">
            {discovery.slice(0, 3).map((item) => (
              <PostCard key={item.postId} item={item} unit={me.unit} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
