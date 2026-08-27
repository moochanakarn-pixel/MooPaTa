const CACHE_NAME = "moopata-v2";
const SHELL_URLS = ["/", "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: always prefer live data (this app is mostly dynamic,
// per-user dashboards), only falling back to the cached shell when offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // /api/* must never be intercepted: none of it is meaningfully
  // cacheable (every route is per-user/auth-gated or a one-shot action),
  // and a Service Worker sitting in front of the share routes' download
  // responses is exactly what made every "share" button fail silently —
  // Chrome's download manager doesn't handle a SW-intercepted download
  // request reliably, regardless of what the response itself looks like.
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// Water-intake reminders (see /api/cron/water-reminder) arrive as a push
// message with a JSON body — { title, body, url } — and are shown as a
// plain notification; tapping it focuses/opens the food page.
self.addEventListener("push", (event) => {
  let payload = { title: "MooPaTa", body: "" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // non-JSON payload — fall back to the defaults above
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url: payload.url || "/dashboard/food" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard/food";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
