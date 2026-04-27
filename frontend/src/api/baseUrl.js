const DEFAULT_API_BASE_PATH = "/api/";
export const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:8000/api/";
const LOCAL_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalBrowserHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return LOCAL_BROWSER_HOSTS.has(normalized) || normalized.endsWith(".local");
}

export function normalizeApiBaseUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return DEFAULT_API_BASE_PATH;
  }
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

export function resolveApiBaseUrl({ hostname, envValue } = {}) {
  const explicitApiBaseUrl = String(envValue || "").trim();
  if (explicitApiBaseUrl) {
    return normalizeApiBaseUrl(explicitApiBaseUrl);
  }

  if (hostname && !isLocalBrowserHost(hostname)) {
    return DEFAULT_API_BASE_PATH;
  }

  return DEFAULT_LOCAL_API_BASE_URL;
}

export function getApiBaseUrl() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  return resolveApiBaseUrl({
    hostname,
    envValue: process.env.REACT_APP_API_BASE_URL,
  });
}

export function resolveWebSocketBaseUrl({
  apiBaseUrl,
  protocol,
  host,
} = {}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);

  if (/^https?:\/\//i.test(normalizedApiBaseUrl)) {
    return normalizedApiBaseUrl
      .replace(/^http/i, (protocol) => (protocol.toLowerCase() === "https" ? "wss" : "ws"))
      .replace(/\/api\/?$/, "");
  }

  if (protocol && host) {
    const socketProtocol = protocol === "https:" ? "wss:" : "ws:";
    const basePath = normalizedApiBaseUrl.startsWith("/")
      ? normalizedApiBaseUrl
      : `/${normalizedApiBaseUrl}`;
    const hostBase = `${socketProtocol}//${host}`;
    return `${hostBase}${basePath}`.replace(/\/api\/?$/, "");
  }

  return "ws://127.0.0.1:8000";
}

export function getWebSocketBaseUrl() {
  const apiBaseUrl = getApiBaseUrl();
  return resolveWebSocketBaseUrl({
    apiBaseUrl,
    protocol: typeof window !== "undefined" ? window.location.protocol : "",
    host: typeof window !== "undefined" ? window.location.host : "",
  });
}
