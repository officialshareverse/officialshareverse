import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import BrandMark from "./BrandMark";

const navItems = [
  { to: "/home", label: "Home" },
  { to: "/groups", label: "Explore Splits" },
  { to: "/create", label: "Create Split" },
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
    <header className="sticky top-0 z-40 px-2.5 pt-2.5 sm:px-4 sm:pt-4 md:px-6">
      <div className="sv-container">
        <div className="sv-brand-shell flex items-center justify-between gap-3 px-3.5 py-3 sm:px-4 md:px-5">
        <div className="min-w-0 flex items-center gap-2.5 sm:gap-3">
          <BrandMark glow sizeClass="h-9 w-9 sm:h-11 sm:w-11" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-none text-slate-950 sm:text-xl">
              ShareVerse
            </h1>
            <p className="mt-1 hidden text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:block">Split more. Pay less.</p>
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-700 transition hover:bg-slate-50 lg:hidden"
            aria-label="Toggle navigation"
          >
            {isMenuOpen ? "×" : "☰"}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className="mt-2 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-[24px] border border-white/60 bg-white/88 px-3.5 py-3.5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
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
