import { NavBar } from "@/components/ui/nav-bar";
import { SectionTitle } from "@/components/ui/primitives";
import { NotificationList } from "@/components/notifications/notification-list";
import { PushSettings } from "@/components/notifications/push-settings";
import { WorkoutAlertSettings } from "@/components/notifications/workout-alert-settings";
import { requireUser } from "@/lib/session";
import { isPushConfigured } from "@/lib/actions/push";
import { getNotifications } from "@/lib/actions/notify";

export default async function NotificationsPage() {
  const me = await requireUser();
  const [configured, items] = await Promise.all([
    isPushConfigured(),
    getNotifications(me.id),
  ]);

  return (
    <div className="pb-8">
      <NavBar title="Notifications" back="/profile" />

      <div className="space-y-6 px-4">
        {/* The inbox is the source of truth — push is best-effort, and iOS
            drops subscriptions, so this has to stand on its own. */}
        <NotificationList items={items} />

        {/* First, and not gated on `configured`: these are posted locally by
            the service worker, so they need permission and nothing else. */}
        <div>
          <SectionTitle>While you train</SectionTitle>
          <WorkoutAlertSettings />
        </div>

        <div>
          <SectionTitle>Push</SectionTitle>
          <PushSettings
            configured={configured}
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
