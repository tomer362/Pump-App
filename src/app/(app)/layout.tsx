import { Suspense } from "react";
import { TabBar, TabBarSpacer } from "@/components/ui/tab-bar";
import { ActiveWorkoutPill } from "@/components/workout/active-workout-pill";
import { ClearStaleWorkoutActivity } from "@/components/workout/clear-stale-workout-activity";
import { RouteProgress } from "@/components/ui/route-progress";
import { NotifyNudge } from "@/components/notifications/notify-nudge";
import { InstallNudge } from "@/components/install/install-nudge";
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
      {/* Mounted before the notification nudge deliberately: both open
          themselves off a timer, both claim the same one-modal-per-visit slot,
          and effects run in tree order — so installing wins the tie. That is
          the right precedence, because on iOS being installed is what makes
          the notifications the other sheet asks about possible at all. */}
      <InstallNudge />
      <NotifyNudge vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
      <div className="mx-auto w-full max-w-lg flex-1">{children}</div>
      {/* The tab bar is fixed-position chrome, so rendering it first without
          the unread dot and swapping it in place is invisible — while the page
          itself no longer waits on either query. */}
      {/* The spacer moved in with the chrome, because only the chrome knows
          whether the pill is up — and the spacer has to be as tall as whatever
          is docked, or the foot of the list is unreachable. It stays after the
          content in this column either way, so growing it adds scroll at the
          bottom and shifts nothing above. */}
      <Suspense
        fallback={
          <>
            <TabBarSpacer />
            <TabBar />
          </>
        }
      >
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
      <TabBarSpacer withPill={active != null} />
      {/* Docked above the tab bar so an in-progress workout is never lost by
          navigating away — the single biggest complaint about web trackers. */}
      {active ? (
        <ActiveWorkoutPill workout={active} />
      ) : (
        <ClearStaleWorkoutActivity />
      )}
      <TabBar unreadCount={unread} />
    </>
  );
}
