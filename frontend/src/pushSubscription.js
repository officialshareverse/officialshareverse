import API from "./api/axios";
import { getAuthToken } from "./auth/session";

export async function subscribeToPush(registration) {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Push permission not granted.");
      return false;
    }

    const token = getAuthToken();
    if (!token) {
      console.error("No auth token available for push subscription.");
      return false;
    }

    const response = await API.get("web-push/vapid-key/");
    const public_key = response.data?.public_key;

    if (!public_key) {
      console.error("No VAPID public key received from server.");
      return false;
    }

    const applicationServerKey = urlB64ToUint8Array(public_key);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    const subJSON = subscription.toJSON();
    const endpoint = subJSON.endpoint;
    const p256dh = subJSON.keys.p256dh;
    const auth = subJSON.keys.auth;

    const subscribeResponse = await API.post("web-push/subscribe/", {
      endpoint,
      p256dh,
      auth,
      browser: getBrowserName(),
    });

    if (subscribeResponse.status >= 200 && subscribeResponse.status < 300) {
      console.log("Successfully subscribed to web push");
      return true;
    } else {
      console.error("Failed to save push subscription on server");
      return false;
    }
  } catch (error) {
    console.error("Error subscribing to push:", error);
    return false;
  }
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      try {
        await API.post("web-push/unsubscribe/", { endpoint });
      } catch (e) {
        console.error("Failed to unsubscribe on server:", e);
      }
      console.log("Successfully unsubscribed from web push");
      return true;
    }
  } catch (error) {
    console.error("Error unsubscribing from push:", error);
  }
  return false;
}

// Utility function to convert base64 to Uint8Array
function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Simple browser detection
function getBrowserName() {
  const userAgent = navigator.userAgent;
  if (userAgent.match(/chrome|chromium|crios/i)) return "Chrome";
  if (userAgent.match(/firefox|fxios/i)) return "Firefox";
  if (userAgent.match(/safari/i)) return "Safari";
  if (userAgent.match(/opr\//i)) return "Opera";
  if (userAgent.match(/edg/i)) return "Edge";
  return "Unknown";
}
