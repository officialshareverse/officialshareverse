export const AUTH_NOTICE_KEY = "shareverse-auth-notice";
const LEGACY_AUTH_TOKEN_KEY = "token";
const LEGACY_SESSION_TOKEN_KEY = "sv-access-token";
const TOKEN_EXPIRY_SKEW_SECONDS = 5;

let inMemoryToken = null;

function clearStoredAuthTokens() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64UrlPayload = parts[1];
    const base64Payload = base64UrlPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = `${base64Payload}${"=".repeat((4 - (base64Payload.length % 4)) % 4)}`;
    const decoder =
      typeof window !== "undefined" && typeof window.atob === "function"
        ? window.atob.bind(window)
        : null;

    if (!decoder) {
      return null;
    }

    return JSON.parse(decoder(paddedPayload));
  } catch {
    return null;
  }
}

function isExpiredJwt(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowSeconds + TOKEN_EXPIRY_SKEW_SECONDS;
}

function getUsableToken(token) {
  if (!token) {
    return null;
  }

  return isExpiredJwt(token) ? null : token;
}

export function getAuthToken() {
  if (inMemoryToken) {
    const usableMemoryToken = getUsableToken(inMemoryToken);
    if (!usableMemoryToken) {
      inMemoryToken = null;
      clearStoredAuthTokens();
      return null;
    }

    return inMemoryToken;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const legacySessionToken = window.sessionStorage.getItem(LEGACY_SESSION_TOKEN_KEY);
  if (legacySessionToken) {
    window.sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
    const usableSessionToken = getUsableToken(legacySessionToken);
    if (usableSessionToken) {
      inMemoryToken = usableSessionToken;
      return inMemoryToken;
    }
  }

  const legacyLocalToken = window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  if (legacyLocalToken) {
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
    const usableLocalToken = getUsableToken(legacyLocalToken);
    if (usableLocalToken) {
      inMemoryToken = usableLocalToken;
      return inMemoryToken;
    }
  }

  return null;
}

export function setAuthToken(token) {
  inMemoryToken = getUsableToken(token) || null;
  clearStoredAuthTokens();
}

export function clearAuthSession(message = "") {
  inMemoryToken = null;

  if (typeof window === "undefined") {
    return;
  }

  clearStoredAuthTokens();

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
