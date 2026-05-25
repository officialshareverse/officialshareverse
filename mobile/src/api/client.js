import Constants from "expo-constants";
import axios from "axios";

import { clearStoredSession, writeStoredSession } from "../auth/session";

const configuredBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  "http://127.0.0.1:8000/api/";

export const API_BASE_URL = configuredBaseUrl.endsWith("/")
  ? configuredBaseUrl
  : `${configuredBaseUrl}/`;

export const api = axios.create({
  baseURL: API_BASE_URL,
});

const AUTH_EXEMPT_PATHS = [
  "mobile/login/",
  "mobile/auth/google/",
  "mobile/signup/",
  "mobile/auth/refresh/",
  "mobile/auth/logout/",
  "signup/check-availability/",
  "signup/request-otp/",
  "forgot-password/request-otp/",
  "forgot-password/confirm-otp/",
  "referral/validate/",
];

let accessToken = "";
let refreshToken = "";
let isRefreshing = false;
let failedRequestQueue = [];
let isHandlingUnauthorized = false;
let unauthorizedHandler = null;
let sessionUpdateHandler = null;

export function setSessionTokens(session) {
  accessToken = session?.accessToken || "";
  refreshToken = session?.refreshToken || "";
  if (accessToken && refreshToken) {
    isHandlingUnauthorized = false;
  }
}

export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function registerSessionUpdateHandler(handler) {
  sessionUpdateHandler = handler;
}

async function refreshAccessToken() {
  if (!refreshToken) {
    throw new Error("Missing mobile refresh token.");
  }

  const response = await axios.post(`${API_BASE_URL}mobile/auth/refresh/`, {
    refresh: refreshToken,
  });

  const nextAccessToken = response?.data?.access || "";
  const nextRefreshToken = response?.data?.refresh || refreshToken;

  if (!nextAccessToken || !nextRefreshToken) {
    throw new Error("Refresh response did not include a usable token pair.");
  }

  accessToken = nextAccessToken;
  refreshToken = nextRefreshToken;
  const nextSession = {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
  };
  await writeStoredSession(nextSession);
  if (sessionUpdateHandler) {
    sessionUpdateHandler(nextSession);
  }

  return nextAccessToken;
}

function isAuthExemptRequest(requestUrl) {
  return AUTH_EXEMPT_PATHS.some((path) => requestUrl.includes(path));
}

function queueRequestUntilRefreshCompletes() {
  return new Promise((resolve, reject) => {
    failedRequestQueue.push({ resolve, reject });
  });
}

function settleQueuedRequests(error, nextAccessToken = "") {
  const queuedRequests = failedRequestQueue;
  failedRequestQueue = [];

  queuedRequests.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }

    resolve(nextAccessToken);
  });
}

async function handleUnauthorizedSession(error) {
  if (isHandlingUnauthorized) {
    return;
  }

  isHandlingUnauthorized = true;
  accessToken = "";
  refreshToken = "";
  await clearStoredSession();
  if (unauthorizedHandler) {
    unauthorizedHandler(error);
  }
}

function attachAuthorizationHeader(config, nextAccessToken) {
  config.headers = {
    ...(config.headers || {}),
    Authorization: `Bearer ${nextAccessToken}`,
  };
  return config;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    attachAuthorizationHeader(config, accessToken);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";
    const originalRequest = error?.config || {};

    if (status === 401) {
      const isAuthEndpoint = isAuthExemptRequest(requestUrl);

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      if (originalRequest._retry) {
        await handleUnauthorizedSession(error);
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        try {
          const nextToken = await queueRequestUntilRefreshCompletes();
          attachAuthorizationHeader(originalRequest, nextToken);
          return api(originalRequest);
        } catch (refreshError) {
          await handleUnauthorizedSession(refreshError);
          return Promise.reject(refreshError);
        }
      }

      isRefreshing = true;

      try {
        const nextToken = await refreshAccessToken();
        settleQueuedRequests(null, nextToken);
        attachAuthorizationHeader(originalRequest, nextToken);
        return api(originalRequest);
      } catch (refreshError) {
        settleQueuedRequests(refreshError);
        await handleUnauthorizedSession(refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
