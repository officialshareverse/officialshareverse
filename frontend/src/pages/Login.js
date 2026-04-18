import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import AuthShell from "../components/AuthShell";
import BrandMark from "../components/BrandMark";
import { ClockIcon, ShieldIcon, SparkIcon } from "../components/UiIcons";

const REMEMBER_KEY = "sv-login-remembered-username";
const REMEMBER_PREF_KEY = "sv-login-remember-pref";
const LAST_LOGIN_KEY = "sv-login-last-meta";

function extractApiError(errorData, fallbackMessage) {
  if (!errorData || typeof errorData !== "object") {
    return fallbackMessage;
  }

  if (typeof errorData.error === "string" && errorData.error.trim()) {
    const retryAfter = errorData.retry_after_seconds;
    if (typeof retryAfter === "number" && retryAfter > 0) {
      return `${errorData.error} Try again in ${retryAfter}s.`;
    }
    return errorData.error;
  }

  const firstField = Object.values(errorData)[0];
  if (Array.isArray(firstField) && firstField.length > 0) {
    return firstField[0];
  }

  if (typeof firstField === "string" && firstField.trim()) {
    return firstField;
  }

  return fallbackMessage;
}

function readStoredString(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function readStoredJson(key) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

function formatRelativeLoginTime(value) {
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const deltaMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 7) {
    return `${deltaDays}d ago`;
  }

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function createResetForm(username = "") {
  return {
    username,
    phone: "",
    email: "",
    otp: "",
    new_password: "",
    confirm_password: "",
  };
}

export default function Login({ setIsAuth, themeMode, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const rememberedUsername = readStoredString(REMEMBER_KEY);
  const [form, setForm] = useState({
    username: rememberedUsername,
    password: "",
  });
  const [rememberMe, setRememberMe] = useState(
    () => readStoredString(REMEMBER_PREF_KEY) === "1" || Boolean(rememberedUsername)
  );
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetError, setResetError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState("request");
  const [resetSessionId, setResetSessionId] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [lastLoginMeta, setLastLoginMeta] = useState(() => readStoredJson(LAST_LOGIN_KEY));
  const [resetForm, setResetForm] = useState(() => createResetForm(rememberedUsername));

  useEffect(() => {
    if (location.state?.message) {
      setNotice(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    try {
      window.localStorage.setItem(REMEMBER_PREF_KEY, rememberMe ? "1" : "0");
    } catch {
      // ignore localStorage write issues
    }
  }, [rememberMe]);

  const lastLoginNote = useMemo(() => {
    if (!lastLoginMeta?.time) {
      return "";
    }

    const activeUsername = form.username.trim();
    if (activeUsername && lastLoginMeta.username && lastLoginMeta.username !== activeUsername) {
      return "";
    }

    const relativeTime = formatRelativeLoginTime(lastLoginMeta.time);
    if (!relativeTime) {
      return "";
    }

    return `Last login on this device${lastLoginMeta.username ? ` as @${lastLoginMeta.username}` : ""}: ${relativeTime}`;
  }, [form.username, lastLoginMeta]);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setError("");
  };

  const handleResetChange = (event) => {
    setResetForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setResetError("");
  };

  const closeResetModal = () => {
    setShowReset(false);
    setResetError("");
    setResetStep("request");
    setResetSessionId("");
    setDevOtp("");
    setResetForm(createResetForm(form.username.trim() || rememberedUsername));
  };

  const openResetModal = () => {
    setShowReset(true);
    setResetError("");
    setResetForm((current) => ({
      ...createResetForm(form.username.trim() || rememberedUsername),
      username: current.username || form.username.trim() || rememberedUsername,
    }));
  };

  const requestResetOtp = async () => {
    const username = resetForm.username.trim();
    const phone = resetForm.phone.trim();
    const email = resetForm.email.trim();

    if (!username) {
      setResetError("Enter your username.");
      return;
    }

    if (!phone && !email) {
      setResetError("Add phone or email so we can verify your account.");
      return;
    }

    try {
      setResetLoading(true);
      setResetError("");
      const response = await API.post("forgot-password/request-otp/", {
        username,
        phone,
        email,
      });
      const nextSessionId = response.data?.reset_session_id || "";
      const nextDevOtp = response.data?.dev_otp || "";

      setResetSessionId(nextSessionId);
      setDevOtp(nextDevOtp);
      setResetStep("confirm");
      setNotice(
        nextDevOtp
          ? `OTP sent. Development OTP: ${nextDevOtp}`
          : "OTP sent. Enter the code to reset your password."
      );
    } catch (err) {
      console.error(err);
      setResetError(extractApiError(err.response?.data, "We could not send OTP right now."));
    } finally {
      setResetLoading(false);
    }
  };

  const confirmForgotPassword = async () => {
    const username = resetForm.username.trim();
    const otp = resetForm.otp.trim();
    const newPassword = resetForm.new_password;
    const confirmPassword = resetForm.confirm_password;

    if (!resetSessionId) {
      setResetError("OTP session expired. Request a new code.");
      setResetStep("request");
      return;
    }

    if (!otp || otp.length !== 6) {
      setResetError("Enter the 6-digit OTP.");
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setResetError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    try {
      setResetLoading(true);
      setResetError("");
      await API.post("forgot-password/confirm-otp/", {
        username,
        reset_session_id: resetSessionId,
        otp,
        new_password: newPassword,
      });
      setNotice("Password updated successfully. You can sign in with your new password.");
      closeResetModal();
    } catch (err) {
      console.error(err);
      setResetError(extractApiError(err.response?.data, "We could not reset your password right now."));
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    if (resetStep === "request") {
      await requestResetOtp();
      return;
    }
    await confirmForgotPassword();
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!form.username.trim() || !form.password) {
      setError("Enter your username and password to continue.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const username = form.username.trim();
      const response = await API.post("login/", {
        username,
        password: form.password,
      });

      const nextLastLogin = {
        username,
        time: new Date().toISOString(),
      };

      try {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_KEY, username);
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
        window.localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(nextLastLogin));
        window.localStorage.setItem("token", response.data.access);
      } catch {
        // ignore localStorage write issues
      }

      setLastLoginMeta(nextLastLogin);
      setIsAuth(true);
      navigate("/home", { replace: true });
    } catch (err) {
      console.error(err);
      setError(
        extractApiError(
          err.response?.data,
          err.response?.status === 401
            ? "That username and password combination does not match our records."
            : "We could not sign you in right now. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Return to your wallet, groups, and shared-cost plans."
      subtitle="Log in to manage your group activity, join active digital plans, or complete a buy-together group."
      themeMode={themeMode}
      toggleTheme={toggleTheme}
      footer={
        <div className="space-y-2.5">
          <p className="text-[13px] text-slate-600 sm:text-sm">
            New to ShareVerse?{" "}
            <Link to="/signup" className="font-semibold text-teal-800 hover:text-teal-700">
              Create an account
            </Link>
          </p>
          <p className="text-[11px] leading-5 text-slate-500 sm:text-xs sm:leading-6">
            Need the basics before continuing? Review the{" "}
            <Link to="/terms" className="font-semibold text-teal-800 hover:text-teal-700">
              Terms
            </Link>
            ,{" "}
            <Link to="/privacy" className="font-semibold text-teal-800 hover:text-teal-700">
              Privacy Policy
            </Link>
            ,{" "}
            <Link to="/shipping" className="font-semibold text-teal-800 hover:text-teal-700">
              Shipping Policy
            </Link>
            , and{" "}
            <Link to="/support" className="font-semibold text-teal-800 hover:text-teal-700">
              Support
            </Link>
            .
          </p>
        </div>
      }
    >
      <div className="sv-login-shell">
        <div className="sv-login-brand-row">
          <BrandMark glow sizeClass="h-11 w-11" roundedClass="rounded-[16px]" />
          <div>
            <p className="sv-eyebrow">Login</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-slate-950 sm:text-3xl md:text-[2.35rem]">
              Sign in to ShareVerse
            </h2>
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
          Use the username you created at signup. Your wallet, joined groups, and member activity will be waiting for you.
        </p>

        {lastLoginNote ? (
          <div className="sv-login-activity-chip">
            <ClockIcon className="h-4 w-4" />
            {lastLoginNote}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
          <span className="sv-icon-chip">
            <ShieldIcon className="h-4 w-4" />
            Secure login
          </span>
          <span className="sv-icon-chip">
            <SparkIcon className="h-4 w-4" />
            Wallet and splits in one place
          </span>
        </div>

        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800 sm:mt-5 sm:px-4 sm:py-3 sm:text-sm">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-800 sm:mt-5 sm:px-4 sm:py-3 sm:text-sm">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="mt-5 space-y-4 sm:mt-6">
          <FieldShell label="Username" helper="Enter the username linked to your account.">
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="your-username"
              value={form.username}
              onChange={handleChange}
              className="sv-input"
            />
          </FieldShell>

          <FieldShell label="Password" helper="Use the password you set when creating your account.">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                className="sv-input pr-16 sm:pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="sv-login-password-toggle"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </FieldShell>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="sv-login-check">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              onClick={openResetModal}
              className="text-[13px] font-semibold text-teal-800 hover:text-teal-700 sm:text-sm"
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={loading} className="sv-login-submit">
            {loading ? <span className="sv-login-submit-bar" aria-hidden="true" /> : null}
            <span className="relative z-[1]">{loading ? "Signing you in..." : "Sign in"}</span>
          </button>
        </form>
      </div>

      {showReset ? (
        <ResetPasswordModal
          resetStep={resetStep}
          resetLoading={resetLoading}
          resetError={resetError}
          devOtp={devOtp}
          resetForm={resetForm}
          onChange={handleResetChange}
          onSubmit={handleForgotPassword}
          onClose={closeResetModal}
          onRequestNewOtp={() => {
            setResetStep("request");
            setResetSessionId("");
            setDevOtp("");
            setResetForm((current) => ({
              ...current,
              otp: "",
              new_password: "",
              confirm_password: "",
            }));
          }}
        />
      ) : null}
    </AuthShell>
  );
}

function FieldShell({ label, helper, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-slate-800 sm:mb-2 sm:text-sm">{label}</span>
      {children}
      <span className="mt-1.5 block text-[11px] text-slate-500 sm:mt-2 sm:text-xs">{helper}</span>
    </label>
  );
}

function ResetPasswordModal({
  resetStep,
  resetLoading,
  resetError,
  devOtp,
  resetForm,
  onChange,
  onSubmit,
  onClose,
  onRequestNewOtp,
}) {
  return (
    <div className="sv-modal-backdrop">
      <div className="sv-login-reset-modal">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="sv-eyebrow">Password reset</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
              {resetStep === "request" ? "Request an OTP" : "Confirm OTP and new password"}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="sv-login-modal-close">
            Close
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className={`sv-auth-dot ${resetStep === "request" ? "is-active" : ""}`} />
          <span className={`sv-auth-dot ${resetStep === "confirm" ? "is-active" : ""}`} />
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {resetStep === "request" ? "Step 1 of 2" : "Step 2 of 2"}
          </span>
        </div>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          {resetStep === "request"
            ? "Verify your account with username and phone or email so we can send an OTP."
            : "Enter the six-digit OTP and set the new password you want to use next."}
        </p>

        {resetError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-800 sm:px-4 sm:py-3 sm:text-sm">
            {resetError}
          </div>
        ) : null}

        {devOtp && resetStep === "confirm" ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 sm:px-4 sm:py-3 sm:text-sm">
            Development OTP: <strong>{devOtp}</strong>
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-5 space-y-3.5">
          <div className="sv-login-modal-grid">
            <FieldShell label="Username" helper="This stays tied to the account being recovered.">
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={resetForm.username}
                onChange={onChange}
                disabled={resetStep === "confirm"}
                className="sv-input"
              />
            </FieldShell>

            {resetStep === "request" ? (
              <>
                <FieldShell label="Phone" helper="Optional if you prefer email.">
                  <input
                    type="text"
                    name="phone"
                    placeholder="Phone number"
                    value={resetForm.phone}
                    onChange={onChange}
                    className="sv-input"
                  />
                </FieldShell>
                <FieldShell label="Email" helper="Optional if you prefer phone.">
                  <input
                    type="email"
                    name="email"
                    placeholder="Email address"
                    value={resetForm.email}
                    onChange={onChange}
                    className="sv-input"
                  />
                </FieldShell>
              </>
            ) : (
              <>
                <FieldShell label="OTP" helper="Enter the six-digit code you received.">
                  <input
                    type="text"
                    name="otp"
                    placeholder="6-digit OTP"
                    value={resetForm.otp}
                    onChange={onChange}
                    className="sv-input"
                  />
                </FieldShell>
                <FieldShell label="New password" helper="Use at least 8 characters.">
                  <input
                    type="password"
                    name="new_password"
                    placeholder="New password"
                    value={resetForm.new_password}
                    onChange={onChange}
                    className="sv-input"
                  />
                </FieldShell>
                <FieldShell label="Confirm password" helper="Repeat the new password exactly.">
                  <input
                    type="password"
                    name="confirm_password"
                    placeholder="Confirm new password"
                    value={resetForm.confirm_password}
                    onChange={onChange}
                    className="sv-input"
                  />
                </FieldShell>
              </>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            {resetStep === "confirm" ? (
              <button type="button" onClick={onRequestNewOtp} className="sv-btn-secondary">
                Request new OTP
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="sv-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={resetLoading} className="sv-btn-primary">
              {resetLoading
                ? resetStep === "request"
                  ? "Sending OTP..."
                  : "Resetting password..."
                : resetStep === "request"
                  ? "Send OTP"
                  : "Reset password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
