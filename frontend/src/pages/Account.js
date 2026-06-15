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
} from "../components/UiIcons";
import { getAuthToken } from "../auth/session";

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
    return name.substring(0, 2).toUpperCase();
  };

  const balance = profile?.wallet_balance ? Number(profile.wallet_balance).toFixed(0) : "0";

  return (
    <div className="sv-page bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="mx-auto max-w-md p-4 space-y-6">
        
        {/* Profile Header */}
        <div className="sv-card p-5 mt-2 sv-reveal">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-xl font-bold text-white shadow-md">
              {getInitials(profile?.first_name || profile?.username)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold text-slate-900 dark:text-white">
                {profile?.first_name || profile?.username || "Account"}
              </h1>
              <p className="truncate text-sm font-medium text-slate-500">
                {profile?.email || "Welcome to ShareVerse"}
              </p>
            </div>
            <button
              onClick={() => navigate("/profile")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            >
              <UserIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="sv-card overflow-hidden sv-reveal" style={{ animationDelay: "0.05s" }}>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            
            <button onClick={() => navigate("/my-shared")} className="flex w-full items-center justify-between p-4 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <LayersIcon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold text-slate-700 dark:text-slate-200">My Splits</span>
              </div>
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>

            <button onClick={() => navigate("/wallet")} className="flex w-full items-center justify-between p-4 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <WalletIcon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold text-slate-700 dark:text-slate-200">Wallet Balance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">Rs {balance}</span>
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            </button>

            <button onClick={() => navigate("/notifications")} className="flex w-full items-center justify-between p-4 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                  <BellIcon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold text-slate-700 dark:text-slate-200">Notifications</span>
              </div>
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>

            <button onClick={() => navigate("/referrals")} className="flex w-full items-center justify-between p-4 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <SparkIcon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold text-slate-700 dark:text-slate-200">Refer and Earn</span>
              </div>
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>

            <button onClick={() => navigate("/support")} className="flex w-full items-center justify-between p-4 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
                  <ShieldIcon className="h-5 w-5" />
                </span>
                <span className="text-base font-semibold text-slate-700 dark:text-slate-200">Help & Support</span>
              </div>
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>

          </div>
        </div>

        {/* Logout Section */}
        <div className="sv-card overflow-hidden sv-reveal" style={{ animationDelay: "0.1s" }}>
          <button onClick={logout} className="flex w-full items-center justify-between p-4 transition hover:bg-rose-50 active:bg-rose-100 dark:hover:bg-rose-900/20">
            <span className="text-base font-bold text-rose-600 dark:text-rose-400">Log Out</span>
            <svg className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div className="text-center pb-24 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">ShareVerse v1.0.0</p>
        </div>

      </div>
    </div>
  );
}
