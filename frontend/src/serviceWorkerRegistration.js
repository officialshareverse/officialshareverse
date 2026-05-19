const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
    window.location.hostname === "[::1]" ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

function registerValidServiceWorker(serviceWorkerUrl, config) {
  navigator.serviceWorker
    .register(serviceWorkerUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state !== "installed") {
            return;
          }

          if (navigator.serviceWorker.controller) {
            if (config && config.onUpdate) {
              config.onUpdate(registration);
            }
          } else if (config && config.onSuccess) {
            config.onSuccess(registration);
          }
        };
      };
    })
    .catch(() => {
      // Service worker registration should never interrupt app startup.
    });
}

function checkValidServiceWorker(serviceWorkerUrl, config) {
  fetch(serviceWorkerUrl, {
    headers: { "Service-Worker": "script" },
  })
    .then((response) => {
      const contentType = response.headers.get("content-type") || "";
      if (response.status === 404 || !contentType.includes("javascript")) {
        navigator.serviceWorker.ready
          .then((registration) => registration.unregister())
          .then(() => window.location.reload());
        return;
      }

      registerValidServiceWorker(serviceWorkerUrl, config);
    })
    .catch(() => {
      // Offline-first behavior begins once a valid worker has been installed.
    });
}

export function register(config) {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
    return;
  }

  const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
  if (publicUrl.origin !== window.location.origin) {
    return;
  }

  window.addEventListener("load", () => {
    const serviceWorkerUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    if (isLocalhost) {
      checkValidServiceWorker(serviceWorkerUrl, config);
      return;
    }

    registerValidServiceWorker(serviceWorkerUrl, config);
  });
}

export function unregister() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.ready
    .then((registration) => registration.unregister())
    .catch(() => {
      // No-op.
    });
}
