import { useEffect, useState } from "react";
import API from "../api/axios";
import { revealGroupCredentials } from "../api/credentials";

export default function Dashboard() {
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
    return <p className="text-center mt-10">Loading...</p>;
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
      alert(revealError.response?.data?.error || "Failed to reveal credentials");
    } finally {
      setRevealingGroupId(null);
    }
  };

  const ownerSummary = data.owner_summary || {};

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-3xl bg-slate-900 text-white p-8 mb-6">
          <p className="uppercase tracking-[0.25em] text-sm text-amber-300">Platform dashboard</p>
          <h1 className="text-4xl font-bold mt-3">Track what you spend, what you earn, and what still needs members.</h1>
          <p className="mt-4 text-slate-300 max-w-3xl">
            This dashboard combines your member activity with your owner activity across sharing groups and buy-together groups.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Wallet Balance" value={`Rs ${data.wallet_balance}`} accent="text-green-600" />
          <StatCard title="Groups Joined" value={data.total_groups} />
          <StatCard title="Total Spent" value={`Rs ${data.total_spent}`} accent="text-red-500" />
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Owner performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard title="Groups Created" value={ownerSummary.total_groups_created || 0} compact />
            <StatCard title="Sharing Groups" value={ownerSummary.sharing_groups_created || 0} compact />
            <StatCard title="Buy-Together Groups" value={ownerSummary.buy_together_groups_created || 0} compact />
            <StatCard title="Sharing Revenue" value={`Rs ${ownerSummary.sharing_revenue || "0.00"}`} accent="text-emerald-600" compact />
          </div>
          <div className="bg-white p-5 rounded-xl shadow mt-4">
            <p className="text-gray-500">Buy-together groups still waiting for completion</p>
            <p className="text-2xl font-bold mt-2">{ownerSummary.buy_together_waiting || 0}</p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Groups you joined</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {data.groups?.length === 0 ? (
              <p>No groups joined</p>
            ) : (
              data.groups?.map((group) => (
                <div key={group.id} className="bg-white p-4 rounded-xl shadow">
                  <p className="font-semibold">{group.subscription_name}</p>
                  <p className="text-gray-500">{group.mode_label}</p>
                  <p className="text-gray-500">Status: {group.status_label}</p>
                  <p className="text-sm mt-1">Rs {group.price_per_slot}</p>

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
              <p>No notifications</p>
            ) : (
              data.notifications?.map((notification) => (
                <div
                  key={notification.id}
                  className="bg-white p-3 rounded-lg shadow flex items-center gap-2"
                >
                  <span className="font-medium">Notification:</span>
                  <span>{notification.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, accent = "", compact = false }) {
  return (
    <div className={`bg-white rounded-xl shadow ${compact ? "p-4" : "p-5"}`}>
      <h2 className="text-lg font-semibold text-gray-500">{title}</h2>
      <p className={`text-2xl font-bold mt-2 ${accent}`}>{value}</p>
    </div>
  );
}
