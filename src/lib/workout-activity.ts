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
 * The delayed part is armed in two places, because neither one is enough. A
 * backgrounded tab has its timers clamped and an installed iOS PWA is frozen
 * outright, so a `setTimeout` on this side cannot be trusted for a phone in a
 * pocket — that is the worker's job (`public/sw.js`). But the browser stops
 * that worker whenever it likes, and in the most common desktop case, a window
 * behind another application, the page is not throttled at all and is the more
 * reliable of the two. So both are armed, they share a notification tag, and
 * whichever arrives first stands the other down.
 *
 * What neither reaches is a locked iPhone: iOS suspends the page and the worker
 * together. The only local thing that survives that is the chime holding an
 * audio session (`lib/rest-audio.ts`), which is off by default because it stops
 * the lifter's music — so the app must not claim otherwise.
 */

import { cancelRestChime } from "./rest-audio";

type Message =
  | { type: "workout-rest"; endsAt: number; body: string; url: string }
  | { type: "workout-rest-cancel" }
  | {
      type: "workout-show";
      title: string;
      body: string;
      url: string;
      /** The running rest, so the worker can re-arm at the last safe moment. */
      restEndsAt: number | null;
      restBody: string;
      /** Whether to actually post the quiet line, which has its own mute. */
      progress: boolean;
    }
  | { type: "workout-hide" }
  | { type: "workout-end" }
  | { type: "workout-test" }
  | { type: "workout-test-delayed"; delayMs: number };

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

/**
 * The quiet progress line, separately from the rest-over alert.
 *
 * These are two different things to want. The alert is the point of the whole
 * feature — it is what tells you the rest is up while the phone is in a pocket.
 * The progress line is a convenience, and it is the one that appears every time
 * you leave the app, so it is the one somebody trying to quieten their lock
 * screen actually means. Muting the pair (`PREF_KEY`) would take the alert with
 * it, so this is its own switch and defaults on.
 */
const PROGRESS_KEY = "pump.workout-progress";

export function workoutProgressMuted() {
  try {
    return window.localStorage.getItem(PROGRESS_KEY) === "off";
  } catch {
    return false;
  }
}

export function setWorkoutProgressMuted(muted: boolean) {
  try {
    if (muted) window.localStorage.setItem(PROGRESS_KEY, "off");
    else window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* Same. */
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

/**
 * One tag for everything a live workout shows. Must match `WORKOUT_TAG` in
 * `public/sw.js` — the page and the worker both post the rest alert, and the
 * shared tag is what makes the second one replace the first rather than stack.
 */
const WORKOUT_TAG = "pump-workout";

/** Longest rest we'll arm for; past this it's a stale call. */
const MAX_ARM_MS = 30 * 60 * 1000;

/**
 * How late this side will still speak. A backgrounded tab has its timers
 * clamped to about once a minute, so firing late is the normal case here and
 * the whole reason the channel is worth having — but past a point "Rest over"
 * is not a late alert, it is wrong about when to lift. The worker applies the
 * same bound to a restored alarm.
 */
const LATE_GRACE_MS = 90 * 1000;

/* ---------------------------------------------------------------------------
 * The second channel: the same alert, posted by the page.
 *
 * The worker's timer is the one that survives a frozen page, and it is the only
 * channel on a locked phone — but it is also the one the browser is free to
 * throw away, and there is one case where the page is strictly the more
 * reliable of the two. A window sitting behind another application is not
 * throttled at all: its timers run to the millisecond while the worker may
 * already have been stopped. That is also the single most common way to have
 * Pump "in the background" on a desktop.
 *
 * So both are armed and whichever gets there first wins. On an installed iPhone
 * this one runs only when the chime is holding the audio session
 * (`pump.rest-sound-hold`), which is what keeps the page alive — otherwise the
 * page is frozen and this is a no-op, which is the honest answer there.
 * ------------------------------------------------------------------------- */

let pageTimer: number | null = null;
/** The `endsAt` this side has already announced, so it can't say it twice. */
let pageFiredFor: number | null = null;

function clearPageAlarm() {
  if (pageTimer == null) return;
  window.clearTimeout(pageTimer);
  pageTimer = null;
}

async function firePageAlarm(input: { endsAt: number; body: string; url: string }) {
  pageTimer = null;
  if (pageFiredFor === input.endsAt || !canShow()) return;
  if (Date.now() - input.endsAt > LATE_GRACE_MS) return;
  // On screen and in front — the volt bar and the chime have already said it,
  // and a banner over the top of the set table is noise. Same question the
  // worker asks in `appIsOnScreen`, and for the same reason it asks both
  // halves of it: a visible tab behind another window is not somebody looking.
  if (document.visibilityState === "visible" && document.hasFocus()) return;
  pageFiredFor = input.endsAt;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;

    // The worker arms this same alert, and whichever of the two gets here
    // first wins. A cancel message can't settle that — both timers are set for
    // the same instant, so neither can stand the other down in advance, and
    // this side is the one whose timer a backgrounded tab may have clamped to
    // once a minute. The notification already on screen is the only fact both
    // channels can see, so `endsAt` rides along in its data and is the answer.
    const showing = await reg.getNotifications({ tag: WORKOUT_TAG });
    if (showing.some((n) => n.data?.endsAt === input.endsAt)) return;

    // Replace by closing, not by hoping the tag does it — the same thing
    // `sw.js` has to do, for the same platform reasons.
    for (const n of showing) n.close();
    await reg.showNotification("Rest over", {
      body: input.body || "Back to it.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: input.url, endsAt: input.endsAt },
      tag: WORKOUT_TAG,
      // @ts-expect-error `renotify` is real and is the whole point of this
      // notification; lib.dom's NotificationOptions omits it.
      renotify: true,
      vibrate: [180, 90, 180],
    });
    // Now the worker's copy can stand down — after the banner is up, not
    // before, so a failure on this side leaves the other channel intact.
    void post({ type: "workout-rest-cancel" });
  } catch {
    /* The worker is the other channel. Never let this break the workout. */
  }
}

/** Arm the rest-over alert. `body` is the set the lifter owes next. */
export function scheduleRestAlarm(input: {
  endsAt: number;
  body: string;
  url: string;
}) {
  void post({ type: "workout-rest", ...input });

  clearPageAlarm();
  if (typeof window === "undefined") return;
  const delay = input.endsAt - Date.now();
  if (!(delay > 0) || delay > MAX_ARM_MS) return;
  pageTimer = window.setTimeout(() => void firePageAlarm(input), delay);
}

export function cancelRestAlarm() {
  clearPageAlarm();
  void post({ type: "workout-rest-cancel" });
}

/**
 * Pump has gone to the background with a workout running.
 *
 * Carries the running rest as well as the totals. This is the last instant the
 * worker is certainly awake and certainly holding this page's numbers, so it is
 * the best moment there is to re-arm the alert — both to hand it a fresh
 * lifetime budget for exactly the window it has to survive, and to repair the
 * case where the worker was stopped and restarted since the rest began.
 *
 * The progress line can be muted on its own; the re-arm must not be, so the
 * message goes out either way and only the notification is suppressed.
 */
export function showWorkoutProgress(input: {
  title: string;
  body: string;
  url: string;
  restEndsAt: number | null;
  restBody: string;
}) {
  void post({ type: "workout-show", ...input, progress: !workoutProgressMuted() });
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
  clearPageAlarm();
  void post({ type: "workout-end" });
  // The scheduled chime is the fourth thing a finished session leaves running,
  // and unlike the other three it would make a noise. It lives here rather than
  // at the call sites so "the workout is over" stays one call.
  cancelRestChime();
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

/**
 * The test that asks the only question that matters: does a *delayed* alert
 * survive this device putting the app away?
 *
 * The immediate one above proves the permission is granted and proves nothing
 * about the worker being suspended, which is the actual failure — and on an
 * installed iPhone the two give opposite answers. This goes through the same
 * arming path, timer and visibility gate as a real rest, so locking the phone
 * and waiting is a true answer for this device.
 */
export function sendDelayedTestAlert(delayMs = 15000) {
  void post({ type: "workout-test-delayed", delayMs });
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
