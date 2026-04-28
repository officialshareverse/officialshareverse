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
let refreshPromise = null;
let unauthorizedHandler = null;
let sessionUpdateHandler = null;

export function setSessionTokens(session) {
  accessToken = session?.accessToken || "";
  refreshToken = session?.refreshToken || "";
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

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    };
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
      const isAuthEndpoint = AUTH_EXEMPT_PATHS.some((path) => requestUrl.includes(path));

      if (!isAuthEndpoint && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          if (!refreshPromise) {
            refreshPromise = refreshAccessToken().finally(() => {
              refreshPromise = null;
            });
          }

          const nextToken = await refreshPromise;
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${nextToken}`,
          };
          return api(originalRequest);
        } catch (refreshError) {
          accessToken = "";
          refreshToken = "";
          await clearStoredSession();
          if (unauthorizedHandler) {
            unauthorizedHandler(refreshError);
          }
        }
      }
    }

    return Promise.reject(error);
  }
);
