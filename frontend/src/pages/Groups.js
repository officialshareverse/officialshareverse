import { useEffect, useMemo, useRef, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import API from "../api/axios";
import { getPaginatedItems } from "../api/pagination";
import SubscriptionLogo from "../components/SubscriptionLogo";
import { useToast } from "../components/ToastProvider";
import {
  CheckCircleIcon,
  CompassIcon,
  LoadingSpinner,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  PlayIcon,
  AcademicCapIcon,
  GridIcon,
  MusicIcon,
  ControllerIcon,
  UserIcon
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

function getPlanMeta(name) {
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

function getCoverGradient(name) {
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


  const pendingJoinSummary = pendingJoinGroup
    ? {
        amount: pendingJoinGroup.join_price || pendingJoinGroup.price_per_slot,
        subtotal: pendingJoinGroup.join_subtotal || pendingJoinGroup.price_per_slot,
        platformFee: pendingJoinGroup.platform_fee_amount || 0,
      }
    : null;

  return (
    <div className="sv-page pb-24 sm:pb-8">
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
        {/* HERO BANNER */}
        <section className="relative rounded-2xl sm:rounded-4xl mb-6 sm:mb-8 mt-4 -mx-4 sm:mx-0 flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6 lg:gap-8 px-5 py-5 sm:px-10 lg:py-8 shadow-sm sv-glass-panel sv-animate-rise z-30 overflow-hidden">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-100 dark:from-emerald-900/30 to-teal-50 dark:to-teal-900/30 opacity-50 blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 shrink-0 text-left w-full lg:w-auto xl:pl-2">
            <h1 className="text-[26px] leading-[1.2] sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[2.2rem] sm:leading-[1.15]">
              Find your next <br className="hidden lg:block" />
              <span className="text-emerald-600 dark:text-emerald-400 ml-1 lg:ml-0">subscription.</span>
            </h1>
            <p className="mt-2 text-[13px] sm:text-sm font-medium text-slate-600 dark:text-slate-300">
              Join premium services at a fraction of the cost.
            </p>
          </div>

          <div className="relative z-20 w-full max-w-[28rem] xl:max-w-[32rem] flex-1 lg:mx-6 xl:mx-10 mt-1 sm:mt-2 lg:mt-0">
            <div className="flex w-full items-center gap-3 rounded-full bg-white px-4 sm:px-5 py-3 sm:py-3.5 shadow-md focus-within:ring-2 focus-within:ring-brand-light transition-all">
              <SearchIcon className="h-5 w-5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => {
                  window.setTimeout(() => setSearchFocused(false), 120);
                }}
                placeholder="Search Netflix, Spotify, Canva, host name..."
                className="w-full bg-transparent text-slate-900 placeholder-slate-400 outline-none sm:text-[15px]"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} className="text-slate-400 hover:text-slate-600">
                  <span className="sr-only">Clear</span>
                  &times;
                </button>
              )}
            </div>

            {searchFocused && searchSuggestions.length > 0 ? (
              <div className="absolute mt-2 w-full rounded-2xl border border-slate-100 bg-white p-2 shadow-xl z-50">
                {searchSuggestions.map((item) => (
                  <button
                    key={`${item.helper}-${item.label}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setSearchTerm(item.label);
                      setSearchFocused(false);
                    }}
                    className="flex w-full flex-col rounded-xl px-4 py-2.5 text-left transition-colors hover:bg-slate-50 focus:bg-slate-50 outline-none"
                  >
                    <span className="font-semibold text-slate-900">{item.label}</span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {item.helper}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* CATEGORY & SORT ROW */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky z-20" style={{ top: '4.5rem' }}>
          <div className="flex-1 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
            <div className="flex items-center gap-2 sm:gap-3 min-w-max">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  categoryFilter === "all" ? "bg-brand text-white shadow-md" : "bg-white text-slate-700 shadow-sm hover:bg-slate-50 border border-slate-200/60"
                }`}
              >
                {categoryFilter === "all" ? <SparkIcon className="h-4 w-4" /> : null} All
              </button>
              
              {[
                { id: "Streaming", icon: PlayIcon },
                { id: "Education", icon: AcademicCapIcon },
                { id: "AI Tools", icon: SparkIcon },
                { id: "Productivity", icon: GridIcon },
                { id: "Music", icon: MusicIcon },
                { id: "Gaming", icon: ControllerIcon }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                    categoryFilter === cat.id ? "bg-brand text-white shadow-md" : "bg-white text-slate-700 shadow-sm hover:bg-slate-50 border border-slate-200/60"
                  }`}
                >
                  <cat.icon className="h-4 w-4" />
                  {cat.id}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full sm:w-auto shrink-0 flex items-center bg-white rounded-full border border-slate-200/60 shadow-sm px-4 py-2.5">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 outline-none border-none pr-6 cursor-pointer appearance-none w-full sm:w-36"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em' }}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

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
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {filteredGroups.map((group, index) => {
              const filledSlots = Number(group.filled_slots || 0);
              const totalSlots = Math.max(Number(group.total_slots || 1), 1);
              const remainingSlots = Math.max(Number(group.remaining_slots ?? totalSlots - filledSlots) || 0, 0);
              const isFull = filledSlots >= totalSlots;
              const isHot = !isFull && remainingSlots <= 1;
              const planMeta = getPlanMeta(group.subscription_name || group.subscription);
              const hostDisplayName = formatHostDisplayName(group.owner_name);

              return (
                <article
                  key={group.id}
                  className={`relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-row sm:flex-col h-[104px] sm:h-auto ${index < 2 ? "sv-animate-rise" : index < 4 ? "sv-animate-rise sv-delay-1" : "sv-animate-rise sv-delay-2"}`}
                >
                  <div className={`w-28 sm:w-full shrink-0 h-full sm:h-28 relative flex items-center justify-center sm:block ${getCoverGradient(group.subscription_name || group.subscription)}`}>
                    <div className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-white/20 backdrop-blur-md rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[8px] sm:text-[10px] font-bold text-white uppercase tracking-wider">
                      {isHot ? "Hot" : "Pop"}
                    </div>
                    
                    <div className="sm:absolute sm:top-20 sm:left-5 h-12 w-12 sm:h-14 sm:w-14 rounded-xl sm:rounded-2xl bg-white p-1 shadow-sm border sm:border-2 border-white z-10 flex items-center justify-center overflow-hidden">
                      <SubscriptionLogo name={group.subscription_name || group.subscription} size="100%" className="w-full h-full rounded-lg sm:rounded-xl" />
                    </div>
                  </div>

                  <div className="flex-1 p-3 sm:pt-10 sm:px-5 sm:pb-5 flex flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <h3 className="text-[14px] sm:text-base font-bold text-slate-900 truncate">{group.subscription_name || group.subscription}</h3>
                          <CheckCircleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] sm:text-xs font-medium text-slate-500 truncate">{planMeta.category} • Host: {hostDisplayName}</p>
                          <span className="text-[10px] sm:hidden font-semibold text-amber-500 shrink-0">
                            ★ {getMockReputation(group.owner_name).rating}
                          </span>
                        </div>
                      </div>
                      <p className="text-[13px] sm:text-sm font-bold text-slate-900 shrink-0">
                        ₹{Number(group.join_price).toFixed(0)}
                      </p>
                    </div>
                    
                    <div className="hidden sm:flex mt-3 sm:mt-4 items-center gap-1.5 border-t border-slate-100 pt-3 sm:pt-4">
                      <UserIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <p className="text-[11px] sm:text-xs text-slate-600 truncate">Host: {hostDisplayName}</p>
                      <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="ml-auto text-[11px] sm:text-xs font-semibold text-amber-500 flex items-center gap-0.5">
                        ★ {getMockReputation(group.owner_name).rating}
                      </span>
                    </div>
                    
                    <div className="mt-2 sm:mt-auto pt-2 sm:pt-5 border-t border-slate-100 sm:border-none flex items-center justify-between gap-2">
                      <span className="rounded-md bg-emerald-50 px-2 py-1 sm:px-2.5 sm:py-1.5 text-[10px] sm:text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                        {remainingSlots} left
                      </span>
                      <button
                        onClick={() => setPendingJoinGroup(group)}
                        disabled={isFull || joiningId === group.id}
                        className={`rounded-full px-3 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold text-white transition-colors whitespace-nowrap ${isFull ? "bg-slate-300" : "bg-brand hover:bg-brand-dark"}`}
                      >
                        {joiningId === group.id ? "Wait" : isFull ? "Full" : "Join"}
                      </button>
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


function BreakdownCard({ label, value, note, featured = false }) {
  return (
    <div className={`sv-join-breakdown-card ${featured ? "is-featured" : ""}`}>
      <p className="sv-join-breakdown-label">{label}</p>
      <p className="sv-join-breakdown-value">{value}</p>
      {note ? <p className="sv-join-breakdown-note">{note}</p> : null}
    </div>
  );
}


