import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Avatar, Card, SectionTitle } from "@/components/ui/primitives";
import { PersonRow } from "@/components/social/person-row";
import { PostCard } from "@/components/social/post-card";
import { AchievementGrid } from "@/components/profile/achievement-grid";
import { requireUser } from "@/lib/session";
import {
  getFollowCounts,
  getPersonByUsername,
  getUserFeed,
} from "@/lib/queries/social";
import { getAchievements, getLifetimeStats } from "@/lib/queries/stats";
import { db } from "@/lib/db";
import { post, user as userTable, workout } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { formatVolume } from "@/lib/utils";

export default async function PublicProfilePage(
  props: PageProps<"/u/[username]">,
) {
  const { username } = await props.params;
  const me = await requireUser();

  // The URL accepts either a handle or a raw id, since not everyone has set
  // a username yet and feed links fall back to the id.
  const person = await getPersonByUsername(me.id, username);
  if (!person) {
    const [byId] = await db
      .select({ username: userTable.username })
      .from(userTable)
      .where(eq(userTable.id, username))
      .limit(1);
    if (byId?.username) redirect(`/u/${byId.username}`);
    if (!byId) notFound();
  }
  if (!person) notFound();
  if (person.id === me.id) redirect("/profile");

  const [stats, counts, achievements, posts] = await Promise.all([
    getLifetimeStats(person.id),
    getFollowCounts(person.id),
    getAchievements(person.id),
    db
      .select({ id: post.id })
      .from(post)
      .innerJoin(workout, eq(workout.id, post.workoutId))
      .where(eq(post.userId, person.id))
      .orderBy(desc(post.createdAt))
      .limit(10),
  ]);

  // Only people you follow get their sessions rendered here. This is their
  // own posts, not a slice of the viewer's home feed — that used to be
  // `getFollowingFeed(me.id).filter(...)`, which is capped at the viewer's
  // most recent posts across everyone they follow, so a viewer who follows a
  // handful of active people could see this render empty regardless of
  // whether the author had posted recently.
  const feed = person.isFollowing ? await getUserFeed(person.id, me.id) : [];

  return (
    <div className="pb-8">
      <NavBar title={person.name} back large={false} />

      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-4">
          <Avatar src={person.image} name={person.name} size="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[20px] leading-tight font-bold">
              {person.name}
            </h2>
            {person.username && (
              <p className="text-text-3 truncate text-[14px]">
                @{person.username}
              </p>
            )}
            {person.bio && (
              <p className="text-text-2 mt-1 text-[13px] leading-snug">
                {person.bio}
              </p>
            )}
          </div>
        </div>

        <Card className="divide-hairline divide-y overflow-hidden">
          <PersonRow person={person} />
        </Card>

        <div className="border-hairline rounded-card grid grid-cols-4 gap-2 border px-2 py-3">
          <Stat label="Workouts" value={stats.workouts} />
          <Stat
            label={me.unit}
            value={formatVolume(stats.totalVolumeKg, me.unit)}
          />
          <Stat label="Followers" value={counts.followers} />
          <Stat label="Following" value={counts.following} />
        </div>

        <div>
          <SectionTitle>Achievements</SectionTitle>
          <AchievementGrid achievements={achievements} />
        </div>

        <div>
          <SectionTitle>Workouts</SectionTitle>
          {!person.isFollowing ? (
            <Card className="flex items-center gap-3 px-4 py-5">
              <Lock className="text-text-3 size-5 shrink-0" />
              <p className="text-text-2 flex-1 text-[14px] leading-snug">
                Follow {person.name.split(" ")[0]} to see their sessions in your
                feed.
              </p>
            </Card>
          ) : feed.length === 0 ? (
            <Card className="px-4 py-5">
              <p className="text-text-3 text-center text-[14px]">
                {posts.length === 0
                  ? "No workouts shared yet."
                  : "Nothing recent."}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {feed.map((item) => (
                <PostCard key={item.postId} item={item} unit={me.unit} />
              ))}
            </div>
          )}
        </div>

        <Link href="/discover">
          <Card className="press flex items-center gap-3 px-4 py-3.5">
            <p className="flex-1 text-[15px] font-medium">Find more people</p>
            <ChevronRight className="text-text-3 size-4 shrink-0" />
          </Card>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <p className="num-prop text-[19px] leading-none font-bold">{value}</p>
      <p className="text-text-3 mt-1 truncate text-[11px]">{label}</p>
    </div>
  );
}
