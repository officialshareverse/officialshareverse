import {
  AUTH_NOTICE_KEY,
  clearAuthSession,
  consumeAuthNotice,
  getAuthToken,
  setAuthToken,
} from "./session";

function makeJwt(payload) {
  const encodedPayload = window
    .btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `header.${encodedPayload}.signature`;
}

describe("auth session helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearAuthSession();
  });

  test("stores the access token in memory and clears legacy tokens", () => {
    window.localStorage.setItem("token", "legacy-token");
    window.sessionStorage.setItem("sv-access-token", "legacy-session-token");

    setAuthToken("fresh-token");

    expect(getAuthToken()).toBe("fresh-token");
    expect(window.sessionStorage.getItem("sv-access-token")).toBeNull();
    expect(window.localStorage.getItem("token")).toBeNull();
  });

  test("migrates a legacy token from local storage into memory", () => {
    window.localStorage.setItem("token", "legacy-token");

    expect(getAuthToken()).toBe("legacy-token");
    expect(window.localStorage.getItem("token")).toBeNull();
  });

  test("migrates a legacy token from session storage into memory", () => {
    window.sessionStorage.setItem("sv-access-token", "legacy-session-token");

    expect(getAuthToken()).toBe("legacy-session-token");
    expect(window.sessionStorage.getItem("sv-access-token")).toBeNull();
  });

  test("clears the access token and stores an auth notice", () => {
    setAuthToken("fresh-token");

    clearAuthSession("Please sign in again.");

    expect(getAuthToken()).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_NOTICE_KEY)).toBe("Please sign in again.");
    expect(consumeAuthNotice()).toBe("Please sign in again.");
    expect(window.sessionStorage.getItem(AUTH_NOTICE_KEY)).toBeNull();
  });

  test("drops expired JWTs from legacy session storage", () => {
    const expiredToken = makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
    window.sessionStorage.setItem("sv-access-token", expiredToken);

    expect(getAuthToken()).toBeNull();
    expect(window.sessionStorage.getItem("sv-access-token")).toBeNull();
  });

  test("drops expired JWTs from memory", () => {
    const expiredToken = makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });

    setAuthToken(expiredToken);

    expect(getAuthToken()).toBeNull();
  });

  test("keeps unexpired JWTs in memory", () => {
    const freshToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 60 });

    setAuthToken(freshToken);

    expect(getAuthToken()).toBe(freshToken);
  });
});
