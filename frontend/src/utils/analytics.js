export function pushDataLayerEvent(event, params = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...params,
  });
}

export function trackSignup(method = "email", params = {}) {
  pushDataLayerEvent("sign_up", {
    method,
    ...params,
  });
}
