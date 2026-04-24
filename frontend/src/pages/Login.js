import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { setAuthToken } from "../auth/session";
import AuthShell from "../components/AuthShell";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { buildLastLoginNote, createResetForm, extractApiError } from "./loginUtils";

const REMEMBER_KEY = "sv-login-remembered-username";
const REMEMBER_PREF_KEY = "sv-login-remember-pref";
const LAST_LOGIN_KEY = "sv-login-last-meta";

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
    return buildLastLoginNote(lastLoginMeta, form.username.trim());
  }, [form.username, lastLoginMeta]);

  function handleChange(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setError("");
  }

  function handleResetChange(event) {
    setResetForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setResetError("");
  }

  function resetForgotPasswordState() {
    setResetStep("request");
    setResetSessionId("");
    setDevOtp("");
    setResetError("");
    setResetForm(createResetForm(form.username.trim() || rememberedUsername));
  }

  async function requestResetOtp() {
    const username = resetForm.username.trim();
    const phone = resetForm.phone.trim();
    const email = resetForm.email.trim();

    if (!username) {
      setResetError("Enter your username or email.");
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

      setResetSessionId(response.data?.reset_session_id || "");
      setDevOtp(response.data?.dev_otp || "");
      setResetStep("confirm");
    } catch (requestError) {
      console.error(requestError);
      setResetError(extractApiError(requestError.response?.data, "We could not send OTP right now."));
    } finally {
      setResetLoading(false);
    }
  }

  async function confirmForgotPassword() {
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
      setShowReset(false);
      resetForgotPasswordState();
    } catch (confirmError) {
      console.error(confirmError);
      setResetError(extractApiError(confirmError.response?.data, "We could not reset your password right now."));
    } finally {
      setResetLoading(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    if (resetStep === "request") {
      await requestResetOtp();
      return;
    }
    await confirmForgotPassword();
  }

  async function handleLogin(event) {
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

      completeSignIn(response.data, username);
    } catch (loginError) {
      console.error(loginError);
      setError(
        extractApiError(
          loginError.response?.data,
          loginError.response?.status === 401
            ? "That username and password combination does not match our records."
            : "We could not sign you in right now. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function completeSignIn(payload, fallbackUsername = "") {
    const accessToken = payload?.access || "";
    const resolvedUsername = (payload?.user?.username || fallbackUsername || "").trim();

    if (!accessToken) {
      setError("We could not finish signing you in right now. Please try again.");
      return;
    }

    const nextLastLogin = {
      username: resolvedUsername,
      time: new Date().toISOString(),
    };

    try {
      if (rememberMe && resolvedUsername) {
        window.localStorage.setItem(REMEMBER_KEY, resolvedUsername);
      } else if (!rememberMe) {
        window.localStorage.removeItem(REMEMBER_KEY);
      }
      window.localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify(nextLastLogin));
      setAuthToken(accessToken);
    } catch {
      // ignore localStorage write issues
    }

    setLastLoginMeta(nextLastLogin);
    setIsAuth(true);
    navigate("/home", { replace: true });
  }

  function handleGoogleSuccess(payload) {
    setError("");
    completeSignIn(payload, payload?.user?.username || "");
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Access your wallet, splits, chats, and account activity."
      themeMode={themeMode}
      toggleTheme={toggleTheme}
      footer={
        <p className="text-sm text-slate-600">
          New to ShareVerse?{" "}
          <Link to="/signup" className="font-semibold text-teal-700">
            Create an account
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        {lastLoginNote ? (
          <p className="text-xs text-slate-500">{lastLoginNote}</p>
        ) : null}

        <GoogleAuthButton
          mode="signin"
          themeMode={themeMode}
          disabled={loading || resetLoading}
          title="Continue with Google"
          description="Use your verified Google email to sign in instantly or match an existing ShareVerse account."
          note="We only use your verified Google email to sign you in safely."
          onSuccess={handleGoogleSuccess}
          onError={setError}
        />

        <div className="sv-google-auth-divider">
          <span>Or sign in with password</span>
        </div>

        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Username or email</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="your-username or you@example.com"
              value={form.username}
              onChange={handleChange}
              className="sv-input"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                className="sv-input pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => {
                setShowReset((current) => !current);
                setResetError("");
                setResetForm((current) => ({
                  ...createResetForm(form.username.trim() || rememberedUsername),
                  username: current.username || form.username.trim() || rememberedUsername,
                }));
              }}
              className="text-sm font-semibold text-teal-700"
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={loading} className="sv-btn-primary w-full">
            {loading ? "Signing you in..." : "Sign in"}
          </button>
        </form>

        {showReset ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Reset password</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {resetStep === "request"
                    ? "Send an OTP using your username and either phone or email."
                    : "Enter the OTP and set your new password."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowReset(false);
                  resetForgotPasswordState();
                }}
                className="text-sm font-medium text-slate-500"
              >
                Close
              </button>
            </div>

            {resetError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {resetError}
              </div>
            ) : null}

            {devOtp && resetStep === "confirm" ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Development OTP: <strong>{devOtp}</strong>
              </div>
            ) : null}

            <form onSubmit={handleForgotPassword} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Username or email</label>
                  <input
                    type="text"
                    name="username"
                    placeholder="Username or email"
                    value={resetForm.username}
                    onChange={handleResetChange}
                    disabled={resetStep === "confirm"}
                    className="sv-input"
                  />
                </div>

                {resetStep === "request" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Phone</label>
                      <input
                        type="text"
                        name="phone"
                        placeholder="Phone number"
                        value={resetForm.phone}
                        onChange={handleResetChange}
                        className="sv-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Email</label>
                      <input
                        type="email"
                        name="email"
                        placeholder="Email address"
                        value={resetForm.email}
                        onChange={handleResetChange}
                        className="sv-input"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">OTP</label>
                      <input
                        type="text"
                        name="otp"
                        placeholder="6-digit OTP"
                        value={resetForm.otp}
                        onChange={handleResetChange}
                        className="sv-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">New password</label>
                      <input
                        type="password"
                        name="new_password"
                        placeholder="New password"
                        value={resetForm.new_password}
                        onChange={handleResetChange}
                        className="sv-input"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Confirm password</label>
                      <input
                        type="password"
                        name="confirm_password"
                        placeholder="Confirm new password"
                        value={resetForm.confirm_password}
                        onChange={handleResetChange}
                        className="sv-input"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                {resetStep === "confirm" ? (
                  <button
                    type="button"
                    onClick={resetForgotPasswordState}
                    className="sv-btn-secondary"
                  >
                    Request new OTP
                  </button>
                ) : null}
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
        ) : null}
      </div>
    </AuthShell>
  );
}
