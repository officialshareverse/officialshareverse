import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PUSH_TOKEN_STORAGE_KEY = "shareverse.expoPushToken";

let didConfigureNotifications = false;

function isGranted(statusPayload) {
  return Boolean(
    statusPayload?.granted ||
      statusPayload?.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function getProjectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    ""
  );
}

export function configurePushNotifications() {
  if (didConfigureNotifications) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  didConfigureNotifications = true;
}

async function ensureAndroidChannelAsync() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0f766e",
  });
}

export async function getStoredPushTokenAsync() {
  return (await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY)) || "";
}

export async function getPushRegistrationStatusAsync() {
  configurePushNotifications();

  const permissions = await Notifications.getPermissionsAsync();
  const storedToken = await getStoredPushTokenAsync();

  return {
    isDevice: Device.isDevice,
    granted: isGranted(permissions),
    permissionStatus: permissions.status || "undetermined",
    storedToken,
    hasStoredToken: Boolean(storedToken),
    projectId: getProjectId(),
  };
}

export async function unregisterPushTokenAsync(api, providedToken = "") {
  const token = providedToken || (await getStoredPushTokenAsync());
  if (!token) {
    return { ok: true, token: "", skipped: true };
  }

  try {
    await api.post("mobile/push/unregister/", {
      expo_push_token: token,
    });
  } catch {
    // Best effort: local cleanup still matters during sign-out.
  }

  await SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY);
  return { ok: true, token };
}

export async function registerForPushNotificationsAsync(
  api,
  { requestPermission = true } = {}
) {
  configurePushNotifications();

  if (!Device.isDevice) {
    return {
      ok: false,
      reason: "device",
      message: "Push notifications require a physical Android or iPhone device.",
    };
  }

  await ensureAndroidChannelAsync();

  let permissions = await Notifications.getPermissionsAsync();
  if (!isGranted(permissions) && requestPermission) {
    permissions = await Notifications.requestPermissionsAsync();
  }

  if (!isGranted(permissions)) {
    return {
      ok: false,
      reason: "permission",
      message: "Notification permission is not enabled on this device.",
      permissionStatus: permissions.status || "denied",
    };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return {
      ok: false,
      reason: "project",
      message: "Expo project id is missing from the app config.",
    };
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse?.data || "";
  if (!expoPushToken) {
    return {
      ok: false,
      reason: "token",
      message: "Expo did not return a push token for this device.",
    };
  }

  await api.post("mobile/push/register/", {
    expo_push_token: expoPushToken,
    platform: Platform.OS,
    project_id: projectId,
    device_name: Device.modelName || Platform.OS,
  });

  await SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, expoPushToken);

  return {
    ok: true,
    token: expoPushToken,
    projectId,
    permissionStatus: permissions.status || "granted",
  };
}

export async function syncPushRegistrationAsync(api) {
  const status = await getPushRegistrationStatusAsync();

  if (!status.isDevice || !status.granted) {
    return {
      ok: false,
      reason: status.isDevice ? "permission" : "device",
      ...status,
    };
  }

  return registerForPushNotificationsAsync(api, { requestPermission: false });
}
