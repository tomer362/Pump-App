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

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
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
 * That leaves a timer in here, held open by `waitUntil`. It is honestly
 * best-effort — a browser may stop a worker whenever it likes, and iOS does —
 * which is why the in-app chime and the volt bar stay the primary signal and
 * this is a bonus channel, the same deal the rest of push gets.
 * ------------------------------------------------------------------------- */

/** The pending rest alarm: `{ timeout, done }`, at most one at a time. */
let restAlarm = null;

function cancelRestAlarm() {
  if (!restAlarm) return;
  clearTimeout(restAlarm.timeout);
  // Release the `waitUntil` promise, or the worker is kept alive for a rest
  // that has already been skipped.
  restAlarm.done();
  restAlarm = null;
}

async function closeWorkoutNotifications() {
  const open = await self.registration.getNotifications({ tag: WORKOUT_TAG });
  for (const n of open) n.close();
}

async function appIsOnScreen() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  return clients.some((c) => c.visibilityState === "visible");
}

/** The quiet one: what the session is at, replaced silently each time. */
function showWorkoutProgress(msg) {
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
async function fireRestAlarm(msg) {
  // Pump is on screen — the bar has already gone volt and the chime has
  // played. A banner over the top of that is noise.
  if (await appIsOnScreen()) return;
  await self.registration.showNotification("Rest over", {
    body: msg.body || "Back to it.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: msg.url || "/feed" },
    tag: WORKOUT_TAG,
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
    case "workout-rest": {
      cancelRestAlarm();
      const delay = msg.endsAt - Date.now();
      // A rest is minutes. Anything beyond that is a stale message, and
      // scheduling it would pin the worker open for nothing.
      if (!(delay > 0) || delay > 30 * 60 * 1000) return;
      event.waitUntil(
        new Promise((resolve) => {
          const timeout = setTimeout(() => {
            restAlarm = null;
            fireRestAlarm(msg).then(resolve, resolve);
          }, delay);
          restAlarm = { timeout, done: resolve };
        }),
      );
      return;
    }

    // Rest skipped, adjusted away, or the set un-ticked.
    case "workout-rest-cancel":
      cancelRestAlarm();
      return;

    // The app went to the background with a workout running.
    case "workout-show":
      event.waitUntil(showWorkoutProgress(msg));
      return;

    // The app came back. Deliberately does *not* touch the alarm: opening Pump
    // mid-rest and putting it away again must not lose the alert.
    case "workout-hide":
      event.waitUntil(closeWorkoutNotifications());
      return;

    // Finished or discarded. Now the alarm goes too.
    case "workout-end":
      cancelRestAlarm();
      event.waitUntil(closeWorkoutNotifications());
      return;
  }
});

self.addEventListener("notificationclick", (event) => {
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
