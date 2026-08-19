/* Pump service worker.
 *
 * Deliberately minimal: no route caching. A workout tracker's value is in the
 * live data, and a stale cached shell showing yesterday's sets is worse than a
 * spinner. The worker exists so the app is installable, can receive push, and
 * can carry a running workout outside the browser (see the `message` handler).
 */

/**
 * One tag for everything a live workout shows, so the quiet progress line and
 * the rest-over alert replace each other instead of stacking two notifications
 * about the same session.
 */
const WORKOUT_TAG = "pump-workout";

/** The settings screen's try-it-out alerts, which must never clobber a session. */
const TEST_TAG = "pump-test";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  // A new worker generation replaces one that may have been counting a rest.
  event.waitUntil(restoreRestAlarm());
});

self.addEventListener("push", (event) => {
  // Any event at all is a chance to notice a rest this worker was stopped in
  // the middle of. A social push is as good a wake-up as any.
  event.waitUntil(restoreRestAlarm());

  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Pump", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Pump", {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url ?? "/feed" },
      // Collapse repeats so a burst of gym check-ins doesn't stack up.
      tag: payload.tag ?? "pump",
      renotify: false,
    }),
  );
});

/* ---------------------------------------------------------------------------
 * The live workout, outside the browser.
 *
 * The page can't do this itself. A backgrounded tab has its timers clamped to
 * about once a minute, and an installed iOS PWA is suspended outright the
 * moment it leaves the screen — so the one thing that must happen while nobody
 * is looking, the rest-over alert, has to be armed somewhere else. There is no
 * server-side option either: Hobby cron is twice a day and a function can't
 * sleep for two minutes, so a scheduled push is off the table (CLAUDE.md,
 * "Platform constraints").
 *
 * That leaves a timer in here, held open by `waitUntil` — and a worker is not a
 * process we own. The browser starts and stops it whenever it likes, and a
 * `setTimeout` inside one dies with it in silence. So the alarm is written down
 * as well as armed, and every event that can wake this worker asks whether
 * there is a rest it was supposed to be counting (`restoreRestAlarm`).
 *
 * It is still honestly best-effort, and on one platform it is worse than that:
 * iOS suspends this worker along with the app, so nothing here runs while an
 * installed Pump is off screen and the recovery below can only ever be late.
 * The in-app chime and the volt bar stay the primary signal, and the chime with
 * `pump.rest-sound-hold` on is the only local thing that reaches a locked
 * iPhone at the right moment (`lib/rest-audio.ts`).
 * ------------------------------------------------------------------------- */

/**
 * The one thing this worker stores.
 *
 * `caches` is used here as a key/value cell, never as a route cache — the "no
 * route caching" rule at the top of this file still holds, and nothing in here
 * answers a `fetch`. It is Cache Storage rather than IndexedDB only because a
 * single cell in IDB is forty lines of request plumbing and this is four.
 */
const STATE_CACHE = "pump-workout-state";
const ALARM_KEY = "/__pump/rest-alarm";

async function saveAlarm(alarm) {
  try {
    const cache = await caches.open(STATE_CACHE);
    if (!alarm) return await cache.delete(ALARM_KEY);
    await cache.put(ALARM_KEY, new Response(JSON.stringify(alarm)));
  } catch {
    /* Storage refused — private mode, quota, a browser that gives a worker no
       cache at all. The in-memory alarm below still covers the common case of
       a worker that simply stays alive for the length of the rest. */
  }
}

async function loadAlarm() {
  try {
    const cache = await caches.open(STATE_CACHE);
    const res = await cache.match(ALARM_KEY);
    return res ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Pending alarms by tag: `{ timeout, done }`, at most one per tag. */
const alarms = new Map();

/** A rest is minutes. Past this a message is stale and arming it pins the
 *  worker open for nothing. */
const MAX_ARM_MS = 30 * 60 * 1000;

/**
 * How late a restored alert is still worth showing.
 *
 * When this worker is restarted the rest may already be over, and the whole
 * point of writing the alarm down is to say so anyway. But there is a limit:
 * "Rest over" arriving four minutes late is not a late alert, it is wrong about
 * when to lift, and the lifter is better served by silence.
 */
const LATE_GRACE_MS = 90 * 1000;

function clearAlarm(tag) {
  const pending = alarms.get(tag);
  if (!pending) return;
  clearTimeout(pending.timeout);
  // Release the `waitUntil` promise, or the worker is kept alive for a rest
  // that has already been skipped.
  pending.done();
  alarms.delete(tag);
}

/**
 * Arm an alert: in memory, and — for a real session — on disk.
 *
 * The `waitUntil` promise this returns is what keeps *this* worker alive across
 * the delay. The stored copy is what lets a *different* worker finish the job
 * when this one is stopped anyway, which is the common case and the reason the
 * two are separate.
 */
function armAlarm(alarm) {
  const tag = alarm.tag || WORKOUT_TAG;
  // The settings screen's delayed test is not written down: it is fifteen
  // seconds long, and a stored copy would overwrite the alarm of a session
  // that happens to be resting while somebody tries the button.
  const persist = tag === WORKOUT_TAG;
  clearAlarm(tag);

  const delay = alarm.endsAt - Date.now();
  if (!(delay > 0) || delay > MAX_ARM_MS) {
    return persist ? saveAlarm(null) : Promise.resolve();
  }

  const ticking = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      alarms.delete(tag);
      fireAlarm(alarm).then(resolve, resolve);
    }, delay);
    alarms.set(tag, { timeout, done: resolve });
  });

  return persist ? Promise.all([saveAlarm(alarm), ticking]) : ticking;
}

/** Rest skipped, adjusted away, the set un-ticked, or the session over. */
function cancelRestAlarm() {
  clearAlarm(WORKOUT_TAG);
  return saveAlarm(null);
}

/**
 * Pick up an alarm left behind by a worker that was stopped mid-rest.
 *
 * Called from every event that can start this worker cold. Still pending →
 * re-arm it, with a fresh `waitUntil` budget. Just over → say so. Long over →
 * drop it, per `LATE_GRACE_MS`.
 */
function restoreRestAlarm() {
  // An alarm already ticking in this worker is the freshest copy there is.
  if (alarms.has(WORKOUT_TAG)) return Promise.resolve();
  return loadAlarm().then((alarm) => {
    if (!alarm || alarms.has(WORKOUT_TAG)) return;
    const late = Date.now() - alarm.endsAt;
    if (late < 0) return armAlarm(alarm);
    if (late < LATE_GRACE_MS) return fireAlarm(alarm);
    return saveAlarm(null);
  });
}

async function closeNotifications(tag = WORKOUT_TAG) {
  const open = await self.registration.getNotifications({ tag });
  for (const n of open) n.close();
}

/**
 * Whether a lifter is actually looking at Pump.
 *
 * `visibilityState` alone does not answer this. It tracks whether a tab is the
 * selected one, not whether its window is in front — so a browser sitting
 * behind another application still reports every tab in it as "visible", and
 * gating on that suppressed the alert for precisely the case the alert exists
 * for: the app in the background. `focused` is the other half.
 */
async function appIsOnScreen() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  return clients.some((c) => c.visibilityState === "visible" && c.focused);
}

/** The quiet one: what the session is at, replaced silently each time. */
async function showWorkoutProgress(msg) {
  // Close first, then show. `tag` is *supposed* to make this replacement
  // automatic, but iOS honours it inconsistently and ignores `renotify`
  // entirely — so leaving it to the tag is how a lock screen ended up with one
  // banner per time the app was backgrounded. Closing explicitly makes
  // "replace" true on every platform, at the cost of nothing: an identical
  // banner going away and coming back in the same tick is invisible.
  await closeNotifications();
  return self.registration.showNotification(msg.title || "Workout in progress", {
    body: msg.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: msg.url || "/feed" },
    tag: WORKOUT_TAG,
    // Progress, not an event. Nothing about backgrounding the app should buzz
    // a phone that is in a pocket between sets.
    renotify: false,
    silent: true,
  });
}

/** The loud one: rest is up, here's the set you owe. */
async function fireAlarm(alarm) {
  const tag = alarm.tag || WORKOUT_TAG;
  // Spent, whatever happens next — and cleared before the visibility check as
  // well as before the notification, so a rest the lifter watched run out in
  // the app can't be re-fired by the next worker that happens to start.
  if (tag === WORKOUT_TAG) await saveAlarm(null);
  // Pump is on screen and in front — the bar has already gone volt and the
  // chime has played. A banner over the top of that is noise.
  if (await appIsOnScreen()) return;
  // The page arms this same alert (`lib/workout-activity.ts`), and whichever
  // of the two gets here first wins. A cancel message can't settle that — both
  // timers are set for the same instant, so neither can stand the other down
  // in advance; the notification already on screen is the only shared fact
  // available to both, so `endsAt` rides along in its data and is the answer.
  const showing = await self.registration.getNotifications({ tag });
  if (showing.some((n) => n.data && n.data.endsAt === alarm.endsAt)) return;
  // Same reason as the progress line: replace by closing, not by hoping.
  await closeNotifications(tag);
  await self.registration.showNotification(alarm.title || "Rest over", {
    body: alarm.body || "Back to it.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: alarm.url || "/feed", endsAt: alarm.endsAt },
    tag,
    // The whole point of this one: it replaces the quiet progress line and has
    // to interrupt while doing it.
    renotify: true,
    vibrate: [180, 90, 180],
  });
}

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg.type !== "string") return;

  switch (msg.type) {
    case "workout-rest":
      event.waitUntil(
        armAlarm({ endsAt: msg.endsAt, body: msg.body, url: msg.url }),
      );
      return;

    // Rest skipped, adjusted away, or the set un-ticked.
    case "workout-rest-cancel":
      event.waitUntil(cancelRestAlarm());
      return;

    // The app went to the background with a workout running — the last moment
    // this worker is certainly running and certainly has the page's numbers. So
    // it re-arms rather than trusting the arm from when the rest started: a
    // fresh `waitUntil` budget, starting at exactly the window it has to
    // survive, and a repair for the case where the worker was restarted since.
    case "workout-show":
      if (msg.restEndsAt) {
        event.waitUntil(
          armAlarm({
            endsAt: msg.restEndsAt,
            body: msg.restBody,
            url: msg.url,
          }),
        );
      }
      // The quiet line has its own mute, and the re-arm above deliberately
      // isn't behind it: somebody silencing a progress banner has not asked to
      // lose the alert that is the point of the feature.
      if (msg.progress !== false) event.waitUntil(showWorkoutProgress(msg));
      return;

    // The app came back. Deliberately does *not* touch the alarm: opening Pump
    // mid-rest and putting it away again must not lose the alert. It is also
    // the one message that can arrive on a cold worker mid-rest, so it is where
    // a lost alarm gets picked back up.
    case "workout-hide":
      // Close first, then restore — one chain, not two racing ones. The order
      // matters: a restored alarm that has just come due would otherwise post a
      // banner that this same handler might or might not close again. Sequenced
      // this way the fire happens after, and `appIsOnScreen` suppresses it,
      // which is the right answer for an app that is back on screen. What the
      // restore is really here for is the re-arm.
      event.waitUntil(closeNotifications().then(restoreRestAlarm));
      return;

    // Finished or discarded. Now the alarm goes too.
    case "workout-end":
      event.waitUntil(cancelRestAlarm());
      event.waitUntil(closeNotifications());
      return;

    // "Send a test alert" from settings. Its own tag, so trying it out during a
    // live session can't clobber that session's notification — and deliberately
    // not gated on visibility, since the whole point is to see it appear.
    case "workout-test":
      event.waitUntil(
        self.registration.showNotification("Pump alerts are working", {
          body: "This is what you'll get when your rest is up.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          data: { url: "/feed" },
          tag: TEST_TAG,
          renotify: true,
          vibrate: [180, 90, 180],
        }),
      );
      return;

    // The one above proves the permission works and proves nothing about the
    // only question that matters here — whether a *delayed* alert survives the
    // app being put away. This goes through the same arming path, the same
    // timer and the same visibility gate as a real rest, so putting the phone
    // down and waiting is a true answer for this device.
    case "workout-test-delayed":
      event.waitUntil(
        armAlarm({
          endsAt: Date.now() + (msg.delayMs || 15000),
          title: "Background alerts work here",
          body: "That arrived while Pump was off screen, which is what a rest alert has to do.",
          url: "/notifications",
          tag: TEST_TAG,
        }),
      );
      return;
  }
});

self.addEventListener("notificationclick", (event) => {
  event.waitUntil(restoreRestAlarm());
  event.notification.close();
  const target = event.notification.data?.url ?? "/feed";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Reuse an open tab rather than piling up new ones.
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
