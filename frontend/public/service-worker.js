const CACHE_VERSION = "shareverse-pwa-1782184000000";
const APP_SHELL_CACHE = `${CACHE_VERSION}-app-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/shareverse-favicon.png",
  "/shareverse-logo-192.png",
  "/shareverse-logo-512.png",
  "/shareverse-notification-icon.png",
  "/shareverse-notification-badge.png",
  "/shareverse-tab.svg",
];

const isApiRequest = (url) => {
  return url.pathname.startsWith("/api/");
};

const isStaticAsset = (url) => {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/static/") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".webp"))
  );
};

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

async function networkFirstNavigation(request) {
  const appShellCache = await caches.open(APP_SHELL_CACHE);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      appShellCache.put("/index.html", networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedShell = await appShellCache.match("/index.html");
    if (cachedShell) {
      return cachedShell;
    }

    const cachedRoot = await appShellCache.match("/");
    if (cachedRoot) {
      return cachedRoot;
    }

    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => !cacheName.startsWith(CACHE_VERSION))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.hostname === "logo.clearbit.com") {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.origin !== self.location.origin || isApiRequest(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

// Web Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "ShareVerse Notification";
    const origin = self.location.origin;
    const options = {
      body: data.body,
      icon: data.icon || `${origin}/shareverse-notification-icon.png`,
      badge: data.badge || `${origin}/shareverse-notification-badge.png`,
      data: data.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(title, options).then(() => {
        // Increment the app icon badge count
        if ("setAppBadge" in navigator) {
          return self.registration.getNotifications().then((notifications) => {
            navigator.setAppBadge(notifications.length).catch(() => {});
          });
        }
      })
    );
  } catch (e) {
    console.error("Error parsing push data", e);
  }
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    Promise.all([
      // Update badge count after closing notification
      self.registration.getNotifications().then((notifications) => {
        if ("setAppBadge" in navigator) {
          if (notifications.length > 0) {
            navigator.setAppBadge(notifications.length).catch(() => {});
          } else {
            navigator.clearAppBadge().catch(() => {});
          }
        }
      }),
      // Focus or open the app
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
    ])
  );
});