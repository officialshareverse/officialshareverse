import { useEffect, useMemo, useRef, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import API from "../api/axios";
import { getPaginatedItems } from "../api/pagination";
import FirstVisitHint from "../components/FirstVisitHint";
import SubscriptionLogo from "../components/SubscriptionLogo";
import { useToast } from "../components/ToastProvider";
import {
  CheckCircleIcon,
  CompassIcon,
  LoadingSpinner,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
} from "../components/UiIcons";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "newest", label: "Newest" },
  { value: "cheapest", label: "Cheapest" },
  { value: "almost_full", label: "Almost full" },
];


function getCardTone(mode) {
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

function getPlanCategory(name) {
  const normalized = String(name || "").toLowerCase();

  if (
    normalized.includes("netflix") ||
    normalized.includes("spotify") ||
    normalized.includes("hotstar") ||
    normalized.includes("disney") ||
    normalized.includes("prime") ||
    normalized.includes("youtube") ||
    normalized.includes("jiocinema") ||
    normalized.includes("sonyliv") ||
    normalized.includes("family") ||
    normalized.includes("household") ||
    normalized.includes("screen") ||
    normalized.includes("music") ||
    normalized.includes("video")
  ) {
    return "subscriptions";
  }

  if (
    normalized.includes("coursera") ||
    normalized.includes("udemy") ||
    normalized.includes("duolingo") ||
    normalized.includes("course") ||
    normalized.includes("academy") ||
    normalized.includes("class") ||
    normalized.includes("learn")
  ) {
    return "courses";
  }

  if (
    normalized.includes("canva") ||
    normalized.includes("notion") ||
    normalized.includes("google one") ||
    normalized.includes("github") ||
    normalized.includes("software") ||
    normalized.includes("workspace") ||
    normalized.includes("design") ||
    normalized.includes("tool") ||
    normalized.includes("seat")
  ) {
    return "software";
  }

  if (
    normalized.includes("membership") ||
    normalized.includes("club") ||
    normalized.includes("gym") ||
    normalized.includes("community")
  ) {
    return "memberships";
  }

  return "subscriptions";
}

function getPlanMeta(name) {
  const category = getPlanCategory(name);

  if (category === "subscriptions") {
    return { badge: "TV", label: "Subscription", toneClass: "is-streaming", category };
  }

  if (category === "courses") {
    return { badge: "EDU", label: "Course", toneClass: "is-learning", category };
  }

  if (category === "software") {
    return { badge: "APP", label: "Software", toneClass: "is-software", category };
  }

  if (category === "memberships") {
    return { badge: "VIP", label: "Membership", toneClass: "is-membership", category };
  }

  return { badge: "SV", label: "Digital plan", toneClass: "is-default", category };
}

function getStatusTone(status) {
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

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function formatRelativeTime(value) {
  if (!value) {
    return "Updated recently";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Updated recently";
  }

  const deltaMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(deltaMs / 60000));

  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `Updated ${days}d ago`;
  }

  return `Updated ${new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })}`;
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getInitials(value) {
  return String(value || "ShareVerse Host")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatHostDisplayName(value) {
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

function getMockReputation(ownerName = "") {
  let hash = 0;
  for (let i = 0; i < ownerName.length; i++) {
    hash = ownerName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const rating = 4.7 + (Math.abs(hash) % 4) / 10;
  const hostedCount = 2 + (Math.abs(hash) % 24);
  return { rating: rating.toFixed(1), hostedCount };
}

function compareGroups(sortBy, left, right) {
  if (sortBy === "newest") {
    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  }

  if (sortBy === "cheapest") {
    return Number(left.join_price || 0) - Number(right.join_price || 0);
  }

  if (sortBy === "almost_full") {
    const leftRemaining = Math.max(Number(left.remaining_slots ?? left.total_slots - left.filled_slots) || 0, 0);
    const rightRemaining = Math.max(Number(right.remaining_slots ?? right.total_slots - right.filled_slots) || 0, 0);

    if (leftRemaining !== rightRemaining) {
      return leftRemaining - rightRemaining;
    }

    return Number(right.progress_percent || 0) - Number(left.progress_percent || 0);
  }

  const popularityLeft = Number(left.progress_percent || 0) * 100 + Number(left.filled_slots || 0);
  const popularityRight = Number(right.progress_percent || 0) * 100 + Number(right.filled_slots || 0);

  return popularityRight - popularityLeft;
}

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const isMobile = useIsMobile();
  const [sortBy, setSortBy] = useState("popular");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [pendingJoinGroup, setPendingJoinGroup] = useState(null);
  const [expandedMobileCardId, setExpandedMobileCardId] = useState(null);
  const toast = useToast();
  const fetchGroupsRef = useRef(null);

  useRevealOnScroll();

  const fetchGroups = async (pageToFetch = 1) => {
    try {
      if (pageToFetch === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await API.get("groups/", { params: { page: pageToFetch, page_size: 50 } });
      const newItems = getPaginatedItems(res.data);
      
      if (pageToFetch === 1) {
        setGroups(newItems);
      } else {
        setGroups((current) => [...current, ...newItems]);
      }
      
      setHasMore(!!res.data?.next || newItems.length === 50);
      setPage(pageToFetch);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load groups.", { title: "Couldn't load marketplace" });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  fetchGroupsRef.current = fetchGroups;

  useEffect(() => {
    fetchGroupsRef.current?.();
  }, []);

  

  useEffect(() => {
    if (!pendingJoinGroup) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pendingJoinGroup]);

  useEffect(() => {
    if (!pendingJoinGroup) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [pendingJoinGroup]);

  const joinGroup = async (group) => {
    try {
      setJoiningId(group.id);
      const res = await API.post("join-group/", { group_id: group.id });
      if (group.mode === "sharing") {
        const successNote = res.data?.pricing_note ? ` ${res.data.pricing_note}` : "";
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        toast.success(
          `Rs ${res.data?.charged_amount || group.join_price || group.price_per_slot} charged → Status: Held → Waiting for access confirmation.${successFeeNote}${successNote}`.trim(),
          { title: "Joined split" }
        );
      } else {
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        toast.success(
          `Contribution reserved → Status: Held → Waiting for group completion.${successFeeNote}`.trim(),
          { title: "Joined group" }
        );
      }

      setPendingJoinGroup(null);
      fetchGroups();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Join failed.", { title: "Couldn't join group" });
    } finally {
      setJoiningId(null);
    }
  };





  const searchSuggestions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return [];
    }

    const suggestionMap = new Map();

    groups.forEach((group) => {
      [
        { label: group.subscription_name || group.subscription, helper: group.mode_label },
        { label: formatHostDisplayName(group.owner_name), helper: "Host" },
      ]
        .filter((item) => item.label)
        .forEach((item) => {
          const key = item.label.trim();
          if (!key || !key.toLowerCase().includes(normalizedSearch)) {
            return;
          }

          if (!suggestionMap.has(key)) {
            suggestionMap.set(key, item);
          }
        });
    });

    return Array.from(suggestionMap.values()).slice(0, 6);
  }, [groups, searchTerm]);

  const effectiveSortBy = isMobile ? "popular" : sortBy;

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...groups]
      .filter((group) => {
        const planMeta = getPlanMeta(group.subscription_name || group.subscription);
        const matchesCategory = categoryFilter === "all" ? true : planMeta.category === categoryFilter;
        if (!matchesCategory) {
          return false;
        }

        const matchesFilter = filter === "all" ? true : group.mode === filter;
        if (!matchesFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = [
          group.subscription_name,
          formatHostDisplayName(group.owner_name),
          group.mode_label,
          group.status_label,
          group.mode_description,
          group.next_action,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => compareGroups(effectiveSortBy, left, right));
  }, [categoryFilter, effectiveSortBy, filter, groups, searchTerm]);

  const spotlightGroup = filteredGroups[0] || groups[0] || null;
  const categoryChips = useMemo(() => {
    const labels = new Set(groups.map((group) => getPlanMeta(group.subscription_name || group.subscription).label));
    return Array.from(labels).slice(0, 4);
  }, [groups]);

  const pendingJoinSummary = pendingJoinGroup
    ? {
        amount: pendingJoinGroup.join_price || pendingJoinGroup.price_per_slot,
        subtotal: pendingJoinGroup.join_subtotal || pendingJoinGroup.price_per_slot,
        platformFee: pendingJoinGroup.platform_fee_amount || 0,
      }
    : null;

  return (
    <div className="sv-page">
      {pendingJoinGroup && typeof document !== "undefined"
        ? createPortal(
            <JoinConfirmModal
              group={pendingJoinGroup}
              summary={pendingJoinSummary}
              joiningId={joiningId}
              onCancel={() => setPendingJoinGroup(null)}
              onConfirm={joinGroup}
            />,
            document.body
          )
        : null}

      <div className="sv-container space-y-4 sm:space-y-6">
        <section className="mx-auto max-w-3xl">
          <div className={`sv-card sv-reveal sv-groups-panel ${isMobile ? "is-mobile" : ""}`}>
            <label className={`block ${isMobile ? "sv-groups-panel-search" : ""}`}>
              <span className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:mb-2 sm:text-xs ${isMobile ? "sv-groups-search-label" : ""}`}>
                {isMobile ? "Plan or host" : "Search groups"}
              </span>
              <div className="sv-groups-search-shell">
                <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setSearchFocused(false), 120);
                  }}
                  placeholder={isMobile ? "Search plan..." : "Netflix, Spotify, Canva, host name..."}
                  className="sv-groups-search-input"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="sv-groups-clear-button"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {searchFocused && searchSuggestions.length > 0 ? (
                <div className="sv-groups-search-suggestions">
                  {searchSuggestions.map((item) => (
                    <button
                      key={`${item.helper}-${item.label}`}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setSearchTerm(item.label);
                        setSearchFocused(false);
                      }}
                      className="sv-groups-suggestion-item"
                    >
                      <span className="font-semibold text-slate-900">{item.label}</span>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        {item.helper}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <div className="mt-4">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:mb-2 sm:text-xs">
                  Sort by
                </span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="sv-groups-sort-select"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        <FirstVisitHint
          storageKey="explore-v1"
          title="These are live groups people have created"
          body="Tap any card to see pricing and join with your wallet balance. Filter by type, search by plan name, and sort by what matters most."
        />

        {loading ? (
          <section className="grid gap-4 xl:gap-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <article key={index} className="sv-skeleton-card space-y-4 rounded-[length:var(--sv-radius-card-md)]">
                <div className="flex items-start gap-4">
                  <div className="sv-skeleton h-20 w-20 rounded-[length:var(--sv-radius-card)]" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="sv-skeleton h-3 w-24" />
                    <div className="sv-skeleton h-10 w-2/3 rounded-[16px]" />
                    <div className="sv-skeleton h-4 w-full" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sv-skeleton h-20 w-full rounded-[18px]" />
                      <div className="sv-skeleton h-20 w-full rounded-[18px]" />
                    </div>
                  </div>
                </div>
                <div className="sv-skeleton h-2.5 w-full rounded-full" />
                <div className="sv-skeleton h-12 w-full rounded-full" />
              </article>
            ))}
          </section>
        ) : filteredGroups.length === 0 ? (
          <div className="sv-empty-state sv-group-empty-state">
            <div className="sv-empty-icon">
              <CompassIcon className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-slate-900">
              {searchTerm ? "No groups match that search yet." : "No groups match this view yet."}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-7 text-slate-500">
              Try another filter, browse a different category, or open your own split if you do not
              see the plan you want right now.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {(categoryChips.length > 0 ? categoryChips : ["Digital plan", "Learning", "Software", "Membership"]).map(
                (item) => (
                  <span key={item} className="sv-group-empty-chip">
                    {item}
                  </span>
                )
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {(searchTerm || filter !== "all" || categoryFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("all");
                    setFilter("all");
                    setSortBy("popular");
                  }}
                  className="sv-btn-secondary justify-center text-[13px] sm:text-sm"
                >
                  Reset filters
                </button>
              )}
              <Link to="/create" className="sv-btn-primary justify-center text-[13px] sm:text-sm">
                Create your own split
              </Link>
            </div>
          </div>
        ) : (
          <section className="sv-group-grid">
            {filteredGroups.map((group, index) => {
              const filledSlots = Number(group.filled_slots || 0);
              const totalSlots = Math.max(Number(group.total_slots || 1), 1);
              const remainingSlots = Math.max(Number(group.remaining_slots ?? totalSlots - filledSlots) || 0, 0);
              const isFull = filledSlots >= totalSlots;
              const isHot = !isFull && remainingSlots <= 1;
              const tone = getCardTone(group.mode);
              const statusTone = getStatusTone(group.status);
              const planMeta = getPlanMeta(group.subscription_name || group.subscription);
              const progress = Math.min(100, Number(group.progress_percent || Math.round((filledSlots / totalSlots) * 100)));
              const activityLabel = formatRelativeTime(group.created_at);
              const hostDisplayName = formatHostDisplayName(group.owner_name);
              const hostReputation = getMockReputation(group.owner_name);
              const timelineLabel =
                group.mode === "group_buy"
                  ? formatDate(group.purchase_deadline_at)
                    ? `Purchase target ${formatDate(group.purchase_deadline_at)}`
                    : formatDate(group.auto_refund_at)
                      ? `Auto refund ${formatDate(group.auto_refund_at)}`
                      : activityLabel
                  : formatDate(group.end_date)
                    ? `Runs through ${formatDate(group.end_date)}`
                    : activityLabel;
              const isMobileExpanded = expandedMobileCardId === group.id;

              return (
                <article
                  key={group.id}
                  className={`sv-group-card ${tone.key} ${isMobileExpanded ? "is-mobile-open" : ""} ${index < 2 ? "sv-animate-rise" : index < 4 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}
                >
                  <div className="sv-group-card-shell">
                    <div className={`sv-group-icon ${planMeta.toneClass}`}>
                      <SubscriptionLogo name={group.subscription_name || group.subscription} size="100%" className="w-full h-full" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
                            {planMeta.label}
                          </p>
                          <h3 className="mt-1 truncate text-base font-bold leading-tight text-slate-950 sm:mt-1.5 sm:text-2xl">
                            {group.subscription_name || group.subscription}
                          </h3>
                          <p className="sv-group-card-description mt-2 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                            {group.mode_description}
                          </p>
                        </div>

                        <div className="sv-group-badge-row">
                          <span className={`sv-group-mode-pill ${tone.modeClass}`}>{group.mode_label}</span>
                          <span className={`sv-group-status-pill ${statusTone.className}`}>
                            <span className={`sv-group-status-dot ${statusTone.dotClass}`} />
                            {group.status_label}
                          </span>
                          {isHot ? (
                            <span className="sv-group-urgency-pill">
                              <SparkIcon className="h-3.5 w-3.5" />
                              1 slot left
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="sv-group-mobile-summary">
                        <div className="sv-group-mobile-summary-item">
                          <span className="sv-group-mobile-summary-label">
                            {group.is_prorated ? "Pay now" : "Join price"}
                          </span>
                          <span className="sv-group-mobile-summary-value">{formatCurrency(group.join_price)}</span>
                        </div>
                        <div className="sv-group-mobile-summary-item">
                          <span className="sv-group-mobile-summary-label">Slots left</span>
                          <span className="sv-group-mobile-summary-value">{remainingSlots}</span>
                        </div>
                        {!isMobile ? (
                          <div className="sv-group-mobile-summary-item">
                            <span className="sv-group-mobile-summary-label">Filled</span>
                            <span className="sv-group-mobile-summary-value">{progress}%</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="sv-group-owner-row">
                        <div className="flex w-full items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="sv-group-owner-avatar">{getInitials(hostDisplayName)}</span>
                            <div>
                              <p className="text-sm font-semibold text-slate-950">
                                Hosted by {hostDisplayName}
                              </p>
                              <p className="mt-0.5 text-[12px] font-semibold text-amber-600 sm:text-[13px]">
                                ★ {hostReputation.rating} • {hostReputation.hostedCount} groups hosted
                              </p>
                              <p className="mt-0.5 text-[12px] text-slate-500 sm:text-[13px]">{timelineLabel}</p>
                            </div>
                          </div>
                          <span className="sv-group-activity-pill mt-1 shrink-0">
                            {group.unread_chat_count > 0
                              ? `${group.unread_chat_count} unread`
                              : activityLabel}
                          </span>
                        </div>
                      </div>

                      <div className="sv-group-metric-grid">
                        <MetricTile
                          label={group.is_prorated ? "Pay now" : "Join price"}
                          value={formatCurrency(group.join_price)}
                        />
                        <MetricTile
                          label="Plan contribution"
                          value={formatCurrency(group.join_subtotal || group.price_per_slot)}
                        />
                        <MetricTile label="Slots filled" value={`${filledSlots}/${totalSlots}`} />
                        <MetricTile
                          label={group.mode === "group_buy" ? "Remaining slots" : "Paid members"}
                          value={group.mode === "group_buy" ? `${remainingSlots}` : `${group.paid_members || 0}`}
                        />
                      </div>

                      <div className="sv-group-progress-section mt-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                            Group fill
                          </p>
                          <span className="sv-group-progress-value">{progress}%</span>
                        </div>
                        <div className="sv-group-progress-track">
                          <span
                            className={`sv-group-progress-fill ${tone.progressClass} ${progress >= 80 ? "is-hot" : ""}`}
                            style={{ "--sv-progress": `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="sv-group-footer">
                        <div className="min-w-0 sv-group-footer-copy">
                          <div className="mb-2 flex flex-wrap gap-2">
                            {Number(group.platform_fee_amount || 0) > 0 ? (
                              <span className="sv-group-inline-note">
                                Includes 5% platform fee: {formatCurrency(group.platform_fee_amount)}
                              </span>
                            ) : null}
                            {group.is_prorated ? (
                              <span className="sv-group-inline-note sv-group-inline-note-success">
                                If you join mid-month, you only pay for the remaining days
                              </span>
                            ) : null}
                          </div>
                          <p className="sv-group-next-action">{group.next_action}</p>
                        </div>

                        <div className="sv-group-footer-actions">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedMobileCardId((current) => (current === group.id ? null : group.id))
                            }
                            className="sv-group-mobile-toggle"
                            aria-expanded={isMobileExpanded}
                          >
                            <span>{isMobileExpanded ? "Hide details" : "Details"}</span>
                            <span className={`sv-group-mobile-chevron ${isMobileExpanded ? "is-open" : ""}`} aria-hidden="true">
                              ▾
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPendingJoinGroup(group)}
                            disabled={isFull || joiningId === group.id}
                            className={`sv-group-join-button ${isFull ? "is-disabled" : tone.buttonClass}`}
                          >
                            {joiningId === group.id ? (
                              <>
                                <LoadingSpinner />
                                Joining...
                              </>
                            ) : isFull ? (
                              "Group full"
                            ) : (
                              <>
                                <SparkIcon className="h-4 w-4" />
                                {group.join_cta}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {hasMore && !loading && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => fetchGroups(page + 1)}
              disabled={loadingMore}
              className="sv-btn-secondary"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}

        {spotlightGroup && !isMobile ? (
          <section className="sv-card-solid sv-reveal">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="sv-eyebrow">Browse by signal</p>
                  <h2 className="sv-title mt-2">Categories worth checking next</h2>
                </div>
                <span className="sv-chip">
                  Example listing: {spotlightGroup.subscription_name || spotlightGroup.subscription}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
              {(categoryChips.length > 0 ? categoryChips : ["Digital plan", "Learning", "Software", "Membership"]).map(
                  (item) => (
                    <button
                    key={item}
                    type="button"
                    onClick={() => setSearchTerm(item)}
                    className="sv-group-empty-chip"
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function JoinConfirmModal({ group, summary, joiningId, onCancel, onConfirm }) {
  const tone = getCardTone(group.mode);
  const statusTone = getStatusTone(group.status);
  const planMeta = getPlanMeta(group.subscription_name || group.subscription);
  const planName = group.subscription_name || group.subscription;
  const ownerName = formatHostDisplayName(group.owner_name);
  const hostReputation = getMockReputation(group.owner_name);
  const totalSlots = Number(group.total_slots || 0);
  const filledSlots = Number(group.filled_slots || 0);
  const remainingSlots = Math.max(Number(group.remaining_slots ?? (totalSlots - filledSlots)) || 0, 0);
  const cycleLabel = [formatDate(group.start_date), formatDate(group.end_date)].filter(Boolean).join(" - ");
  const payNowLabel =
    group.mode === "group_buy"
      ? "Contribute now"
      : group.is_prorated
        ? "Pay now for the remaining cycle"
        : "Pay now";

  return (
    <div className="sv-modal-backdrop">
      <div className="sv-confirm-modal sv-join-modal sv-animate-rise">
        <div className="sv-join-topbar">
          <p className="sv-eyebrow">Join confirmation</p>
          <button type="button" onClick={onCancel} className="sv-join-close-button">
            Close
          </button>
        </div>

        <div className="sv-join-hero">
          <div className={`sv-group-icon ${planMeta.toneClass} shrink-0 sv-join-hero-icon`}>
            <SubscriptionLogo name={planName} size="100%" className="w-full h-full" />
          </div>

          <div className="min-w-0 flex-1 sv-join-hero-copy">
            <div className="flex flex-wrap gap-2">
              <span className={`sv-group-mode-pill ${tone.modeClass}`}>{group.mode_label}</span>
              <span className={`sv-group-status-pill ${statusTone.className}`}>
                <span className={`sv-group-status-dot ${statusTone.dotClass}`} />
                {group.status_label}
              </span>
              <span className="sv-join-meta-pill">{planMeta.label}</span>
            </div>

            <h2 className="mt-3 text-xl font-bold leading-tight text-slate-950 sm:text-[2rem]">
              Review before you join
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-900 sm:text-[15px]">{planName}</p>
            <p className="sv-join-support-copy">
              {group.mode === "sharing"
                ? "Your wallet is charged now. The host shares access next, and funds are released after access confirmation inside ShareVerse."
                : "Your contribution is reserved now. The purchase only moves forward after the buy-together flow is completed and confirmed."}
            </p>
          </div>
        </div>

        <div className="sv-join-breakdown">
          <BreakdownCard
            featured
            label={payNowLabel}
            value={formatCurrency(summary.amount)}
            note={
              group.mode === "sharing"
                ? "This amount is charged from your wallet when you confirm this join."
                : "This contribution is reserved until the buy-together flow completes."
            }
          />
          <BreakdownCard label="Plan contribution" value={formatCurrency(summary.subtotal)} />
          <BreakdownCard label="Platform fee" value={formatCurrency(summary.platformFee)} />
          <BreakdownCard
            label={group.mode === "group_buy" ? "Members still needed" : "Slots left"}
            value={`${remainingSlots}`}
            note={`${filledSlots}/${totalSlots} filled`}
          />
          <BreakdownCard
            label="Current cycle"
            value={cycleLabel || "Dates shared after join"}
            note={group.pricing_note ? "Proration is already applied here." : "Matches the current plan cycle."}
          />
        </div>

        <div className="sv-join-info-grid">
          <div className="sv-join-host-row">
            <span className="sv-group-owner-avatar">{getInitials(ownerName)}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Hosted by</p>
              <p className="mt-1 text-sm font-semibold text-slate-950 sm:text-[15px]">{ownerName}</p>
              <p className="mt-0.5 text-[12px] font-semibold text-amber-600 sm:text-[13px]">
                ★ {hostReputation.rating} • {hostReputation.hostedCount} groups hosted
              </p>
              <p className="mt-1.5 text-[12px] leading-6 text-slate-600 sm:text-[13px]">
                {group.next_action}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="sv-join-meta-pill">Plan: {planMeta.label}</span>
                <span className="sv-join-meta-pill">{totalSlots} total slot{totalSlots === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>

          <div className="sv-join-flow-card">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">How your money is protected</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">1</span>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(summary.amount)} held safely</p>
              </div>
              <div className="ml-3 h-4 w-[2px] bg-slate-200" />
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">2</span>
                <p className="text-sm font-medium text-slate-700">{group.mode === "sharing" ? "Host confirms your access" : "Host completes the purchase"}</p>
              </div>
              <div className="ml-3 h-4 w-[2px] bg-slate-200" />
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">3</span>
                <p className="text-sm font-medium text-emerald-800">You confirm access &amp; funds release</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-amber-50 p-3 border border-amber-200">
              <p className="text-xs font-semibold text-amber-800">If the host doesn't deliver, you can report an issue and your funds are protected.</p>
            </div>
          </div>
        </div>

        {group.pricing_note ? (
          <div className="sv-security-badge sv-security-badge-success">{group.pricing_note}</div>
        ) : null}

        <div className="sv-security-badge">
          <ShieldIcon className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">Wallet secured through Razorpay</p>
            <p className="mt-1 text-[12px] leading-6 text-slate-600 sm:text-[13px]">
              Top up before joining if needed. Your balance is used here only after you confirm this step.
            </p>
          </div>
        </div>

        <div className="sv-join-footer">
          <div className="sv-join-footer-copy">
            <p>You can still cancel here and go back to browsing without joining.</p>
          </div>
          <div className="sv-join-footer-actions">
            <button
              type="button"
              onClick={onCancel}
              className="sv-btn-secondary sv-join-cancel-button w-full justify-center text-[13px] sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(group)}
              disabled={joiningId === group.id}
              className="sv-btn-primary sv-join-confirm-button w-full justify-center text-[13px] sm:w-auto sm:text-sm"
            >
              {joiningId === group.id ? (
                <>
                  <LoadingSpinner />
                  Joining...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  Confirm and join
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



function MetricTile({ label, value }) {
  return (
    <div className="sv-group-metric-tile">
      <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-950 sm:text-[15px]">{value}</p>
    </div>
  );
}

function BreakdownCard({ label, value, note, featured = false }) {
  return (
    <div className={`sv-join-breakdown-card ${featured ? "is-featured" : ""}`}>
      <p className="sv-join-breakdown-label">{label}</p>
      <p className="sv-join-breakdown-value">{value}</p>
      {note ? <p className="sv-join-breakdown-note">{note}</p> : null}
    </div>
  );
}


