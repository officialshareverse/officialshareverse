export const AUTH_NOTICE_KEY = "shareverse-auth-notice";
const AUTH_TOKEN_KEY = "token";

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function clearAuthSession(message = "") {
  localStorage.removeItem(AUTH_TOKEN_KEY);

  if (message) {
    sessionStorage.setItem(AUTH_NOTICE_KEY, message);
  } else {
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  }
}

export function consumeAuthNotice() {
  const notice = sessionStorage.getItem(AUTH_NOTICE_KEY) || "";
  if (notice) {
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  }
  return notice;
}
