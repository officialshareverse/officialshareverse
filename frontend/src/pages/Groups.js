import { useEffect, useMemo, useState } from "react";

import API from "../api/axios";
import { CheckCircleIcon, ClockIcon, CompassIcon, LoadingSpinner, SearchIcon, ShieldIcon, SparkIcon, WalletIcon } from "../components/UiIcons";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

function getCardTone(mode) {
  if (mode === "group_buy") {
    return {
      chip: "bg-amber-100 text-amber-800",
      rail: "bg-amber-500",
      soft: "border-amber-200 bg-amber-50/50",
    };
  }

  return {
    chip: "bg-sky-100 text-sky-800",
    rail: "bg-sky-700",
    soft: "border-sky-200 bg-sky-50/50",
  };
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingJoinGroup, setPendingJoinGroup] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  useRevealOnScroll();

  const fetchGroups = async () => {
    try {
      const res = await API.get("groups/");
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to load groups." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const joinGroup = async (group) => {
    try {
      setFeedback({ type: "", message: "" });
      setJoiningId(group.id);
      const res = await API.post("join-group/", { group_id: group.id });
      if (group.mode === "sharing") {
        const successNote = res.data?.pricing_note ? `\n${res.data.pricing_note}` : "";
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? `\nThis included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        setFeedback({
          type: "success",
          message: `Joined successfully. ${formatCurrency(res.data?.charged_amount || group.join_price || group.price_per_slot)} was charged.${successFeeNote.replace("\n", " ")}${successNote.replace("\n", " ")}`.trim(),
        });
      } else {
        const successFeeNote =
          Number(res.data?.platform_fee_amount || 0) > 0
            ? `\nThis included a 5% platform fee of Rs ${Number(res.data?.platform_fee_amount || 0).toFixed(2)}.`
            : "";
        setFeedback({
          type: "success",
          message: `${res.data?.message || "Joined successfully."}${successFeeNote.replace("\n", " ")}`.trim(),
        });
      }

      setPendingJoinGroup(null);
      fetchGroups();
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: err.response?.data?.error || "Join failed." });
    } finally {
      setJoiningId(null);
    }
  };

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return groups.filter((group) => {
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
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [filter, groups, searchTerm]);

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

  const pendingJoinSummary = pendingJoinGroup
    ? {
        amount: pendingJoinGroup.join_price || pendingJoinGroup.price_per_slot,
        subtotal: pendingJoinGroup.join_subtotal || pendingJoinGroup.price_per_slot,
        platformFee: pendingJoinGroup.platform_fee_amount || 0,
      }
    : null;

  return (
    <div className="sv-page">
      {pendingJoinGroup ? (
        <div className="sv-modal-backdrop px-3 py-6">
          <div className="sv-confirm-modal">
            <p className="sv-eyebrow">Join confirmation</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">
              {pendingJoinGroup.mode === "sharing" ? "Review this split before you join" : "Review this buy-together join"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {pendingJoinGroup.mode === "sharing"
                ? "Your wallet will be charged now, then the host coordinates access. The host is credited only after you confirm access inside ShareVerse."
                : "Your contribution is held first. The group moves forward only after the buy-together flow is complete."}
            </p>

            <div className="mt-5 space-y-3">
              <InlineMetric label="Plan" value={pendingJoinGroup.subscription_name || pendingJoinGroup.subscription} />
              <InlineMetric label="Pay now" value={formatCurrency(pendingJoinSummary.amount)} />
              <InlineMetric label="Plan contribution" value={formatCurrency(pendingJoinSummary.subtotal)} />
              <InlineMetric label="Platform fee" value={formatCurrency(pendingJoinSummary.platformFee)} />
            </div>

            {pendingJoinGroup.pricing_note ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {pendingJoinGroup.pricing_note}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingJoinGroup(null)}
                className="sv-btn-secondary w-full justify-center sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => joinGroup(pendingJoinGroup)}
                disabled={joiningId === pendingJoinGroup.id}
                className="sv-btn-primary w-full justify-center sm:w-auto"
              >
                {joiningId === pendingJoinGroup.id ? (
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
      ) : null}

      <div className="sv-container space-y-6">
        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="sv-dark-hero sv-reveal">
            <p className="sv-eyebrow-on-dark">Marketplace</p>
            <h1 className="sv-display-on-dark mt-4 max-w-4xl">
              Join the group flow that fits the way the plan is being organized.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-200">
              Sharing groups give access to an existing plan. Buy-together groups collect member
              commitments first and move forward only after the group is complete.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              <span className="sv-chip-dark"><SearchIcon className="h-3.5 w-3.5" /> Search by plan or host</span>
              <span className="sv-chip-dark"><ClockIcon className="h-3.5 w-3.5" /> Late-join proration for sharing</span>
              <span className="sv-chip-dark"><WalletIcon className="h-3.5 w-3.5" /> Wallet-backed joins</span>
              <span className="sv-chip-dark"><ShieldIcon className="h-3.5 w-3.5" /> Confirmation-based buy-together flow</span>
            </div>
          </div>

          <div className="sv-card sv-reveal">
            <p className="sv-eyebrow">Filter groups</p>
            <h2 className="mt-3 text-2xl font-bold leading-tight text-slate-950 md:text-[1.9rem]">
              Search, narrow, and join with confidence
            </h2>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Search groups
              </span>
              <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white/70 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Netflix, Spotify, host name..."
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </label>

            <div className="mt-5 flex flex-wrap gap-2">
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All groups</FilterButton>
              <FilterButton active={filter === "sharing"} onClick={() => setFilter("sharing")}>Share existing plan</FilterButton>
              <FilterButton active={filter === "group_buy"} onClick={() => setFilter("group_buy")}>Buy together</FilterButton>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <StatCard label="Total groups" value={stats.total} />
              <StatCard label="Open now" value={stats.open} />
              <StatCard label="Sharing" value={stats.sharing} />
              <StatCard label="Buy together" value={stats.groupBuy} />
            </div>
          </div>
        </section>

        {feedback.message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              feedback.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        {loading ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <article key={index} className="sv-skeleton-card space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="sv-skeleton h-3 w-20" />
                    <div className="sv-skeleton h-9 w-56 rounded-[16px]" />
                    <div className="sv-skeleton h-9 w-40 rounded-[16px]" />
                  </div>
                  <div className="sv-skeleton h-16 w-20 rounded-full" />
                </div>
                <div className="sv-skeleton h-4 w-full" />
                <div className="sv-skeleton h-4 w-11/12" />
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((__, itemIndex) => (
                    <div key={itemIndex} className="sv-skeleton h-14 w-full rounded-[18px]" />
                  ))}
                </div>
                <div className="sv-skeleton h-2 w-full rounded-full" />
                <div className="sv-skeleton h-12 w-full rounded-full" />
              </article>
            ))}
          </section>
        ) : filteredGroups.length === 0 ? (
          <div className="sv-empty-state">
            <div className="sv-empty-icon">
              <CompassIcon className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-slate-900">
              {searchTerm ? "No groups match your search yet." : "No groups match this view yet."}
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              Try another search, switch the filter, or check back once more splits are live.
            </p>
          </div>
        ) : (
          <section className="sv-stagger grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.map((group) => {
              const isFull = group.filled_slots >= group.total_slots;
              const tone = getCardTone(group.mode);
              const progress = Math.min(
                100,
                Math.round((Number(group.filled_slots || 0) / Number(group.total_slots || 1)) * 100)
              );

              return (
                <article
                  key={group.id}
                  className={`sv-reveal rounded-[30px] border p-5 shadow-[0_22px_60px_rgba(15,23,42,0.07)] ${tone.soft}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Open group</p>
                      <h3 className="mt-2 text-2xl font-bold leading-tight text-slate-950">
                        {group.subscription_name || group.subscription}
                      </h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${tone.chip}`}>
                      {group.mode_label}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-600">{group.mode_description}</p>

                  <div className="mt-5 space-y-2">
                    <InlineMetric
                      label={group.is_prorated ? "Pay now" : "Pay to join"}
                      value={formatCurrency(group.join_price)}
                    />
                    <InlineMetric
                      label="Plan contribution"
                      value={formatCurrency(group.join_subtotal || group.price_per_slot)}
                    />
                    <InlineMetric label="Host" value={group.owner_name} />
                    <InlineMetric label="Stage" value={group.status_label} />
                    <InlineMetric label="Filled" value={`${group.filled_slots}/${group.total_slots}`} />
                  </div>

                  <div className="mt-4 space-y-1">
                    {Number(group.platform_fee_amount || 0) > 0 ? (
                      <p className="text-xs leading-6 text-slate-600">
                        Includes a 5% platform fee of {formatCurrency(group.platform_fee_amount)}.
                      </p>
                    ) : null}
                    {group.is_prorated ? (
                      <p className="text-xs leading-6 text-emerald-700">
                        {group.pricing_note} Full cycle price before fee: {formatCurrency(group.price_per_slot)}.
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/90">
                    <div className={`sv-progress-animated h-full rounded-full ${tone.rail}`} style={{ width: `${progress}%`, backgroundImage: tone.rail.includes("amber") ? "linear-gradient(90deg,#f59e0b 0%,#fbbf24 35%,#d97706 100%)" : "linear-gradient(90deg,#0f766e 0%,#38bdf8 45%,#0f172a 100%)" }} />
                  </div>

                  <button
                    onClick={() => setPendingJoinGroup(group)}
                    disabled={isFull || joiningId === group.id}
                    className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition ${
                      isFull
                        ? "cursor-not-allowed bg-slate-300 text-white"
                        : "bg-slate-950 text-white hover:bg-slate-800"
                    }`}
                  >
                    {isFull ? "Group full" : joiningId === group.id ? "Joining..." : <><SparkIcon className="h-4 w-4" />{group.join_cta}</>}
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
        active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="sv-stat-card">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function InlineMetric({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white bg-white/70 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}
