export const SOUND_TOGGLE_STORAGE_KEY = "sv-notification-sound-enabled";
export const HAPTICS_TOGGLE_STORAGE_KEY = "sv-notification-haptics-enabled";

export const CATEGORY_FILTERS = [
  { value: "all", label: "All" },
  { value: "groups", label: "Groups" },
  { value: "wallet", label: "Wallet" },
  { value: "system", label: "System" },
];

function getDayBucketLabel(value) {
  const date = new Date(value);
  const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const yesterdayKey = todayKey - 86400000;

  if (dayKey >= todayKey) return "Today";
  if (dayKey >= yesterdayKey) return "Yesterday";
  return "Earlier";
}

export function buildSections(items) {
  return items.reduce((acc, item) => {
    const label = getDayBucketLabel(item.latestCreatedAt);
    const section = acc.find((entry) => entry.label === label);
    if (section) {
      section.items.push(item);
      return acc;
    }

    acc.push({ label, items: [item] });
    return acc;
  }, []);
}

export function bundleNotifications(notifications) {
  const singles = [];
  const bundles = new Map();

  notifications.forEach((notification) => {
    if (!notification.is_read && notification.kind === "chat" && notification.context_title) {
      const bundleKey = `chat-${notification.context_title.toLowerCase()}`;
      const existing = bundles.get(bundleKey);

      if (existing) {
        existing.count += 1;
        existing.notificationIds.push(notification.id);
        existing.messages = [notification.message, ...existing.messages].slice(0, 2);
        existing.latestCreatedAt =
          new Date(notification.created_at).getTime() > new Date(existing.latestCreatedAt).getTime()
            ? notification.created_at
            : existing.latestCreatedAt;
      } else {
        bundles.set(bundleKey, {
          type: "bundle",
          id: bundleKey,
          category_label: notification.category_label,
          context_title: notification.context_title,
          latestCreatedAt: notification.created_at,
          count: 1,
          notificationIds: [notification.id],
          messages: [notification.message],
        });
      }
      return;
    }

    singles.push({
      type: "single",
      id: `notification-${notification.id}`,
      notification,
      latestCreatedAt: notification.created_at,
    });
  });

  return [...singles, ...Array.from(bundles.values())].sort(
    (left, right) => new Date(right.latestCreatedAt).getTime() - new Date(left.latestCreatedAt).getTime()
  );
}

export function playNotificationChime() {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.14);
  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.2);
  oscillator.onended = () => {
    void context.close();
  };
}

export function pulseDevice() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(16);
  }
}

export function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
