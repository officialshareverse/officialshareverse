import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import API from "../api/axios";

export default function GroupChat() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [chat, setChat] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const fetchChat = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const response = await API.get(`groups/${groupId}/chat/`);
      setChat(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load group chat.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [groupId]);

  useEffect(() => {
    fetchChat(true);

    const intervalId = window.setInterval(() => {
      fetchChat(false);
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, [fetchChat]);

  const sendMessage = async () => {
    if (!message.trim()) {
      return;
    }

    try {
      setSending(true);
      const response = await API.post(`groups/${groupId}/chat/`, {
        message: message.trim(),
      });
      setChat((current) => ({
        ...(current || {}),
        messages: [...(current?.messages || []), response.data.chat_message],
      }));
      setMessage("");
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to send chat message.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          Loading group chat...
        </div>
      </div>
    );
  }

  if (error && !chat) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-5xl rounded-3xl border border-rose-200 bg-white p-8 text-center text-rose-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => navigate("/my-shared")}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to My Groups
          </button>
        </div>
      </div>
    );
  }

  const messages = chat?.messages || [];
  const participants = chat?.participants || [];
  const group = chat?.group || {};

  return (
    <div className="sv-page">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="sv-dark-hero">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="sv-eyebrow-on-dark">Group chat</p>
              <h1 className="sv-display-on-dark mt-3 max-w-4xl">
                {group.subscription_name}
              </h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                Chat with the group owner and members in one shared space.
              </p>
            </div>
          <button
            type="button"
            onClick={() => navigate("/chats")}
            className="sv-btn-ghost-dark"
          >
            Back to Chats
          </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-200">
            <span className="rounded-full bg-white/10 px-3 py-1">{group.mode_label}</span>
            <span className="rounded-full bg-white/10 px-3 py-1">{group.status_label}</span>
            <span className="rounded-full bg-white/10 px-3 py-1">Host: {group.owner_name}</span>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.7fr_0.3fr]">
          <div className="sv-card">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Conversation</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">Messages</h2>
              </div>
              <button
                type="button"
                onClick={() => fetchChat(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  No messages yet. Start the conversation with your group.
                </div>
              ) : (
                messages.map((item) => (
                  <div
                    key={item.id}
                    className={`flex ${item.is_own ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                        item.is_own
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-800"
                      }`}
                    >
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${item.is_own ? "text-emerald-100" : "text-slate-500"}`}>
                        {item.sender_username}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.message}</p>
                      <p className={`mt-3 text-xs ${item.is_own ? "text-emerald-100" : "text-slate-400"}`}>
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              {error ? (
                <p className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Type a message</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-slate-500"
                  placeholder="Write to your group here..."
                />
              </label>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={sending}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {sending ? "Sending..." : "Send message"}
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <section className="sv-card">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Members</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Participants</h2>
              <div className="mt-4 space-y-3">
                {participants.map((participant) => (
                  <div
                    key={`${participant.role}-${participant.username}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">{participant.username}</p>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      {participant.role}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="sv-card">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tip</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Use this chat to coordinate timing, join status, access follow-ups, and renewal planning with your group.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}
