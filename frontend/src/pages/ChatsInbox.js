import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";

function SummaryCard({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="sv-stat-card">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function ChatsInbox() {
  const navigate = useNavigate();
  const [chatInbox, setChatInbox] = useState({ chats: [], total_chats: 0, total_unread_count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;

    const fetchInbox = async (showLoader = false) => {
      try {
        if (showLoader && isMounted) {
          setLoading(true);
        }
        const response = await API.get("group-chats/");
        if (!isMounted) {
          return;
        }
        setChatInbox(response.data || { chats: [], total_chats: 0, total_unread_count: 0 });
        setError("");
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError(err.response?.data?.error || "We could not load your chats right now.");
        }
      } finally {
        if (showLoader && isMounted) {
          setLoading(false);
        }
      }
    };

    fetchInbox(true);
    const intervalId = window.setInterval(() => fetchInbox(false), 10000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const visibleChats = useMemo(() => {
    const chats = chatInbox.chats || [];
    if (filter === "unread") {
      return chats.filter((chat) => chat.unread_chat_count > 0);
    }
    return chats;
  }, [chatInbox.chats, filter]);

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          Loading your chats...
        </div>
      </div>
    );
  }

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="sv-dark-hero">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="sv-eyebrow-on-dark">Chats</p>
              <h1 className="sv-display-on-dark mt-3 max-w-4xl">
                All group conversations in one place
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-slate-200">
                See the latest message from every group, spot unread updates quickly, and jump straight into any conversation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/my-shared")}
              className="sv-btn-ghost-dark"
            >
              Back to My Groups
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Total chats" value={chatInbox.total_chats || 0} />
          <SummaryCard
            label="Unread messages"
            value={chatInbox.total_unread_count || 0}
            tone={(chatInbox.total_unread_count || 0) > 0 ? "text-emerald-700" : "text-slate-900"}
          />
          <SummaryCard
            label="Unread threads"
            value={(chatInbox.chats || []).filter((chat) => chat.unread_chat_count > 0).length}
            tone="text-sky-700"
          />
        </section>

        <section className="sv-card">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Inbox</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Your conversations</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All chats
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === "unread" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Unread only
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            {visibleChats.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                {filter === "unread" ? "No unread chats right now." : "You do not have any group conversations yet."}
              </div>
            ) : (
              visibleChats.map((chat) => {
                const group = chat.group || {};
                const lastMessage = chat.last_message;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => navigate(`/groups/${group.id}/chat`)}
                    className={`w-full rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                      chat.unread_chat_count > 0
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{group.subscription_name}</h3>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            {group.mode_label}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                            {group.status_label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          Host: {group.owner_name} | Participants: {chat.participant_count}
                        </p>
                      </div>

                      {chat.unread_chat_count > 0 ? (
                        <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                          {chat.unread_chat_count} new
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                          Read
                        </span>
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-4">
                      {lastMessage ? (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {lastMessage.is_own ? "You" : lastMessage.sender_username}
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-700">{lastMessage.message}</p>
                          <p className="mt-3 text-xs text-slate-400">
                            {new Date(lastMessage.created_at).toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">No messages yet</p>
                          <p className="mt-2 text-sm leading-7 text-slate-600">
                            Open this chat to start coordinating with the group.
                          </p>
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
