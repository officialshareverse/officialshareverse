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
  { to: "/home", label: "Home", mobileLabel: "Home", icon: HomeIcon, mobileTab: true },
  { to: "/groups", label: "Explore Splits", mobileLabel: "Explore", icon: CompassIcon, mobileTab: true },
  { to: "/create", label: "Create Split", mobileLabel: "Create", icon: PlusIcon, mobileTab: true },
  { to: "/my-shared", label: "My Splits", mobileLabel: "My Splits", icon: LayersIcon, mobileTab: true },
  { to: "/notifications", label: "Notifications", mobileLabel: "Alerts", icon: BellIcon, badgeKey: "notification" },
  { to: "/chats", label: "Chats", mobileLabel: "Chats", icon: ChatIcon, badgeKey: "chat" },
  { to: "/wallet", label: "Wallet", mobileLabel: "Wallet", icon: WalletIcon, mobileTab: true },
  { to: "/profile", label: "Profile", mobileLabel: "Profile", icon: UserIcon },
];

const mobileTabItems = navItems.filter((item) => item.mobileTab);
const mobileMenuItems = navItems.filter((item) => !item.mobileTab);

function HamburgerIcon({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      <path
        d={open ? "M4 4L14 14M14 4L4 14" : "M2 4.5H16M2 9H16M2 13.5H16"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "d 0.2s ease" }}
      />
    </svg>
  );
}

function resolveCurrentPath(pathname) {
  if (/^\/groups\/[^/]+\/chat/.test(pathname)) {
    return "/chats";
  }
  if (pathname.startsWith("/notifications")) {
    return "/notifications";
  }
  if (pathname.startsWith("/chats")) {
    return "/chats";
  }
  if (pathname.startsWith("/wallet")) {
    return "/wallet";
  }
  if (pathname.startsWith("/profile")) {
    return "/profile";
  }
  if (pathname.startsWith("/my-shared")) {
    return "/my-shared";
  }
  if (pathname.startsWith("/create")) {
    return "/create";
  }
  if (pathname.startsWith("/groups")) {
    return "/groups";
  }
  return "/home";
}

export default function Navbar({ setIsAuth }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const currentPath = resolveCurrentPath(location.pathname);
  const currentItem = navItems.find((item) => item.to === currentPath) || navItems[0];

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

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
    if (item.badgeKey !== "chat" && item.badgeKey !== "notification") {
      return item.label;
    }

    const badgeCount = item.badgeKey === "chat" ? unreadChatCount : unreadNotificationCount;

    return (
      <span className="inline-flex items-center gap-2">
        <span>{item.label}</span>
        {badgeCount > 0 ? (
          <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </span>
    );
  };

  const getBadgeCount = (item) => {
    if (item.badgeKey === "chat") {
      return unreadChatCount;
    }
    if (item.badgeKey === "notification") {
      return unreadNotificationCount;
    }
    return 0;
  };

  const logout = () => {
    clearAuthSession();
    setIsAuth(false);
    navigate("/");
  };

  return (
    <>
      <header className="sticky top-0 z-40" style={{ padding: "var(--sv-page-px)", paddingBottom: 0 }}>
        <div className="sv-container">
          <div className="hidden items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3 md:px-5 lg:flex sv-brand-shell">
            <div className="min-w-0 flex items-center gap-2 sm:gap-3">
              <BrandMark glow sizeClass="h-8 w-8 sm:h-10 sm:w-10" />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-none text-slate-950 sm:text-lg md:text-xl">
                  ShareVerse
                </h1>
                <p className="mt-0.5 hidden text-[9px] uppercase tracking-[0.14em] text-slate-500 sm:block sm:text-[10px] sm:tracking-[0.16em]">
                  Split more. Pay less.
                </p>
              </div>
            </div>

            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `rounded-full px-3 py-2 text-[13px] font-semibold transition ${
                        isActive
                          ? "bg-slate-950 text-white shadow-[0_12px_20px_rgba(15,23,42,0.15)]"
                          : "text-slate-600 hover:bg-white hover:text-slate-950"
                      }`
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {renderNavLabel(item)}
                    </span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={logout}
                className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 md:inline-flex"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="lg:hidden sv-mobile-appbar">
            <div className="min-w-0 flex items-center gap-3">
              <BrandMark glow sizeClass="h-9 w-9" roundedClass="rounded-[14px]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-none text-slate-950">ShareVerse</p>
                <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{currentItem.label}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/notifications")}
                className="sv-mobile-icon-button"
                aria-label="Open notifications"
              >
                <BellIcon className="h-4.5 w-4.5" />
                {unreadNotificationCount > 0 ? <span className="sv-mobile-icon-dot" /> : null}
              </button>
              <button
                type="button"
                onClick={() => setIsMenuOpen((current) => !current)}
                className="sv-mobile-icon-button"
                aria-label="Toggle navigation"
              >
                <HamburgerIcon open={isMenuOpen} />
              </button>
            </div>
          </div>

          {isMenuOpen ? (
            <div className="sv-slide-down sv-mobile-menu-panel lg:hidden">
              <div className="rounded-[22px] border border-slate-200/80 bg-white/98 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Quick access</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">More screens</p>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900"
                  >
                    Logout
                  </button>
                </div>

                <nav className="mt-3 grid gap-2">
                  {mobileMenuItems.map((item) => {
                    const Icon = item.icon;
                    const count = getBadgeCount(item);
                    const isActive = currentPath === item.to;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsMenuOpen(false)}
                        className={`rounded-[18px] border px-3 py-3 text-[13px] font-semibold transition ${
                          isActive
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-white"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-3">
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${isActive ? "bg-white/10 text-white" : "bg-white text-slate-700"}`}>
                              <Icon className="h-4.5 w-4.5" />
                            </span>
                            <span>{item.label}</span>
                          </span>
                          {count > 0 ? (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? "bg-emerald-400 text-slate-950" : "bg-emerald-100 text-emerald-800"}`}>
                              {count > 99 ? "99+" : count}
                            </span>
                          ) : null}
                        </span>
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <nav className="sv-mobile-tabbar lg:hidden" aria-label="Primary navigation">
        <div className="sv-mobile-tabbar-inner">
          {mobileTabItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`sv-mobile-tab ${isActive ? "sv-mobile-tab-active" : ""}`}
              >
                <span className="sv-mobile-tab-icon">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="sv-mobile-tab-label">{item.mobileLabel}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
