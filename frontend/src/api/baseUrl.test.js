import {
  DEFAULT_LOCAL_API_BASE_URL,
  getApiBaseUrl,
  normalizeApiBaseUrl,
  resolveApiBaseUrl,
  resolveWebSocketBaseUrl,
} from "./baseUrl";

describe("baseUrl helpers", () => {
  const originalEnvValue = process.env.REACT_APP_API_BASE_URL;

  afterEach(() => {
    process.env.REACT_APP_API_BASE_URL = originalEnvValue;
  });

  test("normalizeApiBaseUrl appends a trailing slash", () => {
    expect(normalizeApiBaseUrl("https://api.shareverse.in/api")).toBe(
      "https://api.shareverse.in/api/"
    );
  });

  test("resolveApiBaseUrl prefers explicit env configuration on production hosts", () => {
    expect(
      resolveApiBaseUrl({
        hostname: "shareverse.in",
        envValue: "https://api.shareverse.in/api/",
      })
    ).toBe("https://api.shareverse.in/api/");
  });

  test("resolveApiBaseUrl falls back to same-origin api path when no env exists on production hosts", () => {
    expect(
      resolveApiBaseUrl({
        hostname: "shareverse.in",
        envValue: "",
      })
    ).toBe("/api/");
  });

  test("resolveApiBaseUrl falls back to the local django server for localhost without env", () => {
    expect(
      resolveApiBaseUrl({
        hostname: "localhost",
        envValue: "",
      })
    ).toBe(DEFAULT_LOCAL_API_BASE_URL);
  });

  test("getApiBaseUrl uses the explicit env value even in the browser", () => {
    process.env.REACT_APP_API_BASE_URL = "https://api.shareverse.in/api/";
    expect(getApiBaseUrl()).toBe("https://api.shareverse.in/api/");
  });

  test("resolveWebSocketBaseUrl converts an absolute https api base to wss", () => {
    expect(
      resolveWebSocketBaseUrl({
        apiBaseUrl: "https://api.shareverse.in/api/",
      })
    ).toBe("wss://api.shareverse.in");
  });

  test("resolveWebSocketBaseUrl builds from same-origin api paths", () => {
    expect(
      resolveWebSocketBaseUrl({
        apiBaseUrl: "/api/",
        protocol: "https:",
        host: "shareverse.in",
      })
    ).toBe("wss://shareverse.in");
  });
});
