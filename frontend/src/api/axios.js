import axios from "axios";

import { clearAuthSession, getAuthToken, setAuthToken } from "../auth/session";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000/api/",
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
  "forgot-password/request-otp/",
  "forgot-password/confirm-otp/",
];

let isRedirectingForUnauthorized = false;
let refreshSessionPromise = null;

async function refreshAccessToken() {
  const response = await axios.post(
    `${API.defaults.baseURL}auth/refresh/`,
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

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";
    const originalRequest = error?.config || {};

    if (status === 401) {
      const isAuthEndpoint = AUTH_REDIRECT_EXEMPT_PATHS.some((path) => requestUrl.includes(path));

      if (!isAuthEndpoint && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          if (!refreshSessionPromise) {
            refreshSessionPromise = refreshAccessToken().finally(() => {
              refreshSessionPromise = null;
            });
          }

          const nextToken = await refreshSessionPromise;
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${nextToken}`,
          };
          return API(originalRequest);
        } catch {
          // fall through to redirect handling below
        }
      }

      if (!isAuthEndpoint && !isRedirectingForUnauthorized) {
        isRedirectingForUnauthorized = true;
        clearAuthSession("Your session expired. Please sign in again.");
        window.location.replace("/login");
      }
    }

    return Promise.reject(error);
  }
);

export default API;
