/**
 * The browser side of "turn notifications on", in one place.
 *
 * Three surfaces now ask for the same permission — the settings card, the
 * rest-alert line on the workout screen, and the periodic nudge — and each had
 * grown its own copy of the sequence. The order matters and is easy to get
 * subtly wrong: a grant with no service worker registration reports "on" and
 * then posts nothing, which is the failure mode the settings screen exists to
 * make visible in the first place.
 */

import { savePushSubscription } from "@/lib/actions/push";
import { setWorkoutAlertsMuted, workoutAlertsSupported } from "@/lib/workout-activity";

export function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports as a Mac, distinguished only by touch support.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** VAPID keys are base64url; PushManager wants raw bytes. */
export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Subscribe this device to web push and register the endpoint server-side.
 * Reuses an existing subscription rather than minting a second one for the same
 * worker, which is what `subscribe()` would otherwise reject on.
 */
export async function subscribeToPush(
  reg: ServiceWorkerRegistration,
  vapidPublicKey: string,
) {
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const json = sub.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  const res = await savePushSubscription({
    endpoint: json.endpoint,
    keys: json.keys,
  });
  if (!res.ok) throw new Error(res.error);
  return sub;
}

/**
 * When the app last asked for the permission, in any of its own words — the
 * modal nudge or the line on the workout screen. Shared deliberately: they ask
 * the identical question, so dismissing one must quiet the other, or answering
 * the banner mid-workout earns you a sheet on the feed a minute later.
 */
const ASKED_KEY = "pump.notify-nudge";

export function markNotifyAsked() {
  try {
    window.localStorage.setItem(ASKED_KEY, String(Date.now()));
  } catch {
    /* Private mode: it comes back next session. */
  }
}

export function notifyAskedWithin(ms: number) {
  try {
    const last = Number(window.localStorage.getItem(ASKED_KEY));
    return Boolean(last) && Date.now() - last < ms;
  } catch {
    // Private mode: treat it as unasked. The worst case is one extra prompt.
    return false;
  }
}

/**
 * Fired once the permission is granted and a worker exists to post through.
 *
 * The same shape as `pump:installable` in `install-client.ts`, and for the same
 * reason: the thing that needs to react — a rest already counting down on the
 * workout screen — is nowhere near the button that was tapped, and its own
 * inputs (the rest's `endsAt`) haven't changed, so nothing else would tell it.
 */
export const ALERTS_ENABLED_EVENT = "pump:notifications-enabled";

export function announceAlertsEnabled() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ALERTS_ENABLED_EVENT));
}

export type EnableResult =
  /** Permission granted and a worker is registered. `pushed` is web push. */
  | { ok: true; pushed: boolean }
  | { ok: false; permission: NotificationPermission; error?: string };

/**
 * The whole opt-in: permission, then a worker to post through, then the local
 * mute preference cleared, then — only if this deployment has VAPID keys — a
 * push subscription for the social notifications.
 *
 * Push is deliberately the last step and deliberately non-fatal. By the time it
 * runs, rest alerts, the lock-screen progress line and the icon badge are all
 * already working; failing the whole call because a push endpoint refused would
 * tell the user "off" about three features that are on.
 */
export async function enableNotifications(
  vapidPublicKey?: string,
): Promise<EnableResult> {
  if (!workoutAlertsSupported()) {
    return { ok: false, permission: "denied", error: "Not supported here" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, permission };

  try {
    // The worker is what actually posts these, so make sure one exists before
    // claiming the feature is on.
    const reg =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    setWorkoutAlertsMuted(false);
    // From here the local alerts are live, so anything mid-flight that was
    // refused an arm while the permission was still `default` can have one.
    announceAlertsEnabled();

    if (!vapidPublicKey || !("PushManager" in window)) {
      return { ok: true, pushed: false };
    }
    try {
      await subscribeToPush(reg, vapidPublicKey);
      return { ok: true, pushed: true };
    } catch {
      return { ok: true, pushed: false };
    }
  } catch (err) {
    return {
      ok: false,
      permission,
      error: err instanceof Error ? err.message : "Couldn't turn alerts on",
    };
  }
}
