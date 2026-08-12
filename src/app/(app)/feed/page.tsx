import Link from "next/link";
import { Compass, Dumbbell, UserPlus } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/social/post-card";
import { FeedList } from "@/components/social/feed-list";
import { GymPresenceBar } from "@/components/social/gym-presence-bar";
import { requireUser } from "@/lib/session";
import {
  getDiscoveryFeed,
  getFollowingFeed,
  getFriendsAtGym,
  getMyGyms,
  getMyPresence,
} from "@/lib/queries/social";
import { FEED_PAGE_SIZE } from "@/lib/pagination";

export default async function FeedPage() {
  const me = await requireUser();

  // The gym lookup used to run *after* this fan-out resolved — a fifth serial
  // round trip on the most-visited route, and on a scaled-to-zero Neon that is
  // a cold start the user waits through. It depends on nothing else here, so
  // it belongs in the same batch.
  const [items, atGym, presence, discovery, myGyms] = await Promise.all([
    getFollowingFeed(me.id, { limit: FEED_PAGE_SIZE }),
    getFriendsAtGym(me.id),
    getMyPresence(me.id),
    getDiscoveryFeed(me.id, 6),
    getMyGyms(me.id),
  ]);

  // The picker only ever offers gyms you belong to, which is also what
  // `checkInAtGym` enforces — so a stale home-gym id can't be preselected.
  const gyms = myGyms.map((g) => ({ id: g.id, name: g.name, city: g.city }));
  const isMember = (id: string | null) =>
    id != null && gyms.some((g) => g.id === id);

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
        gyms={gyms}
        defaultGymId={
          isMember(presence?.gymId ?? null)
            ? (presence?.gymId ?? null)
            : isMember(me.homeGymId)
              ? me.homeGymId
              : null
        }
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
        <FeedList initial={items} unit={me.unit} />
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
