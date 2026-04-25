import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { clearAuthSession } from "../auth/session";
import useWebSocket from "../hooks/useWebSocket";
import BrandMark from "./BrandMark";
import ThemeToggle from "./ThemeToggle";
import Tooltip from "./Tooltip";
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
  { to: "/home", label: "Home", mobileLabel: "Home", icon: HomeIcon, mobileTab: true, desktopGroup: "primary" },
  { to: "/groups", label: "Explore", mobileLabel: "Explore", icon: CompassIcon, mobileTab: true, desktopGroup: "primary" },
  { to: "/create", label: "Create", mobileLabel: "Create", icon: PlusIcon, mobileTab: true, desktopGroup: "primary" },
  { to: "/my-shared", label: "My Splits", mobileLabel: "Splits", icon: LayersIcon, mobileTab: true, desktopGroup: "workspace" },
  { to: "/wallet", label: "Wallet", mobileLabel: "Wallet", icon: WalletIcon, mobileTab: false, desktopGroup: "workspace" },
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

export default function Navbar({ setIsAuth, themeMode, toggleTheme }) {
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

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const [chatResponse, notificationResponse] = await Promise.all([
        API.get("group-chats/"),
        API.get("notifications/"),
      ]);
      setUnreadChatCount(chatResponse.data?.total_unread_count || 0);
      const notifications = Array.isArray(notificationResponse.data) ? notificationResponse.data : [];
      setUnreadNotificationCount(notifications.filter((item) => !item.is_read).length);
    } catch (err) {
      console.error("Failed to load navbar badge counts:", err);
    }
  }, []);

  const handleBadgeSocketMessage = useCallback((event) => {
    if (event?.type !== "badge_update") {
      return;
    }

    if (typeof event.unread_chats === "number") {
      setUnreadChatCount(event.unread_chats);
    }
    if (typeof event.unread_notifications === "number") {
      setUnreadNotificationCount(event.unread_notifications);
    }
  }, []);

  const { status: badgeSocketStatus } = useWebSocket("ws/badges/", {
    onMessage: handleBadgeSocketMessage,
  });

  useEffect(() => {
    void fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  useEffect(() => {
    if (badgeSocketStatus === "connected") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void fetchUnreadCounts();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [badgeSocketStatus, fetchUnreadCounts]);

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

  const logout = async () => {
    try {
      await API.post("auth/logout/", {});
    } catch {
      // ignore logout endpoint failures and clear the local session anyway
    }

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

  return (
    <>
      <header className="sticky top-0 z-40" style={{ padding: "var(--sv-page-px)", paddingBottom: 0 }}>
        <div className="sv-container">
          <div className="hidden items-center gap-3 px-3 py-2 sm:px-4 sm:py-2.5 md:px-4 lg:flex sv-brand-shell">
            <div className="sv-navbar-desktop">
              <div className="sv-navbar-brand">
                <BrandMark glow sizeClass="h-10 w-10" />
                <div className="sv-navbar-brand-copy">
                  <h1 className="sv-navbar-brand-title">ShareVerse</h1>
                  <p className="sv-navbar-brand-subtitle">Split more. Pay less.</p>
                </div>
              </div>

              <div className="sv-navbar-center">
                <div className="sv-navbar-scroll">
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
                            className={`sv-desktop-nav-link ${isActive ? "is-active" : ""} ${item.to === "/create" ? "is-create" : ""}`}
                          >
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              <Icon className="h-4 w-4" />
                              {renderNavLabel(item)}
                            </span>
                          </NavLink>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="sv-navbar-actions">
                <ThemeToggle themeMode={themeMode} onToggle={toggleTheme} compact className="sv-navbar-theme-toggle" />

                <div ref={profileMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((current) => !current)}
                    className={`sv-user-trigger sv-navbar-profile ${currentPath === "/profile" || isProfileMenuOpen ? "is-active" : ""}`}
                    aria-haspopup="menu"
                    aria-expanded={isProfileMenuOpen}
                  >
                    <UserAvatar profile={profile} initials={profileInitials} className="sv-navbar-profile-avatar" />
                    <span className="sv-navbar-profile-copy">
                      <span className="sv-navbar-profile-name">{profileFirstName}</span>
                      <span className="sv-navbar-profile-caption">
                        {profile?.username ? `@${profile.username}` : "Account"}
                      </span>
                    </span>
                    <span className={`sv-user-trigger-caret ${isProfileMenuOpen ? "is-open" : ""}`} aria-hidden="true" />
                  </button>

                  {isProfileMenuOpen ? (
                    <div className="sv-user-menu" role="menu">
                      <div className="sv-user-menu-header">
                        <UserAvatar profile={profile} initials={profileInitials} className="sv-user-menu-avatar" />
                        <div className="min-w-0">
                          <p className="sv-user-menu-title">{profileFirstName}</p>
                          <p className="sv-user-menu-meta">
                            {profile?.username ? `@${profile.username}` : "Personal workspace"}
                          </p>
                        </div>
                      </div>

                      <div className="sv-user-menu-divider" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          navigate("/profile");
                        }}
                        className="sv-user-menu-item"
                        role="menuitem"
                      >
                        <UserIcon className="sv-user-menu-icon" />
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={logout}
                        className="sv-user-menu-item text-rose-600"
                        role="menuitem"
                      >
                        <span className="sv-user-menu-badge">
                          !
                        </span>
                        Logout
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:hidden sv-mobile-appbar">
            <div className="min-w-0 flex items-center gap-3">
              <BrandMark glow sizeClass="h-9 w-9" roundedClass="rounded-[14px]" />
              <p className="min-w-0 truncate text-[15px] font-bold leading-none text-slate-950">{currentItem.label}</p>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip content="Notifications">
                <button
                  type="button"
                  onClick={() => navigate("/notifications")}
                  className="sv-mobile-icon-button"
                  aria-label="Open notifications"
                >
                  <BellIcon className="h-4.5 w-4.5" />
                  {unreadNotificationCount > 0 ? <span className="sv-mobile-icon-dot" /> : null}
                </button>
              </Tooltip>
              <Tooltip content={isMenuOpen ? "Close menu" : "Open menu"}>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((current) => !current)}
                  className="sv-mobile-icon-button"
                  aria-label="Toggle navigation"
                  aria-expanded={isMenuOpen}
                >
                  <HamburgerIcon open={isMenuOpen} />
                </button>
              </Tooltip>
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
                    <ThemeToggle themeMode={themeMode} onToggle={toggleTheme} compact />
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
