import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import API from "../api/axios";
import { useToast } from "../components/ToastProvider";
import {
  CheckCircleIcon,
  ClockIcon,
  CompassIcon,
  LoadingSpinner,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  WalletIcon,
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

function getPlanMeta(name) {
  const normalized = String(name || "").toLowerCase();

  if (
    normalized.includes("netflix") ||
    normalized.includes("spotify") ||
    normalized.includes("prime") ||
    normalized.includes("hotstar") ||
    normalized.includes("youtube") ||
    normalized.includes("stream")
  ) {
    return { badge: "TV", label: "Streaming", toneClass: "is-streaming" };
  }

  if (
    normalized.includes("course") ||
    normalized.includes("udemy") ||
    normalized.includes("coursera") ||
    normalized.includes("academy") ||
    normalized.includes("class") ||
    normalized.includes("learn")
  ) {
    return { badge: "EDU", label: "Learning", toneClass: "is-learning" };
  }

  if (
    normalized.includes("figma") ||
    normalized.includes("adobe") ||
    normalized.includes("notion") ||
    normalized.includes("canva") ||
    normalized.includes("software") ||
    normalized.includes("chatgpt") ||
    normalized.includes("github")
  ) {
    return { badge: "APP", label: "Software", toneClass: "is-software" };
  }

  if (
    normalized.includes("membership") ||
    normalized.includes("club") ||
    normalized.includes("gym") ||
    normalized.includes("community")
  ) {
    return { badge: "VIP", label: "Membership", toneClass: "is-membership" };
  }

  return { badge: "SV", label: "Digital plan", toneClass: "is-default" };
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
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [pendingJoinGroup, setPendingJoinGroup] = useState(null);
  const toast = useToast();
  const fetchGroupsRef = useRef(null);

  useRevealOnScroll();

  const fetchGroups = async () => {
    try {
      const res = await API.get("groups/");
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load groups.", { title: "Couldn't load marketplace" });
    } finally {
      setLoading(false);
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
          `Joined successfully. ${formatCurrency(res.data?.charged_amount || group.join_price || group.price_per_slot)} was charged.${successFeeNote}${successNote}`.trim(),
          { title: "Joined split" }
        );
      } else {
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        toast.success(`${res.data?.message || "Joined successfully."}${successFeeNote}`.trim(), {
          title: "Joined group",
        });
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

  const stats = useMemo(() => {
    return groups.reduce(
      (acc, group) => {
        acc.total += 1;
        if (group.mode === "sharing") {
          acc.sharing += 1;
        } else {
          acc.groupBuy += 1;
        }
        if (group.filled_slots < group.total_slots) {
          acc.open += 1;
        }
        return acc;
      },
      { total: 0, sharing: 0, groupBuy: 0, open: 0 }
    );
  }, [groups]);

  const filterOptions = useMemo(
    () => [
      { value: "all", label: "All groups", count: stats.total },
      { value: "sharing", label: "Sharing", count: stats.sharing },
      { value: "group_buy", label: "Buy together", count: stats.groupBuy },
    ],
    [stats]
  );

  const searchSuggestions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return [];
    }

    const suggestionMap = new Map();

    groups.forEach((group) => {
      [
        { label: group.subscription_name || group.subscription, helper: group.mode_label },
        { label: group.owner_name, helper: "Host" },
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

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...groups]
      .filter((group) => {
        const matchesFilter = filter === "all" ? true : group.mode === filter;
        if (!matchesFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = [
          group.subscription_name,
          group.owner_name,
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
      .sort((left, right) => compareGroups(sortBy, left, right));
  }, [filter, groups, searchTerm, sortBy]);

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
        <section className="grid gap-4 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="sv-dark-hero sv-reveal">
            <p className="sv-eyebrow-on-dark">Marketplace</p>
            <h1 className="sv-display-on-dark mt-3 max-w-4xl sm:mt-4">
              Explore open groups with clearer status, cleaner pricing, and a faster path to join.
            </h1>
            <p className="mt-3 max-w-3xl text-[13px] leading-6 text-slate-200 sm:mt-5 sm:text-base sm:leading-8">
              Browse live sharing and buy-together groups, compare what you pay now, and see which
              plans are nearly full before you commit.
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5 sm:mt-8 sm:gap-2">
              <span className="sv-chip-dark">
                <SearchIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Search by plan or host
              </span>
              <span className="sv-chip-dark">
                <ClockIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Sort by urgency or price
              </span>
              <span className="sv-chip-dark">
                <WalletIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Wallet-backed joining
              </span>
              <span className="hidden sm:inline-flex sv-chip-dark">
                <ShieldIcon className="h-3.5 w-3.5" />
                Join review before payment
              </span>
            </div>

            <div className="sv-groups-hero-stats mt-5">
              <MarketHeroStat label="Open now" value={stats.open} note="ready to browse" />
              <MarketHeroStat label="Sharing" value={stats.sharing} note="existing plan hosts" />
              <MarketHeroStat label="Buy together" value={stats.groupBuy} note="group purchase flows" />
            </div>
          </div>

          <div className="sv-card sv-reveal sv-groups-panel">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="sv-eyebrow">Filter groups</p>
                <h2 className="mt-2 text-lg font-bold leading-tight text-slate-950 sm:mt-3 sm:text-2xl md:text-[1.9rem]">
                  Search, sort, and scan what matters
                </h2>
              </div>
              <span className="sv-chip">
                {filteredGroups.length} match{filteredGroups.length === 1 ? "" : "es"}
              </span>
            </div>

            <label className="mt-4 block sm:mt-5">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:mb-2 sm:text-xs">
                Search groups
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
                  placeholder="Netflix, Spotify, host name..."
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

            <div className="mt-4 flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <FilterButton
                  key={option.value}
                  active={filter === option.value}
                  count={option.count}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </FilterButton>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
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

              <div className="sv-groups-summary-strip">
                <span>{stats.total} total listed</span>
                <span>{stats.open} still open</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
              <StatCard label="Total groups" value={stats.total} />
              <StatCard label="Open now" value={stats.open} />
              <StatCard label="Sharing" value={stats.sharing} />
              <StatCard label="Buy together" value={stats.groupBuy} />
            </div>
          </div>
        </section>

        {loading ? (
          <section className="grid gap-4 xl:gap-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <article key={index} className="sv-skeleton-card space-y-4 rounded-[30px]">
                <div className="flex items-start gap-4">
                  <div className="sv-skeleton h-20 w-20 rounded-[24px]" />
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
              {(categoryChips.length > 0 ? categoryChips : ["Streaming", "Learning", "Software", "Membership"]).map(
                (item) => (
                  <span key={item} className="sv-group-empty-chip">
                    {item}
                  </span>
                )
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {(searchTerm || filter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
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

              return (
                <article
                  key={group.id}
                  className={`sv-group-card ${tone.key} ${index < 2 ? "sv-animate-rise" : index < 4 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}
                >
                  <div className="sv-group-card-shell">
                    <div className={`sv-group-icon ${planMeta.toneClass}`}>
                      <span>{planMeta.badge}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-[11px]">
                            {planMeta.label}
                          </p>
                          <h3 className="mt-1.5 truncate text-lg font-bold leading-tight text-slate-950 sm:text-2xl">
                            {group.subscription_name || group.subscription}
                          </h3>
                          <p className="mt-2 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
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

                      <div className="sv-group-owner-row">
                        <div className="flex items-center gap-3">
                          <span className="sv-group-owner-avatar">{getInitials(group.owner_name)}</span>
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              Hosted by {group.owner_name || "ShareVerse host"}
                            </p>
                            <p className="text-[12px] text-slate-500 sm:text-[13px]">{timelineLabel}</p>
                          </div>
                        </div>
                        <span className="sv-group-activity-pill">
                          {group.unread_chat_count > 0
                            ? `${group.unread_chat_count} unread chat${group.unread_chat_count === 1 ? "" : "s"}`
                            : activityLabel}
                        </span>
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

                      <div className="mt-4">
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
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap gap-2">
                            {Number(group.platform_fee_amount || 0) > 0 ? (
                              <span className="sv-group-inline-note">
                                Includes 5% platform fee: {formatCurrency(group.platform_fee_amount)}
                              </span>
                            ) : null}
                            {group.is_prorated ? (
                              <span className="sv-group-inline-note sv-group-inline-note-success">
                                Prorated pricing active
                              </span>
                            ) : null}
                          </div>
                          <p className="sv-group-next-action">{group.next_action}</p>
                        </div>

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
                </article>
              );
            })}
          </section>
        )}

        {spotlightGroup ? (
          <section className="sv-card-solid sv-reveal">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="sv-eyebrow">Browse by signal</p>
                <h2 className="sv-title mt-2">Popular categories worth checking next</h2>
              </div>
              <span className="sv-chip">
                Spotlight: {spotlightGroup.subscription_name || spotlightGroup.subscription}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(categoryChips.length > 0 ? categoryChips : ["Streaming", "Learning", "Software", "Membership"]).map(
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
  const ownerName = group.owner_name || "ShareVerse host";
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
            <span>{planMeta.badge}</span>
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
              <p className="mt-2 text-[12px] leading-6 text-slate-600 sm:text-[13px]">
                {group.next_action}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="sv-join-meta-pill">Plan: {planMeta.label}</span>
                <span className="sv-join-meta-pill">{totalSlots} total slot{totalSlots === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>

          <div className="sv-join-flow-card">
            <JoinFlowStep
              icon={<WalletIcon className="h-4 w-4" />}
              title={group.mode === "sharing" ? "Wallet charged now" : "Contribution held now"}
              body={
                group.mode === "sharing"
                  ? "You pay the displayed amount from wallet balance when you confirm."
                  : "Your wallet reserves the contribution while the group finishes setup."
              }
            />
            <JoinFlowStep
              icon={<CompassIcon className="h-4 w-4" />}
              title={group.mode === "sharing" ? "Host coordinates access" : "Group completes the purchase"}
              body={
                group.mode === "sharing"
                  ? "The host shares access after your join is accepted inside the split."
                  : "The organizer proceeds only after enough members commit to the group."
              }
            />
            <JoinFlowStep
              icon={<ShieldIcon className="h-4 w-4" />}
              title="ShareVerse records the confirmation"
              body="Funds are protected by the platform flow and only settle after confirmation."
            />
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

function FilterButton({ active, count, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`sv-groups-filter-button ${active ? "is-active" : ""}`}>
      <span>{children}</span>
      <span className="sv-groups-filter-count">{count}</span>
    </button>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="sv-groups-stat-card">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:text-xs">{label}</p>
      <p className="mt-1.5 text-xl font-bold text-slate-950 sm:mt-2 sm:text-2xl">{value}</p>
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

function JoinFlowStep({ icon, title, body }) {
  return (
    <div className="sv-join-flow-step">
      <span className="sv-join-flow-icon">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-[12px] leading-6 text-slate-600 sm:text-[13px]">{body}</p>
      </div>
    </div>
  );
}

function MarketHeroStat({ label, value, note }) {
  return (
    <div className="sv-counter-card">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-[11px]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">{value}</p>
      <p className="mt-2 text-[12px] leading-5 text-slate-300 sm:text-[13px] sm:leading-6">{note}</p>
    </div>
  );
}
