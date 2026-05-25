import axios from "axios";

import { clearAuthSession, getAuthToken, setAuthToken } from "../auth/session";
import { getApiBaseUrl } from "./baseUrl";

const API_BASE_URL = getApiBaseUrl();

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

API.interceptors.request.use((req) => {
  const token = getAuthToken();
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

const AUTH_REDIRECT_EXEMPT_PATHS = [
  "login/",
  "auth/google/",
  "auth/refresh/",
  "auth/logout/",
  "signup/",
  "signup/check-availability/",
  "signup/request-otp/",
  "invite/info/",
  "invite/accept/",
  "referral/validate/",
  "forgot-password/request-otp/",
  "forgot-password/confirm-otp/",
];

let isRedirectingForUnauthorized = false;
let refreshSessionPromise = null;

async function requestAccessTokenRefresh() {
  const response = await axios.post(
    `${API_BASE_URL}auth/refresh/`,
    {},
    { withCredentials: true }
  );

  const nextAccessToken = response?.data?.access || "";
  if (!nextAccessToken) {
    throw new Error("Refresh endpoint did not return an access token.");
  }

  setAuthToken(nextAccessToken);
  return nextAccessToken;
}

export function refreshAccessToken() {
  if (!refreshSessionPromise) {
    refreshSessionPromise = requestAccessTokenRefresh().finally(() => {
      refreshSessionPromise = null;
    });
  }

  return refreshSessionPromise;
}

function isAuthRedirectExemptRequest(requestUrl) {
  return AUTH_REDIRECT_EXEMPT_PATHS.some((path) => requestUrl.includes(path));
}

function redirectToLoginAfterExpiredSession() {
  if (isRedirectingForUnauthorized || typeof window === "undefined") {
    return;
  }

  isRedirectingForUnauthorized = true;
  clearAuthSession("Your session expired. Please sign in again.");
  window.location.replace("/login");
}

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";
    const originalRequest = error?.config || {};

    if (status === 401) {
      const isAuthEndpoint = isAuthRedirectExemptRequest(requestUrl);

      if (!isAuthEndpoint && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const nextToken = await refreshAccessToken();
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${nextToken}`,
          };
          return API(originalRequest);
        } catch {
          // fall through to redirect handling below
        }
      }

      if (!isAuthEndpoint) {
        redirectToLoginAfterExpiredSession();
      }
    }

    return Promise.reject(error);
  }
);

export default API;
