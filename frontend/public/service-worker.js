const CACHE_VERSION = "shareverse-pwa-v1";
const APP_SHELL_CACHE = `${CACHE_VERSION}-app-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/shareverse-favicon.png",
  "/shareverse-logo-192.png",
  "/shareverse-logo-512.png",
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
