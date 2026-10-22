self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Thoughtfully reminder";
  const body = payload.body || "You have an occasion coming up.";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: "thoughtfully-reminder",
    data: { url: payload.url || "/app" },
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target);
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  }));
});
