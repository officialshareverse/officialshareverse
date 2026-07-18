export function getCardTone(mode) {
  if (mode === "group_buy") {
    return {
      key: "is-buy",
      modeClass: "is-buy",
      buttonClass: "is-buy",
      progressClass: "is-buy",
    };
  }

  return {
    key: "is-sharing",
    modeClass: "is-sharing",
    buttonClass: "is-sharing",
    progressClass: "is-sharing",
  };
}

export function getPlanCategory(name) {
  const normalized = String(name || "").toLowerCase();

  if (
    normalized.includes("spotify") ||
    normalized.includes("music")
  ) {
    return "Music";
  }

  if (
    normalized.includes("netflix") ||
    normalized.includes("hotstar") ||
    normalized.includes("disney") ||
    normalized.includes("prime") ||
    normalized.includes("youtube") ||
    normalized.includes("jiocinema") ||
    normalized.includes("sonyliv") ||
    normalized.includes("video") ||
    normalized.includes("screen")
  ) {
    return "Streaming";
  }

  if (
    normalized.includes("coursera") ||
    normalized.includes("udemy") ||
    normalized.includes("duolingo") ||
    normalized.includes("course") ||
    normalized.includes("academy") ||
    normalized.includes("learn") ||
    normalized.includes("college")
  ) {
    return "Education";
  }

  if (
    normalized.includes("chatgpt") ||
    normalized.includes("claude") ||
    normalized.includes("midjourney") ||
    normalized.includes("ai") ||
    normalized.includes("gpt")
  ) {
    return "AI Tools";
  }

  if (
    normalized.includes("canva") ||
    normalized.includes("notion") ||
    normalized.includes("google one") ||
    normalized.includes("github") ||
    normalized.includes("figma") ||
    normalized.includes("workspace")
  ) {
    return "Productivity";
  }

  if (
    normalized.includes("xbox") ||
    normalized.includes("playstation") ||
    normalized.includes("nintendo") ||
    normalized.includes("game")
  ) {
    return "Gaming";
  }

  return "Streaming"; // default fallback
}

export function getPlanMeta(name) {
  const category = getPlanCategory(name);

  if (category === "Streaming") {
    return { badge: "TV", label: "Streaming", toneClass: "is-streaming", category };
  }

  if (category === "Education") {
    return { badge: "EDU", label: "Education", toneClass: "is-learning", category };
  }

  if (category === "AI Tools") {
    return { badge: "AI", label: "AI Tools", toneClass: "is-software", category };
  }

  if (category === "Productivity") {
    return { badge: "PRO", label: "Productivity", toneClass: "is-software", category };
  }
  
  if (category === "Gaming") {
    return { badge: "GAM", label: "Gaming", toneClass: "is-streaming", category };
  }
  
  if (category === "Music") {
    return { badge: "MUS", label: "Music", toneClass: "is-streaming", category };
  }

  return { badge: "SV", label: "Digital plan", toneClass: "is-default", category };
}

export function getStatusTone(status) {
  if (status === "active") {
    return { className: "is-active", dotClass: "is-active" };
  }
  if (status === "awaiting_purchase" || status === "proof_submitted") {
    return { className: "is-pending", dotClass: "is-pending" };
  }
  if (status === "closed" || status === "refunded" || status === "refunding") {
    return { className: "is-closed", dotClass: "is-closed" };
  }
  if (status === "disputed") {
    return { className: "is-alert", dotClass: "is-alert" };
  }

  return { className: "is-neutral", dotClass: "is-neutral" };
}

export function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

export function getCoverGradient(name) {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("netflix") || normalized.includes("youtube") || normalized.includes("hotstar") || normalized.includes("nintendo")) {
    return "bg-gradient-to-br from-red-500 to-rose-900";
  }
  if (normalized.includes("spotify") || normalized.includes("xbox")) {
    return "bg-gradient-to-br from-emerald-400 to-emerald-900";
  }
  if (normalized.includes("disney") || normalized.includes("prime") || normalized.includes("canva") || normalized.includes("playstation")) {
    return "bg-gradient-to-br from-blue-500 to-indigo-900";
  }
  if (normalized.includes("chatgpt") || normalized.includes("claude") || normalized.includes("midjourney") || normalized.includes("ai")) {
    return "bg-gradient-to-br from-purple-500 to-purple-900";
  }
  if (normalized.includes("notion") || normalized.includes("github")) {
    return "bg-gradient-to-br from-slate-700 to-slate-900";
  }
  return "bg-gradient-to-br from-slate-800 to-slate-900";
}

export function formatDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function getInitials(value) {
  return String(value || "ShareVerse Host")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function formatHostDisplayName(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("@")) {
    return "ShareVerse host";
  }

  const parts = raw
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "ShareVerse host";
  }

  const firstName = parts[0].slice(0, 1).toUpperCase() + parts[0].slice(1);
  if (parts.length > 1) {
    return `${firstName} ${parts[1].slice(0, 1).toUpperCase()}.`;
  }

  return firstName;
}

/**
 * Build a host-reputation display object from backend data.
 * Never fabricates ratings. Returns null when there are no reviews,
 * so the UI can render "New host" instead of a fake number.
 *
 * @param {number|null|undefined} ownerRating  - from group.owner_rating (null when no reviews)
 * @param {number} [ownerReviewCount=0]        - from group.owner_review_count
 * @returns {{ rating: string, reviewCount: number } | null}
 */
export function buildHostReputation(ownerRating, ownerReviewCount = 0) {
  const ratingNum = Number(ownerRating);
  const countNum = Number(ownerReviewCount) || 0;

  // No reviews yet — explicitly signal "new host" to the UI.
  if (!Number.isFinite(ratingNum) || countNum === 0 || ratingNum <= 0) {
    return null;
  }

  return {
    rating: ratingNum.toFixed(1),
    reviewCount: countNum,
  };
}
