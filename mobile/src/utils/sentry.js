import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Sentry from "@sentry/react-native";

let isInitialized = false;

function parseSampleRate(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value || "").trim());
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 0), 1);
}

function readExtraValue(key) {
  return Constants.expoConfig?.extra?.[key] || Constants.manifest?.extra?.[key] || "";
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
  const dsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    readExtraValue("sentryDsn") ||
    "";
  if (!dsn || isInitialized) {
    return;
  }

  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const tracesSampleRate = parseSampleRate(
    process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ||
      readExtraValue("sentryTracesSampleRate"),
    0
  );

  Sentry.init({
    dsn,
    environment:
      process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ||
      readExtraValue("sentryEnvironment") ||
      (__DEV__ ? "development" : "production"),
    release:
      process.env.EXPO_PUBLIC_SENTRY_RELEASE ||
      readExtraValue("sentryRelease") ||
      undefined,
    tracesSampleRate,
    enableNative: !isExpoGo,
    enableNativeCrashHandling: !isExpoGo,
    enableAutoSessionTracking: !isExpoGo,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
  isInitialized = true;
}

export function setSentryUser(user) {
  if (!isInitialized || !user) {
    return;
  }

  Sentry.setUser({
    id: user.id ? String(user.id) : undefined,
    username: user.username || undefined,
    email: user.email || undefined,
  });
}

export function clearSentryUser() {
  if (!isInitialized) {
    return;
  }
  Sentry.setUser(null);
}

export { Sentry };
