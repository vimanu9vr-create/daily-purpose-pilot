/* ManifestAI service worker.
 *
 * Two jobs: make the app installable (required before iOS allows push at all),
 * and receive the morning affirmation push.
 *
 * Deliberately no offline caching of app code yet — a stale cached bundle is a
 * worse bug than no offline support, and the app needs the network for data
 * anyway. Revisit once the app stops changing daily.
 */

const VERSION = "v1";

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "ManifestAI";
  const options = {
    body: payload.body || "Your affirmation for today is ready.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "daily-affirmation",
    // Replace yesterday's rather than stacking up unread notifications.
    renotify: true,
    data: { url: payload.url || "/app" },
    actions: [{ action: "open", title: "Read it" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Focus an existing window if the app is already open.
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
