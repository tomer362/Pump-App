"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Info, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/lib/actions/push";

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

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const res = await savePushSubscription({
        endpoint: json.endpoint,
        keys: json.keys,
      });
      if (!res.ok) throw new Error(res.error);
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
              Friends arriving at the gym, records and comments.
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

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports as a Mac, distinguished only by touch support.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** VAPID keys are base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
