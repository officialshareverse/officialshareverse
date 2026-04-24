import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import API from "../api/axios";
import { SkeletonCard, SkeletonList, SkeletonTextGroup } from "../components/SkeletonFactory";
import { useToast } from "../components/ToastProvider";
import { CheckCircleIcon, CompassIcon, LoadingSpinner, SearchIcon, ShieldIcon } from "../components/UiIcons";
import { formatCurrency, formatDate, formatRelativeTime } from "../utils/format";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "sharing", label: "Sharing" },
  { value: "group_buy", label: "Buy together" },
];

function getStatusMeta(status) {
  if (status === "active") {
    return {
      label: "Active",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  if (["awaiting_purchase", "proof_submitted", "collecting", "purchasing"].includes(status)) {
    return {
      label: "In progress",
      className: "bg-amber-100 text-amber-700",
    };
  }

  if (["closed", "refunded", "refunding"].includes(status)) {
    return {
      label: "Closed",
      className: "bg-slate-100 text-slate-600",
    };
  }

  if (status === "disputed") {
    return {
      label: "Attention",
      className: "bg-rose-100 text-rose-700",
    };
  }

  return {
    label: "Open",
    className: "bg-slate-100 text-slate-600",
  };
}

function sortGroups(groups) {
  return [...groups].sort((left, right) => {
    const leftRemaining = Math.max(
      Number(left.remaining_slots ?? Number(left.total_slots || 0) - Number(left.filled_slots || 0)) || 0,
      0
    );
    const rightRemaining = Math.max(
      Number(right.remaining_slots ?? Number(right.total_slots || 0) - Number(right.filled_slots || 0)) || 0,
      0
    );

    const leftIsOpen = leftRemaining > 0 ? 1 : 0;
    const rightIsOpen = rightRemaining > 0 ? 1 : 0;
    if (leftIsOpen !== rightIsOpen) {
      return rightIsOpen - leftIsOpen;
    }

    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  });
}

function buildJoinSummary(group) {
  return {
    amount: Number(group.join_price || group.price_per_slot || 0),
    subtotal: Number(group.join_subtotal || group.price_per_slot || 0),
    platformFee: Number(group.platform_fee_amount || 0),
  };
}

function JoinDialog({ group, joining, onCancel, onConfirm }) {
  const totalSlots = Math.max(Number(group.total_slots || 1), 1);
  const filledSlots = Number(group.filled_slots || 0);
  const remainingSlots = Math.max(Number(group.remaining_slots ?? totalSlots - filledSlots) || 0, 0);
  const summary = buildJoinSummary(group);
  const planName = group.subscription_name || group.subscription || "Untitled split";
  const statusMeta = getStatusMeta(group.status);
  const cycleText =
    group.mode === "group_buy"
      ? formatDate(group.purchase_deadline_at) || formatDate(group.auto_refund_at) || "Dates shared after join"
      : [formatDate(group.start_date), formatDate(group.end_date)].filter(Boolean).join(" - ") || "Dates shared after join";

  return (
    <div className="fixed inset-0 z-[170] overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-xl items-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Join confirmation</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">{planName}</h2>
            </div>
            <button type="button" onClick={onCancel} className="text-sm font-semibold text-slate-500">
              Close
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
              {group.mode_label || (group.mode === "group_buy" ? "Buy together" : "Sharing")}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
              {group.status_label || statusMeta.label}
            </span>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            {group.mode === "group_buy"
              ? "Your contribution is reserved now and the purchase moves only after the buy-together flow is completed."
              : "Your wallet is charged now, and the host coordinates access after you join the current cycle."}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SimpleMetric label="Pay now" value={formatCurrency(summary.amount)} />
            <SimpleMetric label="Slots left" value={`${remainingSlots}`} />
            <SimpleMetric label="Plan contribution" value={formatCurrency(summary.subtotal)} />
            <SimpleMetric label="Platform fee" value={formatCurrency(summary.platformFee)} />
            <SimpleMetric label="Hosted by" value={group.owner_name || "ShareVerse host"} />
            <SimpleMetric label="Current window" value={cycleText} />
          </div>

          {group.pricing_note ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {group.pricing_note}
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            <div className="flex items-start gap-3">
              <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
              <p>
                Wallet-backed joins are recorded inside ShareVerse. Funds settle only through the platform flow, not
                through off-platform credential sharing.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className="sv-btn-secondary justify-center">
              Cancel
            </button>
            <button type="button" onClick={() => onConfirm(group)} className="sv-btn-primary justify-center" disabled={joining}>
              {joining ? (
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

function SimpleMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function GroupRow({ group, joiningId, onJoin }) {
  const planName = group.subscription_name || group.subscription || "Untitled split";
  const totalSlots = Math.max(Number(group.total_slots || 1), 1);
  const filledSlots = Number(group.filled_slots || 0);
  const remainingSlots = Math.max(Number(group.remaining_slots ?? totalSlots - filledSlots) || 0, 0);
  const statusMeta = getStatusMeta(group.status);
  const isFull = remainingSlots <= 0;
  const price = Number(group.join_price || group.price_per_slot || 0);
  const subtitle = group.owner_name
    ? `Hosted by ${group.owner_name} • ${formatRelativeTime(group.created_at)}`
    : formatRelativeTime(group.created_at);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {group.mode_label || (group.mode === "group_buy" ? "Buy together" : "Sharing")}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
              {group.status_label || statusMeta.label}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-semibold text-slate-900">{planName}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          {group.mode_description ? <p className="mt-2 text-sm leading-6 text-slate-600">{group.mode_description}</p> : null}

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
            <span>
              <strong className="text-slate-900">{formatCurrency(price)}</strong>
            </span>
            <span>{remainingSlots} slots left</span>
            <span>{filledSlots}/{totalSlots} filled</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onJoin(group)}
          disabled={isFull || joiningId === group.id}
          className={`min-w-[9rem] ${isFull ? "sv-btn-secondary" : "sv-btn-primary"} justify-center`}
        >
          {joiningId === group.id ? (
            <>
              <LoadingSpinner />
              Joining...
            </>
          ) : isFull ? (
            "Group full"
          ) : (
            group.join_cta || "Join now"
          )}
        </button>
      </div>
    </article>
  );
}

export default function Groups() {
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingJoinGroup, setPendingJoinGroup] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchGroups() {
      try {
        setLoading(true);
        const response = await API.get("groups/");
        if (!cancelled) {
          setGroups(Array.isArray(response.data) ? response.data : []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          toast.error("Failed to load groups.", { title: "Couldn't load marketplace" });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchGroups();
    return () => {
      cancelled = true;
    };
  }, [toast]);

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

  const counts = useMemo(() => {
    return groups.reduce(
      (acc, group) => {
        acc.total += 1;
        if (group.mode === "sharing") {
          acc.sharing += 1;
        }
        if (group.mode === "group_buy") {
          acc.group_buy += 1;
        }
        return acc;
      },
      { total: 0, sharing: 0, group_buy: 0 }
    );
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sortGroups(groups).filter((group) => {
      const matchesFilter = filter === "all" ? true : group.mode === filter;
      if (!matchesFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        group.subscription_name,
        group.subscription,
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

  const reloadGroups = async () => {
    const response = await API.get("groups/");
    setGroups(Array.isArray(response.data) ? response.data : []);
  };

  const joinGroup = async (group) => {
    try {
      setJoiningId(group.id);
      const response = await API.post("join-group/", { group_id: group.id });

      if (group.mode === "sharing") {
        const successNote = response.data?.pricing_note ? ` ${response.data.pricing_note}` : "";
        const feeNote =
          Number(response.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(response.data.platform_fee_amount).toFixed(2)}.`
            : "";
        toast.success(
          `Joined successfully. ${formatCurrency(response.data?.charged_amount || group.join_price || group.price_per_slot)} was charged.${feeNote}${successNote}`.trim(),
          { title: "Joined split" }
        );
      } else {
        const feeNote =
          Number(response.data?.platform_fee_amount || 0) > 0
            ? ` This included a 5% platform fee of Rs ${Number(response.data.platform_fee_amount).toFixed(2)}.`
            : "";
        toast.success(`${response.data?.message || "Joined successfully."}${feeNote}`.trim(), {
          title: "Joined group",
        });
      }

      setPendingJoinGroup(null);
      await reloadGroups();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Join failed.", { title: "Couldn't join group" });
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="sv-page">
      {pendingJoinGroup && typeof document !== "undefined"
        ? createPortal(
            <JoinDialog
              group={pendingJoinGroup}
              joining={joiningId === pendingJoinGroup.id}
              onCancel={() => setPendingJoinGroup(null)}
              onConfirm={joinGroup}
            />,
            document.body
          )
        : null}

      <div className="mx-auto max-w-5xl space-y-4">
        <section className="sv-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Marketplace</p>
              <h1 className="mt-3 text-2xl font-bold text-slate-900">Find a split and join it without the clutter.</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Search a plan, choose a flow, and review the payment summary before you join.
              </p>
            </div>

            <Link to="/create" className="sv-btn-primary justify-center">
              Create your own split
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            <div className="flex items-start gap-3">
              <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <p>ShareVerse only supports provider-permitted listings and does not support password-sharing listings.</p>
            </div>
          </div>
        </section>

        <section className="sv-card space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search plans or hosts"
                className="w-full bg-transparent text-sm text-slate-900 outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => {
                const count = option.value === "all" ? counts.total : counts[option.value] || 0;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      filter === option.value
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {option.label} <span className="text-xs opacity-75">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              <SkeletonCard>
                <SkeletonTextGroup titleWidth="w-64" />
              </SkeletonCard>
              <SkeletonList count={4} itemClassName="h-36 rounded-xl" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                <CompassIcon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">
                {searchTerm ? "No groups match that search yet." : "No groups match this filter yet."}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Clear the search, switch the flow, or create your own split if you do not see the one you need.
              </p>
              {(searchTerm || filter !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setFilter("all");
                  }}
                  className="sv-btn-secondary mt-4 justify-center"
                >
                  Reset view
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group) => (
                <GroupRow key={group.id} group={group} joiningId={joiningId} onJoin={setPendingJoinGroup} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
