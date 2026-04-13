import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";

const navItems = [
  { to: "/home", label: "Home" },
  { to: "/groups", label: "Browse Groups" },
  { to: "/create", label: "Create Group" },
  { to: "/my-shared", label: "My Groups" },
  { to: "/notifications", label: "Notifications", badgeKey: "notification" },
  { to: "/chats", label: "Chats", badgeKey: "chat" },
  { to: "/wallet", label: "Wallet" },
  { to: "/profile", label: "Profile" },
];

export default function Navbar({ setIsAuth }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCounts = async () => {
      try {
        const [chatResponse, notificationResponse] = await Promise.all([
          API.get("group-chats/"),
          API.get("notifications/"),
        ]);
        if (!isMounted) {
          return;
        }
        setUnreadChatCount(chatResponse.data?.total_unread_count || 0);
        const notifications = Array.isArray(notificationResponse.data) ? notificationResponse.data : [];
        setUnreadNotificationCount(notifications.filter((item) => !item.is_read).length);
      } catch (err) {
        console.error("Failed to load navbar badge counts:", err);
      }
    };

    fetchUnreadCounts();
    const intervalId = window.setInterval(fetchUnreadCounts, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [location.pathname]);

  const renderNavLabel = (item) => {
    if (item.badgeKey !== "chat") {
      if (item.badgeKey !== "notification") {
        return item.label;
      }
    }

    const badgeCount = item.badgeKey === "chat" ? unreadChatCount : unreadNotificationCount;

    return (
      <span className="inline-flex items-center gap-2">
        <span>{item.label}</span>
        {badgeCount > 0 ? (
          <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </span>
    );
  };

  const logout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 md:px-6">
      <div className="sv-container">
        <div className="flex items-center justify-between gap-3 rounded-[28px] border border-white/60 bg-white/80 px-4 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f172a_0%,#14532d_100%)] text-sm font-bold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]">
            SV
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none text-slate-950">
              ShareVerse
            </h1>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Split more. Pay less.</p>
          </div>
        </div>

        <nav className="hidden items-center gap-2 lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-slate-950 text-white shadow-[0_12px_20px_rgba(15,23,42,0.15)]"
                    : "text-slate-600 hover:bg-white hover:text-slate-950"
                }`
              }
            >
              {renderNavLabel(item)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={logout}
            className="hidden rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 md:inline-flex"
          >
            Logout
          </button>

          <button
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
            aria-label="Toggle navigation"
          >
            {isMenuOpen ? "X" : "="}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="mt-3 rounded-[28px] border border-white/60 bg-white/88 px-4 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <nav className="grid gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) =>
                  `rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                {renderNavLabel(item)}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={logout}
              className="mt-1 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              Logout
            </button>
          </nav>
        </div>
      ) : null}
      </div>
    </header>
  );
}
