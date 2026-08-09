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
  | { type: "workout-end" };

function granted() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  );
}

async function post(message: Message) {
  if (!granted()) return;
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
