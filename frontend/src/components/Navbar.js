import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { getPaginatedCount, getPaginatedItems } from "../api/pagination";
import { clearAuthSession } from "../auth/session";
import { useProfile } from "../hooks/useProfile";
import useWebSocket from "../hooks/useWebSocket";
import BrandMark from "./BrandMark";
import ThemeToggle from "./ThemeToggle";
import {
  BellIcon,
  ChatIcon,
  CompassIcon,
  HomeIcon,
  LayersIcon,
  PlusIcon,
  SparkIcon,
  UserIcon,
  WalletIcon,
} from "./UiIcons";

const navItems = [
  { to: "/home", label: "Home", mobileLabel: "Home", icon: HomeIcon, mobileTab: true, desktopGroup: "primary" },
  { to: "/groups", label: "Explore", mobileLabel: "Explore", icon: CompassIcon, mobileTab: true, desktopGroup: "primary" },
  { to: "/create", label: "Create", mobileLabel: "Create", icon: PlusIcon, mobileTab: true, desktopGroup: "primary" },
  { to: "/chats", label: "Chats", mobileLabel: "Chats", icon: ChatIcon, badgeKey: "chat", desktopGroup: "signals", mobileTab: true },
  { to: "/account", label: "Account", mobileLabel: "Account", icon: UserIcon, mobileTab: true, desktopGroup: "hidden", badgeKey: "notification" },
  { to: "/my-shared", label: "My Splits", mobileLabel: "Splits", icon: LayersIcon, mobileTab: false, desktopGroup: "workspace" },
  { to: "/wallet", label: "Wallet", mobileLabel: "Wallet", icon: WalletIcon, mobileTab: false, desktopGroup: "workspace" },
  { to: "/referrals", label: "Refer and earn", mobileLabel: "Refer", icon: SparkIcon, mobileMenu: true },
  { to: "/notifications", label: "Notifications", mobileLabel: "Alerts", icon: BellIcon, badgeKey: "notification", desktopGroup: "signals" },
  { to: "/profile", label: "Profile", mobileLabel: "Profile", icon: UserIcon },
];

const desktopNavGroups = [
  { id: "primary", items: navItems.filter((item) => item.desktopGroup === "primary") },
  { id: "workspace", items: navItems.filter((item) => item.desktopGroup === "workspace") },
  { id: "signals", items: navItems.filter((item) => item.desktopGroup === "signals") },
];

const mobileTabItems = navItems.filter((item) => item.mobileTab);

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
  if (pathname.startsWith("/referrals")) {
    return "/referrals";
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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const { data: profile } = useProfile();
  const [indicatorStyles, setIndicatorStyles] = useState({});
  const profileMenuRef = useRef(null);
  const groupRefs = useRef({});
  const itemRefs = useRef({});
  const currentPath = resolveCurrentPath(location.pathname);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [location.pathname]);

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const [chatResponse, notificationResponse] = await Promise.all([
        API.get("group-chats/"),
        API.get("notifications/", { params: { is_read: "false", page_size: 1 } }),
      ]);
      setUnreadChatCount(chatResponse.data?.total_unread_count || 0);
      const notificationCount = getPaginatedCount(notificationResponse.data);
      const notifications = getPaginatedItems(notificationResponse.data);
      setUnreadNotificationCount(
        typeof notificationResponse.data?.count === "number"
          ? notificationCount
          : notifications.filter((item) => !item.is_read).length
      );
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
    if ("setAppBadge" in navigator) {
      const totalUnread = unreadChatCount + unreadNotificationCount;
      if (totalUnread > 0) {
        navigator.setAppBadge(totalUnread).catch((error) => {
          console.error("Failed to set app badge:", error);
        });
      } else {
        navigator.clearAppBadge().catch((error) => {
          console.error("Failed to clear app badge:", error);
        });
      }
    }
  }, [unreadChatCount, unreadNotificationCount]);

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
    if (item.to === "/wallet" && profile && typeof profile.wallet_balance !== "undefined") {
      const balance = Number(profile.wallet_balance || 0);
      return (
        <span className="inline-flex items-center gap-2">
          <span>{item.label}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-slate-800 dark:bg-slate-800 dark:text-slate-200">
            Rs {balance.toFixed(2)}
          </span>
        </span>
      );
    }

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
      <header className="sv-app-navbar">
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
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          navigate("/referrals");
                        }}
                        className="sv-user-menu-item"
                        role="menuitem"
                      >
                        <SparkIcon className="sv-user-menu-icon" />
                        Refer and earn
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


        </div>
      </header>

      <nav className="sv-mobile-tabbar lg:hidden" aria-label="Primary navigation">
        <div className="sv-mobile-tabbar-inner">
          {mobileTabItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.to;
            const isCreate = item.to === "/create";
            const badgeCount = getBadgeCount(item);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`sv-mobile-tab ${isActive ? "sv-mobile-tab-active" : ""} ${isCreate ? "sv-mobile-tab-create" : ""}`}
              >
                <span className="sv-mobile-tab-icon relative">
                  <Icon className="h-4.5 w-4.5" />
                  {badgeCount > 0 && !isCreate ? (
                    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  ) : null}
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
