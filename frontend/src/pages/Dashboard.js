import { useEffect, useState } from "react";
import API from "../api/axios";
import { revealGroupCredentials } from "../api/credentials";
import { SkeletonHero, SkeletonList, SkeletonMetricGrid } from "../components/SkeletonFactory";
import { useToast } from "../components/ToastProvider";

export default function Dashboard() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [revealedCredentials, setRevealedCredentials] = useState({});
  const [revealingGroupId, setRevealingGroupId] = useState(null);

  useEffect(() => {
    API.get("dashboard/")
      .then((res) => {
        setData(res.data);
        setError("");
      })
      .catch(() => {
        setError("Error loading dashboard");
      });
  }, []);

  if (error) {
    return <p className="text-center mt-10 text-red-500">{error}</p>;
  }

  if (!data) {
    return (
      <main className="sv-page pb-20">
        <div className="sv-container max-w-6xl mt-6 lg:mt-10">
          <SkeletonHero className="h-48 rounded-[length:var(--sv-radius-card-md)] mb-8" />
          <SkeletonMetricGrid count={3} className="grid grid-cols-1 md:grid-cols-3 gap-6" />
          <div className="mt-8">
             <SkeletonMetricGrid count={4} className="grid grid-cols-1 md:grid-cols-4 gap-4" />
          </div>
          <div className="mt-8">
             <SkeletonList count={2} itemClassName="h-32 rounded-[length:var(--sv-radius-card)]" />
          </div>
        </div>
      </main>
    );
  }

  const handleRevealCredentials = async (groupId) => {
    try {
      setRevealingGroupId(groupId);
      const credentials = await revealGroupCredentials(groupId);
      setRevealedCredentials((current) => ({
        ...current,
        [groupId]: credentials,
      }));
    } catch (revealError) {
      console.error(revealError);
      toast.error(revealError.response?.data?.error || "Failed to reveal credentials");
    } finally {
      setRevealingGroupId(null);
    }
  };

  const ownerSummary = data.owner_summary || {};

  return (
    <main className="sv-page pb-20">
      <div className="sv-container max-w-6xl mt-6 lg:mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 sm:pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dashboard
          </h1>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Owner performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Groups Created" value={ownerSummary.total_groups_created || 0} compact />
            <StatCard title="Sharing Groups" value={ownerSummary.sharing_groups_created || 0} compact />
            <StatCard title="Buy-Together Groups" value={ownerSummary.buy_together_groups_created || 0} compact />
            <StatCard title="Sharing Revenue" value={`Rs ${ownerSummary.sharing_revenue || "0.00"}`} accent="text-emerald-600" compact />
          </div>
          <div className="sv-card-solid p-5 mt-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Buy-together groups waiting</p>
            <p className="text-3xl font-bold mt-2 text-slate-900 dark:text-white">{ownerSummary.buy_together_waiting || 0}</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Groups you joined</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {data.groups?.length === 0 ? (
              <p className="col-span-full text-slate-500">No groups joined</p>
            ) : (
              data.groups?.map((group) => (
                <div key={group.id} className="sv-card-solid p-5">
                  <p className="text-lg font-bold text-slate-950 dark:text-white">{group.subscription_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{group.mode_label}</p>
                  <p className="text-sm text-slate-500">Status: {group.status_label}</p>
                  <p className="text-base font-semibold mt-2 text-slate-900 dark:text-white">Rs {group.price_per_slot}</p>

                  {group.credentials ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                        Shared access
                      </p>
                      {revealedCredentials[group.id] ? (
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <p>
                            Login: <span className="font-medium break-all">{revealedCredentials[group.id].login_identifier}</span>
                          </p>
                          <p>
                            Password: <span className="font-medium break-all">{revealedCredentials[group.id].password}</span>
                          </p>
                          {revealedCredentials[group.id].notes ? (
                            <p className="text-slate-600">Notes: {revealedCredentials[group.id].notes}</p>
                          ) : null}
                        </div>
                      ) : group.credentials.available ? (
                        <div className="mt-3 space-y-3">
                          <p className="text-sm text-slate-700">{group.credentials.message}</p>
                          <button
                            onClick={() => handleRevealCredentials(group.id)}
                            disabled={revealingGroupId === group.id}
                            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-400"
                          >
                            {revealingGroupId === group.id ? "Revealing..." : "Reveal once"}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-amber-700">{group.credentials.message}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          <div className="space-y-2">
            {data.notifications?.length === 0 ? (
              <p className="text-slate-500">No notifications</p>
            ) : (
              data.notifications?.map((notification) => (
                <div
                  key={notification.id}
                  className="sv-card-solid p-4 flex items-center gap-3"
                >
                  <span className="text-sm font-semibold uppercase tracking-widest text-slate-400">Notification</span>
                  <span className="text-sm text-slate-800 dark:text-slate-200">{notification.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, accent = "", compact = false }) {
  return (
    <div className={`sv-card-solid ${compact ? "p-4" : "p-5"}`}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h2>
      <p className={`text-3xl font-bold mt-3 ${accent || "text-slate-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}
