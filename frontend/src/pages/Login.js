import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { consumeAuthNotice, setAuthToken } from "../auth/session";
import AuthShell from "../components/AuthShell";
import { CheckCircleIcon, LoadingSpinner, ShieldIcon } from "../components/UiIcons";
import useRevealOnScroll from "../hooks/useRevealOnScroll";

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

export default function Login({ setIsAuth }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    username: "",
    password: "",
  });
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
  const [resetForm, setResetForm] = useState({
    username: "",
    phone: "",
    email: "",
    otp: "",
    new_password: "",
    confirm_password: "",
  });

  useRevealOnScroll();

  useEffect(() => {
    const authNotice = consumeAuthNotice();

    if (authNotice) {
      setNotice(authNotice);
    }

    if (location.state?.message) {
      setNotice(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const handleChange = (e) => {
    setForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
    setError("");
  };

  const handleResetChange = (e) => {
    setResetForm((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
    setResetError("");
  };

  const toggleReset = () => {
    const nextShowReset = !showReset;
    setShowReset(nextShowReset);
    setResetError("");
    if (!nextShowReset) {
      setResetStep("request");
      setResetSessionId("");
      setDevOtp("");
      setResetForm({
        username: "",
        phone: "",
        email: "",
        otp: "",
        new_password: "",
        confirm_password: "",
      });
    }
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
      setShowReset(false);
      setResetStep("request");
      setResetSessionId("");
      setDevOtp("");
      setResetForm({
        username: "",
        phone: "",
        email: "",
        otp: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      console.error(err);
      setResetError(extractApiError(err.response?.data, "We could not reset your password right now."));
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (resetStep === "request") {
      await requestResetOtp();
      return;
    }
    await confirmForgotPassword();
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!form.username.trim() || !form.password) {
      setError("Enter your username and password to continue.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await API.post("login/", {
        username: form.username.trim(),
        password: form.password,
      });

      setAuthToken(res.data.access);
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

  const resetPasswordStrength = getPasswordStrength(resetForm.new_password);

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Return to your wallet, groups, and shared-cost plans."
      subtitle="Log in to manage your group activity, join active digital plans, or complete a buy-together group."
      footer={
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            New to ShareVerse?{" "}
            <Link to="/signup" className="font-semibold text-teal-800 hover:text-teal-700">
              Create an account
            </Link>
          </p>
          <p className="text-xs leading-6 text-slate-500">
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
      <div>
        <p className="sv-eyebrow sv-reveal">
          Login
        </p>
        <h2 className="sv-reveal mt-3 text-3xl font-bold leading-tight text-slate-950 md:text-[2.35rem]">
          Sign in to ShareVerse
        </h2>
        <p className="sv-reveal mt-3 text-sm leading-7 text-slate-600">
          Use the username you created at signup. Your wallet, joined groups, and member activity will be waiting for you.
        </p>

        {notice ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="mt-6 space-y-4 sv-stagger">
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
                className="sv-input pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-200"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </FieldShell>

          <button
            type="button"
            onClick={toggleReset}
            className="text-sm font-semibold text-teal-800 hover:text-teal-700"
          >
            {showReset ? "Hide password reset" : "Forgot password?"}
          </button>

          {showReset ? (
            <div className="sv-glass-card rounded-[24px] p-4 shadow-[0_12px_24px_rgba(15,23,42,0.04)]">
              <p className="text-sm font-semibold text-slate-900">Reset your password</p>
              <p className="mt-1 text-xs text-slate-600">
                {resetStep === "request"
                  ? "Verify your account with username and phone or email to receive OTP."
                  : "Enter OTP and your new password to finish reset."}
              </p>

              {resetError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {resetError}
                </div>
              ) : null}

              {devOtp && resetStep === "confirm" ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Development OTP: <strong>{devOtp}</strong>
                </div>
              ) : null}

              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={resetForm.username}
                  onChange={handleResetChange}
                  disabled={resetStep === "confirm"}
                  className="sv-input rounded-xl px-3 py-2"
                />

                {resetStep === "request" ? (
                  <>
                    <input
                      type="text"
                      name="phone"
                      placeholder="Phone number (optional if email is used)"
                      value={resetForm.phone}
                      onChange={handleResetChange}
                      className="sv-input rounded-xl px-3 py-2"
                    />

                    <input
                      type="email"
                      name="email"
                      placeholder="Email (optional if phone is used)"
                      value={resetForm.email}
                      onChange={handleResetChange}
                      className="sv-input rounded-xl px-3 py-2"
                    />
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      name="otp"
                      placeholder="6-digit OTP"
                      value={resetForm.otp}
                      onChange={handleResetChange}
                      className="sv-input rounded-xl px-3 py-2"
                    />

                    <input
                      type="password"
                      name="new_password"
                      placeholder="New password"
                      value={resetForm.new_password}
                      onChange={handleResetChange}
                      className="sv-input rounded-xl px-3 py-2"
                    />

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <span>Password strength</span>
                        <span className={resetPasswordStrength.tone}>{resetPasswordStrength.label}</span>
                      </div>
                      <div className="sv-password-meter">
                        <div className={`sv-password-meter-fill ${resetPasswordStrength.fill}`} style={{ width: `${resetPasswordStrength.width}%` }} />
                      </div>
                    </div>

                    <input
                      type="password"
                      name="confirm_password"
                      placeholder="Confirm new password"
                      value={resetForm.confirm_password}
                      onChange={handleResetChange}
                      className="sv-input rounded-xl px-3 py-2"
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
                >
                  {resetLoading ? <LoadingSpinner /> : resetStep === "request" ? <ShieldIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
                  {resetLoading
                    ? resetStep === "request"
                      ? "Sending OTP..."
                      : "Resetting password..."
                    : resetStep === "request"
                      ? "Send OTP"
                      : "Reset password"}
                </button>

                {resetStep === "confirm" ? (
                  <button
                    type="button"
                    onClick={() => {
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Request new OTP
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[22px] bg-slate-950 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? <LoadingSpinner /> : <ShieldIcon className="h-4 w-4" />}
            {loading ? "Signing you in..." : "Sign in"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

function FieldShell({ label, helper, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      {children}
      <span className="mt-2 block text-xs text-slate-500">{helper}</span>
    </label>
  );
}

function getPasswordStrength(password) {
  const value = password || "";
  if (!value) {
    return {
      label: "Not set",
      width: 0,
      fill: "bg-slate-300",
      tone: "text-slate-400",
    };
  }

  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) {
    return { label: "Weak", width: 28, fill: "bg-rose-500", tone: "text-rose-600" };
  }
  if (score === 2) {
    return { label: "Fair", width: 55, fill: "bg-amber-500", tone: "text-amber-600" };
  }
  if (score === 3) {
    return { label: "Strong", width: 78, fill: "bg-sky-500", tone: "text-sky-600" };
  }
  return { label: "Great", width: 100, fill: "bg-emerald-500", tone: "text-emerald-600" };
}
