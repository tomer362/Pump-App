import { TabBar, TabBarSpacer } from "@/components/ui/tab-bar";
import { ActiveWorkoutPill } from "@/components/workout/active-workout-pill";
import { requireUser } from "@/lib/session";
import { getActiveWorkoutSummary } from "@/lib/queries/workout";
import { getUnreadNotificationCount } from "@/lib/actions/notify";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireUser();
  const [active, unread] = await Promise.all([
    getActiveWorkoutSummary(me.id),
    getUnreadNotificationCount(me.id),
  ]);

  return (
    <div className="min-h-screen-d">
      <div className="mx-auto max-w-lg">{children}</div>
      {/* Docked above the tab bar so an in-progress workout is never lost by
          navigating away — the single biggest complaint about web trackers. */}
      {active && <ActiveWorkoutPill workout={active} />}
      <TabBarSpacer />
      <TabBar unreadCount={unread} />
    </div>
  );
}
