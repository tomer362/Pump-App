import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Settings,
  UserPlus,
  Bell,
} from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Avatar, Card, SectionTitle } from "@/components/ui/primitives";
import { AchievementGrid } from "@/components/profile/achievement-grid";
import { SignOutButton } from "@/components/profile/sign-out-button";
import { requireUser } from "@/lib/session";
import { getAchievements, getLifetimeStats } from "@/lib/queries/stats";
import { getFollowCounts, getFriends } from "@/lib/queries/social";
import { getWorkoutHistory } from "@/lib/queries/workout";
import { getUnreadNotificationCount } from "@/lib/actions/notify";
import { formatDayLabel, formatVolume } from "@/lib/utils";

export default async function ProfilePage() {
  const me = await requireUser();

  const [stats, achievements, counts, friends, recent, unread] =
    await Promise.all([
      getLifetimeStats(me.id),
      getAchievements(me.id),
      getFollowCounts(me.id),
      getFriends(me.id),
      getWorkoutHistory(me.id, { limit: 5 }),
      getUnreadNotificationCount(me.id),
    ]);

  return (
    <div className="pb-8">
      <NavBar
        title="You"
        right={
          <Link
            href="/settings"
            aria-label="Settings"
            className="press tap text-text-2 grid place-items-center px-2"
          >
            <Settings className="size-[22px]" strokeWidth={2.2} />
          </Link>
        }
      />

      <div className="space-y-6 px-4">
        <div className="flex items-center gap-4">
          <Avatar src={me.image} name={me.name} size="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[20px] leading-tight font-bold">
              {me.name}
            </h2>
            {me.username && (
              <p className="text-text-3 truncate text-[14px]">@{me.username}</p>
            )}
            {me.bio && (
              <p className="text-text-2 mt-1 text-[13px] leading-snug">
                {me.bio}
              </p>
            )}
          </div>
        </div>

        <div className="border-hairline grid grid-cols-4 gap-2 rounded-card border px-2 py-3">
          <Stat label="Workouts" value={stats.workouts} />
          <Stat
            label={me.unit}
            value={formatVolume(stats.totalVolumeKg, me.unit)}
          />
          <Link href="/friends" className="press">
            <Stat label="Followers" value={counts.followers} />
          </Link>
          <Link href="/friends" className="press">
            <Stat label="Following" value={counts.following} />
          </Link>
        </div>

        <div className="space-y-2">
          <Link href="/friends">
            <Card className="press flex items-center gap-3 px-4 py-3.5">
              <UserPlus className="text-text-3 size-5 shrink-0" />
              <p className="flex-1 text-[15px] font-medium">Friends</p>
              <span className="num text-text-3 text-[14px]">
                {friends.length}
              </span>
              <ChevronRight className="text-text-3 size-4 shrink-0" />
            </Card>
          </Link>
          <Link href="/gyms">
            <Card className="press flex items-center gap-3 px-4 py-3.5">
              <Building2 className="text-text-3 size-5 shrink-0" />
              <p className="flex-1 text-[15px] font-medium">Gyms</p>
              <ChevronRight className="text-text-3 size-4 shrink-0" />
            </Card>
          </Link>
          <Link href="/notifications">
            <Card className="press flex items-center gap-3 px-4 py-3.5">
              <Bell className="text-text-3 size-5 shrink-0" />
              <p className="flex-1 text-[15px] font-medium">Notifications</p>
              {unread > 0 && (
                <span className="bg-volt num grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold text-black">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
              <ChevronRight className="text-text-3 size-4 shrink-0" />
            </Card>
          </Link>
        </div>

        <div>
          <SectionTitle>Achievements</SectionTitle>
          <AchievementGrid achievements={achievements} />
        </div>

        {recent.length > 0 && (
          <div>
            <SectionTitle
              action={
                <Link
                  href="/history"
                  className="text-volt text-[13px] font-semibold"
                >
                  All
                </Link>
              }
            >
              Recent workouts
            </SectionTitle>
            <Card className="divide-hairline divide-y">
              {recent.map((w) => (
                <Link
                  key={w.id}
                  href={`/history/${w.id}`}
                  className="press flex items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{w.name}</p>
                    <p className="text-text-3 text-[12px]">
                      {formatDayLabel(new Date(w.startedAt))}
                    </p>
                  </div>
                  <p className="num text-text-2 shrink-0 text-[13px]">
                    {formatVolume(w.totalVolumeKg, me.unit)} {me.unit}
                  </p>
                  <ChevronRight className="text-text-3 size-4 shrink-0" />
                </Link>
              ))}
            </Card>
          </div>
        )}

        <SignOutButton />
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
