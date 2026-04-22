import {
  AUTH_NOTICE_KEY,
  clearAuthSession,
  consumeAuthNotice,
  getAuthToken,
  setAuthToken,
} from "./session";

describe("auth session helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test("stores the access token in session storage and clears the legacy token", () => {
    window.localStorage.setItem("token", "legacy-token");

    setAuthToken("fresh-token");

    expect(window.sessionStorage.getItem("sv-access-token")).toBe("fresh-token");
    expect(window.localStorage.getItem("token")).toBeNull();
  });

  test("migrates a legacy token from local storage into session storage", () => {
    window.localStorage.setItem("token", "legacy-token");

    expect(getAuthToken()).toBe("legacy-token");
    expect(window.sessionStorage.getItem("sv-access-token")).toBe("legacy-token");
    expect(window.localStorage.getItem("token")).toBeNull();
  });

  test("clears the access token and stores an auth notice", () => {
    window.sessionStorage.setItem("sv-access-token", "fresh-token");

    clearAuthSession("Please sign in again.");

    expect(window.sessionStorage.getItem("sv-access-token")).toBeNull();
    expect(window.sessionStorage.getItem(AUTH_NOTICE_KEY)).toBe("Please sign in again.");
    expect(consumeAuthNotice()).toBe("Please sign in again.");
    expect(window.sessionStorage.getItem(AUTH_NOTICE_KEY)).toBeNull();
  });
});
