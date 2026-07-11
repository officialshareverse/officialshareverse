import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import {
  BellIcon,
  LayersIcon,
  ShieldIcon,
  SparkIcon,
  UserIcon,
  WalletIcon,
  StarIcon,
} from "../components/UiIcons";
import { getAuthToken } from "../auth/session";

/* ── Inline chevron for menu rows ── */
function ChevronRight({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/* ── Logout icon ── */
function LogOutIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ── Edit icon ── */
function EditIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export default function Account() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (getAuthToken()) {
      API.get("profile/")
        .then((response) => {
          if (isMounted) setProfile(response.data);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      await API.post("auth/logout/", {});
    } catch {
      // Ignore
    } finally {
      window.location.href = "/";
    }
  };

  const getInitials = (name) => {
    if (!name) return "SV";
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("");
  };

  const displayName = profile?.first_name || profile?.username || "User";
  const email = profile?.email || "";
  const balance = profile?.wallet_balance ? Number(profile.wallet_balance).toFixed(0) : "0";
  const memberSince = profile?.date_joined
    ? new Date(profile.date_joined).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : null;

  return (
    <div className="sv-page sv-account-page">
      <div className="sv-account-shell">

        {/* ── Hero / Profile Header ── */}
        <div className="sv-account-hero">
          {/* Decorative gradient orbs */}
          <div className="sv-account-hero-orb sv-account-hero-orb--1" />
          <div className="sv-account-hero-orb sv-account-hero-orb--2" />

          <div className="sv-account-hero-inner">
            <div className="sv-account-avatar">
              <span className="sv-account-avatar-text">
                {getInitials(displayName)}
              </span>
              <button
                onClick={() => navigate("/profile")}
                className="sv-account-avatar-edit"
                aria-label="Edit profile"
              >
                <EditIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            <h1 className="sv-account-hero-name">{displayName}</h1>
            {email && <p className="sv-account-hero-email">{email}</p>}

            {/* Quick stats row */}
            <div className="sv-account-stats">
              <div className="sv-account-stat">
                <span className="sv-account-stat-value">₹{balance}</span>
                <span className="sv-account-stat-label">Wallet</span>
              </div>
              <div className="sv-account-stat-divider" />
              <div className="sv-account-stat">
                <span className="sv-account-stat-value">
                  <StarIcon className="h-3.5 w-3.5 inline -mt-0.5 text-amber-400" /> 4.9
                </span>
                <span className="sv-account-stat-label">Rating</span>
              </div>
              <div className="sv-account-stat-divider" />
              <div className="sv-account-stat">
                <span className="sv-account-stat-value">{memberSince || "New"}</span>
                <span className="sv-account-stat-label">Member</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Menu Section ── */}
        <div className="sv-account-section">
          <p className="sv-account-section-title">Activity</p>
          <div className="sv-account-menu-card">
            <AccountMenuItem
              icon={<LayersIcon className="h-5 w-5" />}
              label="My Splits"
              subtitle="View and manage your groups"
              iconBg="sv-account-icon--indigo"
              onClick={() => navigate("/my-shared")}
            />
            <AccountMenuItem
              icon={<WalletIcon className="h-5 w-5" />}
              label="Wallet"
              subtitle="Balance, transactions & payouts"
              iconBg="sv-account-icon--emerald"
              trailing={<span className="sv-account-menu-badge">₹{balance}</span>}
              onClick={() => navigate("/wallet")}
            />
            <AccountMenuItem
              icon={<BellIcon className="h-5 w-5" />}
              label="Notifications"
              subtitle="Alerts & activity updates"
              iconBg="sv-account-icon--rose"
              onClick={() => navigate("/notifications")}
              isLast
            />
          </div>
        </div>

        <div className="sv-account-section">
          <p className="sv-account-section-title">More</p>
          <div className="sv-account-menu-card">
            <AccountMenuItem
              icon={<SparkIcon className="h-5 w-5" />}
              label="Refer & Earn"
              subtitle="Invite friends, earn rewards"
              iconBg="sv-account-icon--amber"
              onClick={() => navigate("/referrals")}
            />
            <AccountMenuItem
              icon={<UserIcon className="h-5 w-5" />}
              label="Profile"
              subtitle="Name, phone & preferences"
              iconBg="sv-account-icon--sky"
              onClick={() => navigate("/profile")}
            />
            <AccountMenuItem
              icon={<ShieldIcon className="h-5 w-5" />}
              label="Help & Support"
              subtitle="FAQs, contact & feedback"
              iconBg="sv-account-icon--violet"
              onClick={() => navigate("/support")}
              isLast
            />
          </div>
        </div>

        {/* ── Logout ── */}
        <button onClick={logout} className="sv-account-logout-btn">
          <LogOutIcon className="h-5 w-5" />
          <span>Log Out</span>
        </button>

        {/* ── Footer ── */}
        <p className="sv-account-footer">ShareVerse v1.0.0</p>

      </div>
    </div>
  );
}


/* ── Menu item sub-component ── */
function AccountMenuItem({ icon, label, subtitle, iconBg, trailing, onClick, isLast }) {
  return (
    <button
      onClick={onClick}
      className={`sv-account-menu-item ${isLast ? "" : "sv-account-menu-item--bordered"}`}
    >
      <span className={`sv-account-menu-icon ${iconBg}`}>{icon}</span>
      <div className="sv-account-menu-text">
        <span className="sv-account-menu-label">{label}</span>
        {subtitle && <span className="sv-account-menu-subtitle">{subtitle}</span>}
      </div>
      <div className="sv-account-menu-trailing">
        {trailing}
        <ChevronRight className="h-4 w-4 text-slate-400" />
      </div>
    </button>
  );
}
