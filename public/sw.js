/* Pump service worker.
 *
 * Deliberately minimal: no route caching. A workout tracker's value is in the
 * live data, and a stale cached shell showing yesterday's sets is worse than a
 * spinner. The worker exists so the app is installable and can receive push.
 */

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
