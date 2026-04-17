import { useEffect, useMemo, useRef, useState } from "react";
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
  SearchIcon,
  UserIcon,
  WalletIcon,
} from "./UiIcons";

const navItems = [
  { to: "/home", label: "Home", mobileLabel: "Home", icon: HomeIcon, mobileTab: true, desktopGroup: "primary" },
  { to: "/groups", label: "Explore", mobileLabel: "Explore", icon: CompassIcon, mobileTab: true, desktopGroup: "primary" },
  { to: "/create", label: "Create", mobileLabel: "Create", icon: PlusIcon, mobileTab: true, desktopGroup: "primary" },
  { to: "/my-shared", label: "My Splits", mobileLabel: "My Splits", icon: LayersIcon, mobileTab: true, desktopGroup: "workspace" },
  { to: "/wallet", label: "Wallet", mobileLabel: "Wallet", icon: WalletIcon, mobileTab: true, desktopGroup: "workspace" },
  { to: "/notifications", label: "Notifications", mobileLabel: "Alerts", icon: BellIcon, badgeKey: "notification", desktopGroup: "signals" },
  { to: "/chats", label: "Chats", mobileLabel: "Chats", icon: ChatIcon, badgeKey: "chat", desktopGroup: "signals" },
  { to: "/profile", label: "Profile", mobileLabel: "Profile", icon: UserIcon },
];

const desktopNavGroups = [
  { id: "primary", items: navItems.filter((item) => item.desktopGroup === "primary") },
  { id: "workspace", items: navItems.filter((item) => item.desktopGroup === "workspace") },
  { id: "signals", items: navItems.filter((item) => item.desktopGroup === "signals") },
];

const mobileTabItems = navItems.filter((item) => item.mobileTab);
const mobileMenuItems = navItems.filter((item) => !item.mobileTab);

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

function HamburgerIcon({ open }) {
  return (
    <span className={`sv-hamburger ${open ? "is-open" : ""}`} aria-hidden="true">
      <span className="sv-hamburger-line" />
      <span className="sv-hamburger-line" />
      <span className="sv-hamburger-line" />
    </span>
  );
}

function SunIcon({ className = "h-4.5 w-4.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23 5.46 5.46" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon({ className = "h-4.5 w-4.5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M20 14.25A8.25 8.25 0 0 1 9.75 4a8.5 8.5 0 1 0 10.25 10.25Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ThemeToggleButton({ themeMode, onClick, compact = false }) {
  const isDark = themeMode === "dark";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`sv-theme-toggle ${compact ? "sv-theme-toggle-compact" : ""}`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span className="sv-theme-toggle-icon">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      {compact ? null : <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}

function UserAvatar({ profile, initials, className = "" }) {
  if (profile?.profile_picture_url) {
    return <img src={profile.profile_picture_url} alt="" className={`sv-nav-avatar ${className}`.trim()} />;
  }

  return (
    <span className={`sv-nav-avatar sv-nav-avatar-fallback ${className}`.trim()} aria-hidden="true">
      {initials}
    </span>
  );
}

export default function Navbar({ setIsAuth, themeMode, toggleTheme, openSpotlight }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [profile, setProfile] = useState(null);
  const [indicatorStyles, setIndicatorStyles] = useState({});
  const profileMenuRef = useRef(null);
  const groupRefs = useRef({});
  const itemRefs = useRef({});
  const currentPath = resolveCurrentPath(location.pathname);
  const currentItem = navItems.find((item) => item.to === currentPath) || navItems[0];

  useEffect(() => {
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
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

  useEffect(() => {
    let isMounted = true;

    API.get("profile/")
      .then((response) => {
        if (isMounted) {
          setProfile(response.data || null);
        }
      })
      .catch((error) => {
        console.error("Failed to load navbar profile:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isProfileMenuOpen]);

  useEffect(() => {
    const updateIndicators = () => {
      const nextStyles = {};

      desktopNavGroups.forEach((group) => {
        const activeItem = group.items.find((item) => item.to === currentPath);
        const groupElement = groupRefs.current[group.id];
        const activeElement = activeItem ? itemRefs.current[activeItem.to] : null;

        if (!groupElement || !activeElement) {
          nextStyles[group.id] = { opacity: 0, width: "0px", transform: "translateX(0px)" };
          return;
        }

        nextStyles[group.id] = {
          opacity: 1,
          width: `${activeElement.offsetWidth}px`,
          transform: `translateX(${activeElement.offsetLeft}px)`,
        };
      });

      setIndicatorStyles(nextStyles);
    };

    const frameId = window.requestAnimationFrame(updateIndicators);
    window.addEventListener("resize", updateIndicators);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateIndicators);
    };
  }, [currentPath, unreadChatCount, unreadNotificationCount]);

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

  const profileFirstName =
    profile?.first_name?.trim() ||
    profile?.full_name?.split(" ").filter(Boolean)[0] ||
    profile?.username ||
    "there";

  const profileInitials = useMemo(() => {
    const source = profile?.full_name || profile?.username || "SV";
    return (
      source
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "SV"
    );
  }, [profile]);

  const spotlightModifier = useMemo(() => {
    if (typeof window === "undefined") {
      return "Ctrl";
    }

    const platform = window.navigator.platform || window.navigator.userAgent || "";
    return /Mac|iPhone|iPad/i.test(platform) ? "Cmd" : "Ctrl";
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40" style={{ padding: "var(--sv-page-px)", paddingBottom: 0 }}>
        <div className="sv-container">
          <div className="hidden items-center justify-between gap-4 px-3 py-2.5 sm:px-4 sm:py-3 md:px-5 lg:flex sv-brand-shell">
            <div className="min-w-0 flex items-center gap-3">
              <BrandMark glow sizeClass="h-10 w-10" />
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-none text-slate-950 sm:text-lg md:text-xl">
                  ShareVerse
                </h1>
                <p className="mt-0.5 hidden text-[9px] uppercase tracking-[0.16em] text-slate-500 sm:block sm:text-[10px]">
                  Split more. Pay less.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
              {desktopNavGroups.map((group) => (
                <div
                  key={group.id}
                  ref={(node) => {
                    groupRefs.current[group.id] = node;
                  }}
                  className="sv-desktop-nav-group"
                >
                  <span className="sv-desktop-nav-indicator" style={indicatorStyles[group.id] || { opacity: 0 }} />
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPath === item.to;

                    return (
                      <NavLink
                        key={item.to}
                        ref={(node) => {
                          itemRefs.current[item.to] = node;
                        }}
                        to={item.to}
                        className={`sv-desktop-nav-link ${isActive ? "is-active" : ""}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {renderNavLabel(item)}
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={openSpotlight}
                className="sv-spotlight-trigger sv-focus-ring"
                aria-label={`Open search (${spotlightModifier} K)`}
              >
                <SearchIcon className="h-4.5 w-4.5" />
                <span className="sv-spotlight-trigger-label">Search</span>
                <span className="sv-spotlight-trigger-keys" aria-hidden="true">
                  <span className="sv-spotlight-kbd">{spotlightModifier}</span>
                  <span className="sv-spotlight-kbd">K</span>
                </span>
              </button>

              <ThemeToggleButton themeMode={themeMode} onClick={toggleTheme} />

              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((current) => !current)}
                  className={`sv-user-trigger ${currentPath === "/profile" || isProfileMenuOpen ? "is-active" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                >
                  <UserAvatar profile={profile} initials={profileInitials} />
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-sm font-semibold text-slate-950">
                      {profileFirstName}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      Account
                    </span>
                  </span>
                  <span className={`sv-user-trigger-caret ${isProfileMenuOpen ? "is-open" : ""}`} aria-hidden="true" />
                </button>

                {isProfileMenuOpen ? (
                  <div className="sv-user-menu" role="menu">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        navigate("/profile");
                      }}
                      className="sv-user-menu-item"
                      role="menuitem"
                    >
                      <UserIcon className="h-4.5 w-4.5" />
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={logout}
                      className="sv-user-menu-item text-rose-600"
                      role="menuitem"
                    >
                      <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-600">
                        !
                      </span>
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="lg:hidden sv-mobile-appbar">
            <div className="min-w-0 flex items-center gap-3">
              <BrandMark glow sizeClass="h-9 w-9" roundedClass="rounded-[14px]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-none text-slate-950">Hi, {profileFirstName}</p>
                <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{currentItem.label}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openSpotlight}
                className="sv-mobile-icon-button"
                aria-label="Open search"
              >
                <SearchIcon className="h-4.5 w-4.5" />
              </button>
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
                aria-expanded={isMenuOpen}
              >
                <HamburgerIcon open={isMenuOpen} />
              </button>
            </div>
          </div>

          {isMenuOpen ? (
            <>
              <button
                type="button"
                className="sv-mobile-menu-overlay lg:hidden"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close menu"
              />

              <div className="sv-slide-down sv-mobile-menu-panel lg:hidden">
                <div className="sv-mobile-menu-surface">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Quick access</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900">Hi, {profileFirstName}</p>
                    </div>
                    <ThemeToggleButton themeMode={themeMode} onClick={toggleTheme} compact />
                  </div>

                  <div className="sv-mobile-shortcuts">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate("/create");
                      }}
                      className="sv-mobile-shortcut"
                    >
                      <PlusIcon className="h-4.5 w-4.5" />
                      New split
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate("/wallet");
                      }}
                      className="sv-mobile-shortcut"
                    >
                      <WalletIcon className="h-4.5 w-4.5" />
                      Top up wallet
                    </button>
                  </div>

                  <nav className="mt-3 grid gap-2">
                    {mobileMenuItems.map((item, index) => {
                      const Icon = item.icon;
                      const count = getBadgeCount(item);
                      const isActive = currentPath === item.to;

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMenuOpen(false)}
                          className={`sv-mobile-menu-item ${isActive ? "is-active" : ""}`}
                          style={{ animationDelay: `${0.04 * (index + 1)}s` }}
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

                  <button
                    type="button"
                    onClick={logout}
                    className="sv-mobile-logout"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </header>

      <nav className="sv-mobile-tabbar lg:hidden" aria-label="Primary navigation">
        <div className="sv-mobile-tabbar-inner">
          {mobileTabItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.to;
            const isCreate = item.to === "/create";

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`sv-mobile-tab ${isActive ? "sv-mobile-tab-active" : ""} ${isCreate ? "sv-mobile-tab-create" : ""}`}
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
