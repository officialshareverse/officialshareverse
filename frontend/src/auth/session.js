export const AUTH_NOTICE_KEY = "shareverse-auth-notice";
const AUTH_TOKEN_KEY = "sv-access-token";
const LEGACY_AUTH_TOKEN_KEY = "token";

function getSessionStore() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage;
}

export function getAuthToken() {
  const sessionStore = getSessionStore();
  const sessionToken = sessionStore?.getItem(AUTH_TOKEN_KEY);
  if (sessionToken) {
    return sessionToken;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const legacyToken = window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  if (legacyToken) {
    sessionStore?.setItem(AUTH_TOKEN_KEY, legacyToken);
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    return legacyToken;
  }

  return null;
}

export function setAuthToken(token) {
  const sessionStore = getSessionStore();

  if (token) {
    sessionStore?.setItem(AUTH_TOKEN_KEY, token);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    }
    return;
  }

  sessionStore?.removeItem(AUTH_TOKEN_KEY);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  }
}

export function clearAuthSession(message = "") {
  const sessionStore = getSessionStore();
  sessionStore?.removeItem(AUTH_TOKEN_KEY);

  if (typeof window === "undefined") {
    return;
  }

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
