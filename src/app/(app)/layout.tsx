import { Suspense } from "react";
import { TabBar, TabBarSpacer } from "@/components/ui/tab-bar";
import { ActiveWorkoutPill } from "@/components/workout/active-workout-pill";
import { RouteProgress } from "@/components/ui/route-progress";
import { NotifyNudge } from "@/components/notifications/notify-nudge";
import { requireUser } from "@/lib/session";
import { getActiveWorkoutSummary } from "@/lib/queries/workout";
import { getUnreadNotificationCount } from "@/lib/actions/notify";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only the auth check blocks: it decides the redirect, and every page below
  // needs the user anyway (it's React-cached, so the page's own call is free).
  // The chrome's two queries used to sit here too, which meant three serial
  // round trips in front of *every* navigation in the group before a single
  // byte of the page could be sent.
  const me = await requireUser();

  return (
    // `min-h-full`, not another `min-h-screen-d`: the root shell is already a
    // viewport tall, and stacking a second one under the tab-bar spacer made
    // every page — however short — scroll into a blank void.
    <div className="flex min-h-full flex-col">
      <RouteProgress />
      {/* Renders nothing until it has decided to ask, which it does off a timer
          after mount — so it never blocks or shifts the page under it. Mounted
          here rather than in the root layout because the active workout screen
          sits outside this group and does its own, better-timed asking. */}
      <NotifyNudge vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      <div className="mx-auto w-full max-w-lg flex-1">{children}</div>
      <TabBarSpacer />
      {/* The tab bar is fixed-position chrome, so rendering it first without
          the unread dot and swapping it in place is invisible — while the page
          itself no longer waits on either query. */}
      <Suspense fallback={<TabBar />}>
        <AppChrome userId={me.id} />
      </Suspense>
    </div>
  );
}

async function AppChrome({ userId }: { userId: string }) {
  const [active, unread] = await Promise.all([
    getActiveWorkoutSummary(userId),
    getUnreadNotificationCount(userId),
  ]);

  return (
    <>
      {/* Docked above the tab bar so an in-progress workout is never lost by
          navigating away — the single biggest complaint about web trackers. */}
      {active && <ActiveWorkoutPill workout={active} />}
      <TabBar unreadCount={unread} />
    </>
  );
}
