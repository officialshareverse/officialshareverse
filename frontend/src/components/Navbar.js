import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { clearAuthSession } from "../auth/session";
import useIsMobile from "../hooks/useIsMobile";
import { getInitials } from "../utils/format";
import BrandMark from "./BrandMark";
import ThemeToggle from "./ThemeToggle";
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

const primaryItems = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/groups", label: "Explore", icon: CompassIcon },
  { to: "/create", label: "Create", icon: PlusIcon },
  { to: "/my-shared", label: "My Splits", icon: LayersIcon },
  { to: "/wallet", label: "Wallet", icon: WalletIcon },
  { to: "/notifications", label: "Notifications", icon: BellIcon, badgeKey: "notification" },
  { to: "/chats", label: "Chats", icon: ChatIcon, badgeKey: "chat" },
];

const mobileTabs = primaryItems.slice(0, 4);
const mobileOverflowItems = [
  primaryItems[4],
  primaryItems[5],
  primaryItems[6],
  { to: "/profile", label: "Profile", icon: UserIcon },
];

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

export default function Navbar({ setIsAuth, themeMode, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState(null);
  const [counts, setCounts] = useState({ chat: 0, notification: 0 });
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const currentPath = resolveCurrentPath(location.pathname);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    async function fetchNavbarData() {
      try {
        const profilePromise = API.get("profile/").catch(() => null);
        const chatPromise = API.get("group-chats/").catch(() => null);
        const notificationPromise = API.get("notifications/").catch(() => null);
        const [profileResponse, chatResponse, notificationResponse] = await Promise.all([
          profilePromise,
          chatPromise,
          notificationPromise,
        ]);

        if (!isMounted) {
          return;
        }

        setProfile(profileResponse?.data || null);

        const notificationItems = Array.isArray(notificationResponse?.data)
          ? notificationResponse.data
          : [];

        setCounts({
          chat: Number(chatResponse?.data?.total_unread_count || 0),
          notification: notificationItems.filter((item) => !item.is_read).length,
        });
      } catch (error) {
        console.error("Failed to load navbar state:", error);
      }
    }

    void fetchNavbarData();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  const profileLabel = useMemo(() => {
    return profile?.first_name?.trim() || profile?.username || "Profile";
  }, [profile?.first_name, profile?.username]);

  const profileHandle = useMemo(() => {
    return profile?.username ? `@${profile.username}` : "Personal space";
  }, [profile?.username]);

  const initials = useMemo(
    () => getInitials(profile?.full_name || profile?.username || "SV"),
    [profile?.full_name, profile?.username]
  );

  async function logout() {
    try {
      await API.post("auth/logout/", {});
    } catch {
      // ignore logout endpoint failures
    }

    clearAuthSession();
    setIsAuth(false);
    navigate("/");
  }

  function getBadgeCount(item) {
    if (item.badgeKey === "chat") {
      return counts.chat;
    }
    if (item.badgeKey === "notification") {
      return counts.notification;
    }
    return 0;
  }

  return (
    <>
      <div className="sticky top-0 z-40 px-4 pt-4">
        <header className="mx-auto flex max-w-7xl items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <NavLink to="/home" className="inline-flex items-center gap-3">
            <BrandMark sizeClass="h-10 w-10" />
            <div className="hidden min-w-0 sm:block">
              <p className="text-xl font-bold text-slate-950">ShareVerse</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Split more. Pay less.
              </p>
            </div>
          </NavLink>

          {!isMobile ? (
            <nav className="ml-2 flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {primaryItems.map((item) => (
                <DesktopNavLink
                  key={item.to}
                  item={item}
                  currentPath={currentPath}
                  badgeCount={getBadgeCount(item)}
                />
              ))}
            </nav>
          ) : <div className="flex-1" />}

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle themeMode={themeMode} onToggle={toggleTheme} compact />
            {!isMobile ? (
              <>
                <NavLink
                  to="/profile"
                  className="inline-flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {initials}
                  </span>
                  <span className="hidden leading-tight md:block">
                    <span className="block font-semibold text-slate-950">{profileLabel}</span>
                    <span className="block text-xs text-slate-500">{profileHandle}</span>
                  </span>
                </NavLink>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsMoreOpen((current) => !current)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                More
              </button>
            )}
          </div>
        </header>
      </div>

      {isMobile ? (
        <>
          {isMoreOpen ? (
            <div className="fixed inset-x-4 bottom-24 z-50 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sv-slide-down">
              <div className="space-y-2">
                {mobileOverflowItems.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </span>
                    {getBadgeCount(item) > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {getBadgeCount(item)}
                      </span>
                    ) : null}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center rounded-xl px-3 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  Log out
                </button>
              </div>
            </div>
          ) : null}

          <nav className="fixed inset-x-4 bottom-4 z-40 grid grid-cols-5 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
            {mobileTabs.map((item) => (
              <MobileTabLink
                key={item.to}
                item={item}
                currentPath={currentPath}
                badgeCount={getBadgeCount(item)}
              />
            ))}
            <button
              type="button"
              onClick={() => setIsMoreOpen((current) => !current)}
              className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl text-xs font-medium ${
                isMoreOpen ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              <UserIcon className="h-4 w-4" />
              <span className="mt-1">More</span>
            </button>
          </nav>
        </>
      ) : null}
    </>
  );
}

function DesktopNavLink({ item, currentPath, badgeCount }) {
  const isActive = item.to === currentPath;

  return (
    <NavLink
      to={item.to}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
        isActive
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <item.icon className="h-4 w-4" />
      <span>{item.label}</span>
      {badgeCount > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            isActive ? "bg-white/15 text-white" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </NavLink>
  );
}

function MobileTabLink({ item, currentPath, badgeCount }) {
  const isActive = item.to === currentPath;

  return (
    <NavLink
      to={item.to}
      className={`relative flex min-h-[56px] flex-col items-center justify-center rounded-xl text-xs font-medium ${
        isActive ? "bg-slate-900 text-white" : "text-slate-600"
      }`}
    >
      <item.icon className="h-4 w-4" />
      <span className="mt-1">{item.label}</span>
      {badgeCount > 0 ? (
        <span className="absolute right-3 top-2 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </NavLink>
  );
}
