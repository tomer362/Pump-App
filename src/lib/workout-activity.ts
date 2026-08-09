/**
 * The running workout as something the phone shows while Pump is not on screen:
 * a quiet notification carrying the session totals, an alert when the rest
 * timer runs out, and the set count on the app icon.
 *
 * All three are enhancements over the in-app screen, never a dependency of it —
 * the same rule the rest of push lives by. Every function here is a no-op when
 * notifications were never granted, when there is no service worker, or when
 * the browser has no Badging API, and none of them ever throws: a lifter mid-set
 * must not see an error because a notification failed to render.
 *
 * The delayed part deliberately lives in the worker rather than here. A
 * backgrounded tab has its timers clamped, and an installed iOS PWA is
 * suspended outright — so a `setTimeout` on this side is guaranteed to be late
 * for exactly the case that matters. See the `message` handler in
 * `public/sw.js`.
 */

type Message =
  | { type: "workout-rest"; endsAt: number; body: string; url: string }
  | { type: "workout-rest-cancel" }
  | { type: "workout-show"; title: string; body: string; url: string }
  | { type: "workout-hide" }
  | { type: "workout-end" }
  | { type: "workout-test" };

/**
 * Whether this browser could ever show a workout alert. Note what this does
 * *not* require: a push subscription, a VAPID key pair, or a server. These
 * notifications are posted locally by the service worker, so they work on a
 * deployment with no push configuration at all — which is why the opt-in can't
 * live behind `PushSettings`, whose whole card disappears without VAPID keys.
 */
export function workoutAlertsSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof Notification !== "undefined"
  );
}

/**
 * Turning alerts off without revoking the browser permission — which a page
 * cannot do anyway, so a control that claimed to would be lying.
 */
const PREF_KEY = "pump.workout-alerts";

export function workoutAlertsMuted() {
  try {
    return window.localStorage.getItem(PREF_KEY) === "off";
  } catch {
    return false;
  }
}

export function setWorkoutAlertsMuted(muted: boolean) {
  try {
    if (muted) window.localStorage.setItem(PREF_KEY, "off");
    else window.localStorage.removeItem(PREF_KEY);
  } catch {
    /* Private mode; the session still behaves as opted in. */
  }
}

function canShow() {
  return (
    workoutAlertsSupported() &&
    Notification.permission === "granted" &&
    !workoutAlertsMuted()
  );
}

async function post(message: Message) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // Clearing is always allowed. A notification already on screen has to be
  // dismissible even after the permission or the preference was withdrawn,
  // otherwise turning alerts off leaves the last one stuck there.
  const clearing =
    message.type === "workout-hide" ||
    message.type === "workout-end" ||
    message.type === "workout-rest-cancel";
  if (!clearing && !canShow()) return;
  try {
    // `controller` is the worker already controlling this page — `sw.js` calls
    // `clients.claim()` on activate, so it is there on every load after the
    // first. `ready` covers that first load, where this can run before
    // `ServiceWorkerRegistrar` has finished registering: it resolves only once
    // there is an active worker, and every one of these calls is
    // fire-and-forget, so waiting costs the caller nothing.
    const worker =
      navigator.serviceWorker.controller ??
      (await navigator.serviceWorker.ready).active;
    worker?.postMessage(message);
  } catch {
    /* Notifications are a bonus channel. Never let one break the workout. */
  }
}

/** Arm the rest-over alert. `body` is the set the lifter owes next. */
export function scheduleRestAlarm(input: {
  endsAt: number;
  body: string;
  url: string;
}) {
  void post({ type: "workout-rest", ...input });
}

export function cancelRestAlarm() {
  void post({ type: "workout-rest-cancel" });
}

/** Pump has gone to the background with a workout running. */
export function showWorkoutProgress(input: {
  title: string;
  body: string;
  url: string;
}) {
  void post({ type: "workout-show", ...input });
}

/** Pump is back on screen — the screen itself is the better readout. */
export function hideWorkoutProgress() {
  void post({ type: "workout-hide" });
}

/**
 * The session is over: drop the notification, the armed alarm and the badge.
 * Called from the finish and discard paths, which are the only two places that
 * know a workout has stopped being live.
 */
export function endWorkoutActivity() {
  void post({ type: "workout-end" });
  setWorkoutBadge(0);
}

/**
 * Prove it works, on the device, now. There is no way to verify any of this from
 * a development machine — it needs a real phone with the app installed — so the
 * settings screen offers a notification you can go and look at.
 */
export function sendTestWorkoutAlert() {
  void post({ type: "workout-test" });
}

type Badging = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Sets still owed, on the installed app icon. Unlike the notifications this
 * needs no permission of its own, so it is the one signal that works for
 * someone who declined push but installed the app.
 */
export function setWorkoutBadge(count: number) {
  if (typeof navigator === "undefined") return;
  // Muted means muted — the icon is one of the three signals, not a separate
  // feature. Permission it does *not* need, which is the point of it.
  if (count > 0 && workoutAlertsMuted()) return;
  const nav = navigator as Badging;
  try {
    const done =
      count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
    // Safari rejects when the app isn't installed; that is not an error worth
    // surfacing, it just means there is no icon to badge.
    void done?.catch(() => {});
  } catch {
    /* Same. */
  }
}
