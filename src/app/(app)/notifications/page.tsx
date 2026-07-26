import { NavBar } from "@/components/ui/nav-bar";
import { PushSettings } from "@/components/notifications/push-settings";
import { requireUser } from "@/lib/session";
import { isPushConfigured } from "@/lib/actions/push";

export default async function NotificationsPage() {
  await requireUser();
  const configured = await isPushConfigured();

  return (
    <div className="pb-8">
      <NavBar title="Notifications" back="/profile" />
      <div className="px-4">
        <PushSettings
          configured={configured}
          vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
        />
      </div>
    </div>
  );
}
