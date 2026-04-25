export function extractApiError(errorData, fallbackMessage) {
  if (!errorData || typeof errorData !== "object") {
    return fallbackMessage;
  }

  if (typeof errorData.error === "string" && errorData.error.trim()) {
    const retryAfter = errorData.retry_after_seconds;
    if (typeof retryAfter === "number" && retryAfter > 0) {
      return `${errorData.error} Try again in ${retryAfter}s.`;
    }
    return errorData.error;
  }

  const firstField = Object.values(errorData)[0];
  if (Array.isArray(firstField) && firstField.length > 0) {
    return firstField[0];
  }

  if (typeof firstField === "string" && firstField.trim()) {
    return firstField;
  }

  return fallbackMessage;
}

export function formatRelativeLoginTime(value, now = Date.now()) {
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const deltaMinutes = Math.max(1, Math.round((now - timestamp) / 60000));
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 7) {
    return `${deltaDays}d ago`;
  }

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function buildLastLoginNote(lastLoginMeta, activeUsername, now = Date.now()) {
  if (!lastLoginMeta?.time) {
    return "";
  }

  if (activeUsername && lastLoginMeta.username && lastLoginMeta.username !== activeUsername) {
    return "";
  }

  const relativeTime = formatRelativeLoginTime(lastLoginMeta.time, now);
  if (!relativeTime) {
    return "";
  }

  return `Last login on this device${lastLoginMeta.username ? ` as @${lastLoginMeta.username}` : ""}: ${relativeTime}`;
}

export function createResetForm(username = "") {
  return {
    username,
    otp: "",
    new_password: "",
    confirm_password: "",
  };
}
