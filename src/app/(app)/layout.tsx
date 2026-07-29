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
    // `min-h-full`, not another `min-h-screen-d`: the root shell is already a
    // viewport tall, and stacking a second one under the tab-bar spacer made
    // every page — however short — scroll into a blank void.
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-lg flex-1">{children}</div>
      {/* Docked above the tab bar so an in-progress workout is never lost by
          navigating away — the single biggest complaint about web trackers. */}
      {active && <ActiveWorkoutPill workout={active} />}
      <TabBarSpacer />
      <TabBar unreadCount={unread} />
    </div>
  );
}
