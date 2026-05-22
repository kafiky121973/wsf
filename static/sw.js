const CACHE = "shifra-v14";
const ASSETS = [
  "/static/css/main.css",
  "/static/css/responsive.css",
  "/static/css/install-page.css",
  "/static/js/main.js",
  "/static/js/pwa.js",
  "/static/js/install-page.js",
  "/manifest.webmanifest",
  "/static/js/pwa-digest.js",
  "/static/icons/logo.png",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  let data = { title: "شفرة الفطرة", body: "رسالة جديدة", data: { url: "/" } };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }
  const url = (data.data && data.data.url) || "/";
  event.waitUntil(
    self.registration.showNotification(data.title || "شفرة الفطرة", {
      body: data.body || "",
      icon: data.icon || "/static/icons/icon-192.png",
      badge: data.badge || "/static/icons/icon-192.png",
      tag: data.tag || "shifra-msg",
      dir: "rtl",
      lang: "ar",
      renotify: true,
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          if ("navigate" in client) {
            return client.navigate(url).then(() => client.focus());
          }
          return client.focus().then(() => {
            client.postMessage({ type: "open", url });
          });
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  const isHtml =
    event.request.mode === "navigate" ||
    (event.request.headers.get("accept") || "").includes("text/html");

  if (isHtml) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin && url.pathname.startsWith("/static/")) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
