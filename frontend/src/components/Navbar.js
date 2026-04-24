import { useEffect, useState } from "react";
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

const NAV_ITEMS = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/groups", label: "Explore", icon: CompassIcon },
  { to: "/create", label: "Create", icon: PlusIcon },
  { to: "/my-shared", label: "My Splits", icon: LayersIcon },
  { to: "/wallet", label: "Wallet", icon: WalletIcon },
  { to: "/notifications", label: "Notifications", icon: BellIcon, badgeKey: "notification" },
  { to: "/chats", label: "Chats", icon: ChatIcon, badgeKey: "chat" },
];

const MOBILE_TABS = NAV_ITEMS.slice(0, 4);
const MOBILE_MORE_ITEMS = [
  NAV_ITEMS[4],
  NAV_ITEMS[5],
  NAV_ITEMS[6],
  { to: "/profile", label: "Profile", icon: UserIcon },
];

function resolveCurrentPath(pathname) {
  if (/^\/groups\/[^/]+\/chat/.test(pathname) || pathname.startsWith("/chats")) {
    return "/chats";
  }
  if (pathname.startsWith("/notifications")) return "/notifications";
  if (pathname.startsWith("/wallet")) return "/wallet";
  if (pathname.startsWith("/profile")) return "/profile";
  if (pathname.startsWith("/my-shared")) return "/my-shared";
  if (pathname.startsWith("/create")) return "/create";
  if (pathname.startsWith("/groups")) return "/groups";
  return "/home";
}

function formatBadge(value) {
  return value > 99 ? "99+" : String(value);
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

    async function loadNavbarState() {
      const [profileResult, chatResult, notificationResult] = await Promise.allSettled([
        API.get("profile/"),
        API.get("group-chats/"),
        API.get("notifications/"),
      ]);

      if (!isMounted) {
        return;
      }

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value?.data || null);
      }

      const notifications =
        notificationResult.status === "fulfilled" && Array.isArray(notificationResult.value?.data)
          ? notificationResult.value.data
          : [];

      setCounts({
        chat:
          chatResult.status === "fulfilled"
            ? Number(chatResult.value?.data?.total_unread_count || 0)
            : 0,
        notification: notifications.filter((item) => !item.is_read).length,
      });
    }

    void loadNavbarState();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

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

  const profileName = profile?.first_name?.trim() || profile?.username || "Profile";
  const profileHandle = profile?.username ? `@${profile.username}` : "Personal space";
  const initials = getInitials(profile?.full_name || profile?.username || "ShareVerse");

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <header className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <NavLink to="/home" className="inline-flex items-center gap-3">
            <BrandMark sizeClass="h-10 w-10" roundedClass="rounded-[12px]" />
            <div className="hidden sm:block">
              <p className="text-lg font-bold text-slate-950">ShareVerse</p>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Split more. Pay less.
              </p>
            </div>
          </NavLink>

          {!isMobile ? (
            <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.to}
                  item={item}
                  active={currentPath === item.to}
                  badge={
                    item.badgeKey === "chat"
                      ? counts.chat
                      : item.badgeKey === "notification"
                        ? counts.notification
                        : 0
                  }
                />
              ))}
            </nav>
          ) : (
            <div className="flex-1" />
          )}

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle themeMode={themeMode} onToggle={toggleTheme} compact />
            {!isMobile ? (
              <>
                <NavLink
                  to="/profile"
                  className="inline-flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {initials}
                  </span>
                  <span className="hidden md:block">
                    <span className="block text-sm font-semibold text-slate-950">{profileName}</span>
                    <span className="block text-xs text-slate-500">{profileHandle}</span>
                  </span>
                </NavLink>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsMoreOpen((current) => !current)}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
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
            <div className="fixed inset-x-4 bottom-24 z-50 rounded-lg border border-slate-200 bg-white p-3 shadow-lg sv-slide-down">
              <div className="space-y-1">
                {MOBILE_MORE_ITEMS.map((item) => {
                  const badge =
                    item.badgeKey === "chat"
                      ? counts.chat
                      : item.badgeKey === "notification"
                        ? counts.notification
                        : 0;

                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => navigate(item.to)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <span className="inline-flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </span>
                      {badge > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {formatBadge(badge)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center rounded-md px-3 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  Log out
                </button>
              </div>
            </div>
          ) : null}

          <nav className="fixed inset-x-4 bottom-4 z-40 grid grid-cols-5 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            {MOBILE_TABS.map((item) => (
              <MobileNavItem
                key={item.to}
                item={item}
                active={currentPath === item.to}
              />
            ))}
            <button
              type="button"
              onClick={() => setIsMoreOpen((current) => !current)}
              className={`flex min-h-[56px] flex-col items-center justify-center rounded-md text-xs font-medium ${
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

function NavItem({ item, active, badge }) {
  return (
    <NavLink
      to={item.to}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <item.icon className="h-4 w-4" />
      <span>{item.label}</span>
      {badge > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            active ? "bg-white/15 text-white" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {formatBadge(badge)}
        </span>
      ) : null}
    </NavLink>
  );
}

function MobileNavItem({ item, active }) {
  return (
    <NavLink
      to={item.to}
      className={`flex min-h-[56px] flex-col items-center justify-center rounded-md text-xs font-medium ${
        active ? "bg-slate-900 text-white" : "text-slate-600"
      }`}
    >
      <item.icon className="h-4 w-4" />
      <span className="mt-1">{item.label}</span>
    </NavLink>
  );
}
