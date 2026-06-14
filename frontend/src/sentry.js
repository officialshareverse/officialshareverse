import * as Sentry from "@sentry/react";

function parseSampleRate(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value || "").trim());
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 0), 1);
}

function scrubEvent(event) {
  if (event?.request?.headers) {
    delete event.request.headers.Authorization;
    delete event.request.headers.authorization;
    delete event.request.headers.Cookie;
    delete event.request.headers.cookie;
  }
  return event;
}

export function initSentry() {
  const dsn = (process.env.REACT_APP_SENTRY_DSN || "").trim();
  if (!dsn) {
    return;
  }

  const tracesSampleRate = parseSampleRate(
    process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE,
    0
  );
  const replaysSessionSampleRate = parseSampleRate(
    process.env.REACT_APP_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    0
  );
  const replaysOnErrorSampleRate = parseSampleRate(
    process.env.REACT_APP_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    0
  );
  const integrations = [];

  if (tracesSampleRate > 0) {
    integrations.push(Sentry.browserTracingIntegration());
  }

  if (replaysSessionSampleRate > 0 || replaysOnErrorSampleRate > 0) {
    integrations.push(
      Sentry.replayIntegration({
        blockAllMedia: true,
        maskAllText: true,
      })
    );
  }

  Sentry.init({
    dsn,
    environment: process.env.REACT_APP_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.REACT_APP_SENTRY_RELEASE || undefined,
    integrations,
    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    beforeSend: scrubEvent,
    ignoreErrors: ["ResizeObserver loop limit exceeded"],
  });
}

export { Sentry };
