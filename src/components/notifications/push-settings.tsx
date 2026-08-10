"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Info, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { removePushSubscription } from "@/lib/actions/push";
import { isIOS, isStandalone, subscribeToPush } from "@/lib/notify-client";

type State = "unsupported" | "needs-install" | "denied" | "off" | "on";

/**
 * Web push opt-in.
 *
 * iOS only exposes PushManager to home-screen-installed PWAs, so the common
 * failure is a user tapping "enable" in Safari and nothing happening. This
 * detects that case up front and explains the install step instead.
 */
export function PushSettings({
  configured,
  vapidPublicKey,
}: {
  configured: boolean;
  vapidPublicKey: string;
}) {
  const [state, setState] = useState<State>("off");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // On iOS this is exactly what a non-installed PWA looks like.
        setState(isIOS() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;

      await subscribeToPush(reg, vapidPublicKey);
      setState("on");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't enable notifications",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <Card className="flex gap-3 px-4 py-4">
        <Info className="text-text-3 size-5 shrink-0" />
        <p className="text-text-2 text-[14px] leading-relaxed">
          Push isn&apos;t configured on this deployment. Add a VAPID key pair to
          the environment to turn it on — until then the in-app feed carries
          everything.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="bg-surface-2 grid size-10 shrink-0 place-items-center rounded-full">
            {state === "on" ? (
              <Bell className="text-volt size-5" strokeWidth={2.2} />
            ) : (
              <BellOff className="text-text-3 size-5" strokeWidth={2.2} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {state === "on" ? "Notifications on" : "Notifications off"}
            </p>
            <p className="text-text-3 text-[13px]">
              When your rest is up, plus friends arriving at the gym, records
              and comments.
            </p>
          </div>
        </div>

        {state === "needs-install" ? (
          <div className="border-hairline mt-4 rounded-[12px] border px-3 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-[14px] font-semibold">
              <Smartphone className="size-4" />
              Add Pump to your Home Screen first
            </p>
            <p className="text-text-3 text-[13px] leading-relaxed">
              On iPhone, notifications only work for installed web apps. Tap
              Share, then <span className="text-text-2">Add to Home Screen</span>
              , open Pump from the icon, and come back here.
            </p>
          </div>
        ) : state === "unsupported" ? (
          <p className="text-text-3 mt-4 text-[13px] leading-relaxed">
            This browser doesn&apos;t support web push. Everything still appears
            in your feed.
          </p>
        ) : state === "denied" ? (
          <p className="text-text-3 mt-4 text-[13px] leading-relaxed">
            Notifications are blocked for this site. Re-enable them in your
            browser settings, then come back.
          </p>
        ) : (
          <Button
            block
            className="mt-4"
            variant={state === "on" ? "solid" : "volt"}
            loading={busy}
            onClick={state === "on" ? disable : enable}
          >
            {state === "on" ? "Turn off" : "Turn on notifications"}
          </Button>
        )}

        {error && <p className="text-danger mt-2 text-[13px]">{error}</p>}
      </Card>

      <p className="text-text-3 px-1 text-[12px] leading-relaxed">
        Push delivery is best-effort — iOS in particular drops subscriptions
        after long periods of inactivity. Nothing in Pump depends on it; the
        feed is always the source of truth.
      </p>
    </div>
  );
}
