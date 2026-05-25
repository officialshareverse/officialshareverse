export const AUTH_NOTICE_KEY = "shareverse-auth-notice";
const LEGACY_AUTH_TOKEN_KEY = "token";
const LEGACY_SESSION_TOKEN_KEY = "sv-access-token";

let inMemoryToken = null;

export function getAuthToken() {
  if (inMemoryToken) {
    return inMemoryToken;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const legacySessionToken = window.sessionStorage.getItem(LEGACY_SESSION_TOKEN_KEY);
  if (legacySessionToken) {
    inMemoryToken = legacySessionToken;
    window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
    return inMemoryToken;
  }

  const legacyLocalToken = window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  if (legacyLocalToken) {
    inMemoryToken = legacyLocalToken;
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    return inMemoryToken;
  }

  return null;
}

export function setAuthToken(token) {
  inMemoryToken = token || null;

  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  }
}

export function clearAuthSession(message = "") {
  inMemoryToken = null;

  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);

  if (message) {
    window.sessionStorage.setItem(AUTH_NOTICE_KEY, message);
  } else {
    window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
  }
}

export function consumeAuthNotice() {
  if (typeof window === "undefined") {
    return "";
  }

  const notice = window.sessionStorage.getItem(AUTH_NOTICE_KEY) || "";
  if (notice) {
    window.sessionStorage.removeItem(AUTH_NOTICE_KEY);
  }
  return notice;
}
