const DEFAULT_API_BASE_PATH = "/api/";

export function normalizeApiBaseUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return DEFAULT_API_BASE_PATH;
  }
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

export function getApiBaseUrl() {
  return normalizeApiBaseUrl(process.env.REACT_APP_API_BASE_URL);
}

export function getWebSocketBaseUrl() {
  const apiBaseUrl = getApiBaseUrl();

  if (/^https?:\/\//i.test(apiBaseUrl)) {
    return apiBaseUrl
      .replace(/^http/i, (protocol) => (protocol.toLowerCase() === "https" ? "wss" : "ws"))
      .replace(/\/api\/?$/, "");
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const basePath = apiBaseUrl.startsWith("/") ? apiBaseUrl : `/${apiBaseUrl}`;
    const hostBase = `${protocol}//${window.location.host}`;
    return `${hostBase}${basePath}`.replace(/\/api\/?$/, "");
  }

  return "ws://127.0.0.1:8000";
}
