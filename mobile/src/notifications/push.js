import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const PUSH_TOKEN_STORAGE_KEY = "shareverse.expoPushToken";
const PUSH_EXPO_GO_MESSAGE =
  "Push notifications require a development build or installed app. Expo Go can preview the UI but cannot register Android remote push.";
const PUSH_DEVICE_MESSAGE = "Push notifications require a physical Android or iPhone device.";
const PUSH_PROJECT_MESSAGE = "Expo project id is missing from the app config.";
const PUSH_PERMISSION_MESSAGE = "Notification permission is not enabled on this device.";
const PUSH_TOKEN_MESSAGE = "Expo did not return a push token for this device.";

let didConfigureNotifications = false;
let notificationsModule = null;

function getNotificationsModule() {
  if (!notificationsModule) {
    notificationsModule = require("expo-notifications");
  }
  return notificationsModule;
}

export function getPushRuntimeSupport() {
  const executionEnvironment = Constants.executionEnvironment || "";
  const isExpoGo =
    Constants.appOwnership === "expo" || executionEnvironment === "storeClient";

  if (isExpoGo) {
    return {
      supported: false,
      reason: "expo_go",
      message: PUSH_EXPO_GO_MESSAGE,
      isExpoGo: true,
      executionEnvironment,
    };
  }

  return {
    supported: true,
    reason: "",
    message: "",
    isExpoGo: false,
    executionEnvironment,
  };
}

function isGranted(statusPayload) {
  const Notifications = getNotificationsModule();
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
  const support = getPushRuntimeSupport();
  if (!support.supported || didConfigureNotifications) {
    return support;
  }

  const Notifications = getNotificationsModule();
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
  return support;
}

async function ensureAndroidChannelAsync() {
  const support = getPushRuntimeSupport();
  if (!support.supported || Platform.OS !== "android") {
    return support;
  }

  const Notifications = getNotificationsModule();
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0f766e",
  });

  return support;
}

export async function getStoredPushTokenAsync() {
  return (await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY)) || "";
}

export async function getPushRegistrationStatusAsync() {
  const support = getPushRuntimeSupport();
  const storedToken = await getStoredPushTokenAsync();

  if (!support.supported) {
    return {
      ...support,
      isDevice: Device.isDevice,
      granted: false,
      permissionStatus: "unsupported",
      storedToken,
      hasStoredToken: Boolean(storedToken),
      projectId: getProjectId(),
    };
  }

  configurePushNotifications();

  const Notifications = getNotificationsModule();
  const permissions = await Notifications.getPermissionsAsync();

  return {
    ...support,
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
  const support = getPushRuntimeSupport();
  if (!support.supported) {
    const storedToken = await getStoredPushTokenAsync();
    return {
      ok: false,
      ...support,
      isDevice: Device.isDevice,
      permissionStatus: "unsupported",
      storedToken,
      hasStoredToken: Boolean(storedToken),
      projectId: getProjectId(),
    };
  }

  configurePushNotifications();

  if (!Device.isDevice) {
    return {
      ok: false,
      ...support,
      reason: "device",
      message: PUSH_DEVICE_MESSAGE,
    };
  }

  await ensureAndroidChannelAsync();

  const Notifications = getNotificationsModule();
  let permissions = await Notifications.getPermissionsAsync();
  if (!isGranted(permissions) && requestPermission) {
    permissions = await Notifications.requestPermissionsAsync();
  }

  if (!isGranted(permissions)) {
    return {
      ok: false,
      ...support,
      reason: "permission",
      message: PUSH_PERMISSION_MESSAGE,
      permissionStatus: permissions.status || "denied",
    };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return {
      ok: false,
      ...support,
      reason: "project",
      message: PUSH_PROJECT_MESSAGE,
    };
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse?.data || "";
  if (!expoPushToken) {
    return {
      ok: false,
      ...support,
      reason: "token",
      message: PUSH_TOKEN_MESSAGE,
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
    ...support,
    token: expoPushToken,
    projectId,
    permissionStatus: permissions.status || "granted",
  };
}

export async function syncPushRegistrationAsync(api) {
  const status = await getPushRegistrationStatusAsync();

  if (!status.supported) {
    return {
      ok: false,
      ...status,
    };
  }

  if (!status.isDevice || !status.granted) {
    return {
      ok: false,
      reason: status.isDevice ? "permission" : "device",
      ...status,
    };
  }

  return registerForPushNotificationsAsync(api, { requestPermission: false });
}

export function addPushNotificationResponseListener(listener) {
  const support = getPushRuntimeSupport();
  if (!support.supported) {
    return {
      remove() {},
    };
  }

  configurePushNotifications();
  const Notifications = getNotificationsModule();
  return Notifications.addNotificationResponseReceivedListener(listener);
}
