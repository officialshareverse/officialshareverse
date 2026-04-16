import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { clearAuthSession } from "../auth/session";
import BrandMark from "./BrandMark";
import {
  BellIcon,
  ChatIcon,
  CompassIcon,
  HomeIcon,
  LayersIcon,
  PlusIcon,
  UserIcon,
  WalletIcon,
} from "./UiIcons";

const navItems = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/groups", label: "Explore Splits", icon: CompassIcon },
  { to: "/create", label: "Create Split", icon: PlusIcon },
  { to: "/my-shared", label: "My Splits", icon: LayersIcon },
  { to: "/notifications", label: "Notifications", badgeKey: "notification", icon: BellIcon },
  { to: "/chats", label: "Chats", badgeKey: "chat", icon: ChatIcon },
  { to: "/wallet", label: "Wallet", icon: WalletIcon },
  { to: "/profile", label: "Profile", icon: UserIcon },
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

  const getBadgeCount = (item) =>
    item.badgeKey === "chat" ? unreadChatCount : item.badgeKey === "notification" ? unreadNotificationCount : 0;

  const logout = () => {
    clearAuthSession();
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
              <p className="mt-1 hidden text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:block">
                Split more. Pay less.
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sv-nav-link ${
                    isActive
                      ? "bg-slate-950 text-white shadow-[0_12px_20px_rgba(15,23,42,0.15)]"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`
                }
              >
                {({ isActive }) => {
                  const Icon = item.icon;
                  const badgeCount = getBadgeCount(item);
                  return (
                    <>
                      <span className={`sv-nav-icon relative ${isActive ? "border-white/20 bg-white/12 text-white" : ""}`}>
                        <Icon className="h-4.5 w-4.5" />
                        {badgeCount > 0 ? <span className="sv-nav-dot" /> : null}
                      </span>
                      <span>{item.label}</span>
                      {badgeCount > 0 ? (
                        <span className={`inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${isActive ? "bg-white/14 text-white" : "bg-emerald-500 text-white"}`}>
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      ) : null}
                    </>
                  );
                }}
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
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50 lg:hidden"
              aria-label="Toggle navigation"
            >
              <span className={`sv-hamburger ${isMenuOpen ? "is-open" : ""}`}>
                <span />
                <span />
                <span />
              </span>
              <span>{isMenuOpen ? "Close" : "Menu"}</span>
            </button>
          </div>
        </div>

        {isMenuOpen ? (
          <div className="mt-2 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-[24px] border border-white/60 bg-white/92 px-3 py-3 shadow-[0_24px_70px_rgba(15,23,42,0.1)] backdrop-blur lg:hidden">
            <nav className="grid gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      isActive ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"
                    }`
                  }
                >
                  {({ isActive }) => {
                    const Icon = item.icon;
                    const badgeCount = getBadgeCount(item);
                    return (
                      <span className="flex items-center gap-3">
                        <span className={`sv-nav-icon relative ${isActive ? "border-white/20 bg-white/10 text-white" : ""}`}>
                          <Icon className="h-4.5 w-4.5" />
                          {badgeCount > 0 ? <span className="sv-nav-dot" /> : null}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {badgeCount > 0 ? (
                          <span className={`inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${isActive ? "bg-white/14 text-white" : "bg-emerald-500 text-white"}`}>
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        ) : null}
                      </span>
                    );
                  }}
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
