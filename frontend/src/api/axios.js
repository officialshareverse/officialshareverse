import axios from "axios";

import { clearAuthSession, getAuthToken } from "../auth/session";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000/api/",
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
  "signup/",
  "signup/check-availability/",
  "signup/request-otp/",
  "forgot-password/request-otp/",
  "forgot-password/confirm-otp/",
];

let isRedirectingForUnauthorized = false;

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";

    if (status === 401) {
      const isAuthEndpoint = AUTH_REDIRECT_EXEMPT_PATHS.some((path) => requestUrl.includes(path));

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
