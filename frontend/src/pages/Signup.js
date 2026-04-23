import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import API from "../api/axios";
import { setAuthToken } from "../auth/session";
import AuthShell from "../components/AuthShell";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useToast } from "../components/ToastProvider";
import {
  CheckCircleIcon,
  LoadingSpinner,
  ShieldIcon,
  SparkIcon,
} from "../components/UiIcons";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const USERNAME_CHECK_DELAY_MS = 380;

function getSignupError(errorData) {
  if (!errorData || typeof errorData !== "object") {
    return "We could not create your account right now.";
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

  return "We could not create your account right now.";
}

function validateIdentityStep(form, usernameStatus) {
  if (!form.username.trim()) {
    return "Choose a username to continue.";
  }
  if (usernameStatus.state === "checking") {
    return "We are still checking that username. Give it a second.";
  }
  if (usernameStatus.state === "taken") {
    return "Choose a different username before continuing.";
  }
  return "";
}

function validateContactStep(form) {
  if (!form.email.trim()) {
    return "Email is required.";
  }
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    return "Enter a valid email address.";
  }
  return "";
}

function validateSecurityStep(form, acceptedTerms) {
  if (!form.password) {
    return "Create a password to continue.";
  }
  if (form.password.length < 8) {
    return "Use at least 8 characters for your password.";
  }
  if (form.password !== form.confirmPassword) {
    return "Password confirmation does not match.";
  }
  if (!acceptedTerms) {
    return "Please accept the Terms & Conditions before creating your account.";
  }
  return "";
}

function validateVerificationStep(signupSessionId, otpCode) {
  if (!signupSessionId) {
    return "Send a verification code before creating your account.";
  }
  if (!/^\d{6}$/.test(otpCode.trim())) {
    return "Enter the 6-digit verification code to finish creating your account.";
  }
  return "";
}

function getPasswordStrength(password) {
  const value = password || "";
  if (!value) {
    return { label: "Not set", width: 0, fill: "bg-slate-300", tone: "text-slate-400" };
  }

  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 1) return { label: "Weak", width: 28, fill: "bg-rose-500", tone: "text-rose-600" };
  if (score === 2) return { label: "Fair", width: 55, fill: "bg-amber-500", tone: "text-amber-600" };
  if (score === 3) return { label: "Strong", width: 78, fill: "bg-sky-500", tone: "text-sky-600" };
  return { label: "Great", width: 100, fill: "bg-emerald-500", tone: "text-emerald-600" };
}

function getPasswordChecklist(password) {
  const value = password || "";
  return [
    { label: "8+ characters", ready: value.length >= 8 },
    { label: "Upper + lowercase letters", ready: /[A-Z]/.test(value) && /[a-z]/.test(value) },
    { label: "At least one number", ready: /\d/.test(value) },
    { label: "One symbol", ready: /[^A-Za-z0-9]/.test(value) },
  ];
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getUsernameStatusCopy(status) {
  if (status.state === "checking") {
    return { className: "is-checking", title: "Checking username", body: "Making sure nobody else has already claimed it." };
  }
  if (status.state === "available") {
    return { className: "is-available", title: "Username available", body: status.message };
  }
  if (status.state === "taken") {
    return { className: "is-taken", title: "Pick another username", body: status.message };
  }
  if (status.state === "error") {
    return { className: "is-neutral", title: "Could not confirm just yet", body: status.message };
  }
  return { className: "is-neutral", title: "Pick your login name", body: "Choose something simple and memorable. We will check if it is available as you type." };
}

function getSignupButtonLabel(hasVerificationSession) {
  return hasVerificationSession ? "Verify code & create account" : "Send verification code";
}

export default function Signup({ setIsAuth, themeMode, toggleTheme }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [signupSessionId, setSignupSessionId] = useState("");
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [devOtp, setDevOtp] = useState("");
  const [deliveryChannel, setDeliveryChannel] = useState("email");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState({ state: "idle", message: "" });
  const [otpExpiryAt, setOtpExpiryAt] = useState(0);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState(0);
  const [clockTick, setClockTick] = useState(Date.now());
  const usernameRequestSequenceRef = useRef(0);
  const otpInputsRef = useRef([]);
  const submitSignupRef = useRef(async () => false);
  const lastAutoSubmittedOtpRef = useRef("");

  const hasVerificationSession = Boolean(signupSessionId);
  const passwordStrength = getPasswordStrength(form.password);
  const passwordChecklist = useMemo(() => getPasswordChecklist(form.password), [form.password]);
  const otpCode = otpDigits.join("");
  const remainingExpirySeconds = otpExpiryAt ? Math.max(0, Math.ceil((otpExpiryAt - clockTick) / 1000)) : 0;
  const remainingCooldownSeconds = otpCooldownUntil ? Math.max(0, Math.ceil((otpCooldownUntil - clockTick) / 1000)) : 0;
  const usernameStatusCopy = getUsernameStatusCopy(usernameStatus);
  const submitDisabled = loading || otpLoading || (hasVerificationSession && otpDigits.some((digit) => !digit));

  const resetOtpState = (nextNotice = "") => {
    setSignupSessionId("");
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setDevOtp("");
    setDeliveryChannel("email");
    setVerificationNotice(nextNotice);
    setOtpExpiryAt(0);
    setOtpCooldownUntil(0);
    lastAutoSubmittedOtpRef.current = "";
  };

  useEffect(() => {
    const trimmedUsername = form.username.trim();
    if (!trimmedUsername) {
      setUsernameStatus({ state: "idle", message: "" });
      return undefined;
    }
    if (trimmedUsername.length < 3) {
      setUsernameStatus({ state: "error", message: "Use at least 3 characters so your username is easy to recognize." });
      return undefined;
    }

    const requestId = usernameRequestSequenceRef.current + 1;
    usernameRequestSequenceRef.current = requestId;
    setUsernameStatus({ state: "checking", message: "" });

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await API.post("signup/check-availability/", { username: trimmedUsername });
        if (usernameRequestSequenceRef.current !== requestId) {
          return;
        }
        setUsernameStatus({
          state: response.data?.available ? "available" : "taken",
          message: response.data?.message || "",
        });
      } catch (err) {
        if (usernameRequestSequenceRef.current !== requestId) {
          return;
        }
        setUsernameStatus({ state: "error", message: getSignupError(err.response?.data) });
      }
    }, USERNAME_CHECK_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [form.username]);

  useEffect(() => {
    if (!otpExpiryAt && !otpCooldownUntil) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      setClockTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [otpCooldownUntil, otpExpiryAt]);

  useEffect(() => {
    if (!hasVerificationSession) {
      return;
    }
    window.requestAnimationFrame(() => {
      otpInputsRef.current[0]?.focus();
    });
  }, [hasVerificationSession]);

  useEffect(() => {
    if (!otpDigits.every(Boolean)) {
      lastAutoSubmittedOtpRef.current = "";
      return;
    }
    if (
      !hasVerificationSession ||
      loading ||
      otpLoading ||
      lastAutoSubmittedOtpRef.current === otpCode
    ) {
      return;
    }
    lastAutoSubmittedOtpRef.current = otpCode;
    void submitSignupRef.current({ auto: true });
  }, [hasVerificationSession, loading, otpCode, otpDigits, otpLoading]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");

    if (["username", "email", "phone"].includes(name) && signupSessionId) {
      resetOtpState("We cleared the previous code because your verification details changed.");
    }
  };

  const handleRequestOtp = async () => {
    const identityError = validateIdentityStep(form, usernameStatus);
    if (identityError) {
      setError(identityError);
      return;
    }
    const contactError = validateContactStep(form);
    if (contactError) {
      setError(contactError);
      return;
    }
    const securityError = validateSecurityStep(form, acceptedTerms);
    if (securityError) {
      setError(securityError);
      return;
    }

    try {
      setOtpLoading(true);
      setError("");
      setVerificationNotice("");

      const response = await API.post("signup/request-otp/", {
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || "",
      });

      const nextDeliveryStatus = response.data?.delivery_status || "generated";
      const expiresInSeconds = Number(response.data?.expires_in_seconds || 600);
      setSignupSessionId(response.data?.signup_session_id || "");
      setDeliveryChannel(response.data?.delivery_channel || "email");
      setDevOtp(response.data?.dev_otp || "");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setOtpExpiryAt(Date.now() + expiresInSeconds * 1000);
      setOtpCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setVerificationNotice(
        response.data?.dev_otp
          ? `Verification code generated. Use ${response.data.dev_otp} to finish signup.`
          : nextDeliveryStatus === "sent"
            ? `Verification code sent to your ${response.data?.delivery_channel || "email"}. Enter it below to finish signup.`
            : `Verification code generated for your ${response.data?.delivery_channel || "email"}. Enter it below to finish signup.`
      );
      lastAutoSubmittedOtpRef.current = "";
      toast.info("Your signup code is ready. Enter all 6 digits to finish.", { title: "Verification code sent" });
    } catch (err) {
      console.error(err);
      const retryAfter = Number(err.response?.data?.retry_after_seconds || 0);
      if (retryAfter > 0) {
        setOtpCooldownUntil(Date.now() + retryAfter * 1000);
      }
      setError(getSignupError(err.response?.data));
    } finally {
      setOtpLoading(false);
    }
  };

  async function submitSignup(options = {}) {
    const validationError = validateVerificationStep(signupSessionId, otpCode);
    if (validationError) {
      if (!options.auto) {
        setError(validationError);
      }
      return false;
    }

    try {
      setLoading(true);
      setError("");

      await API.post("signup/", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
        signup_session_id: signupSessionId,
        otp: otpCode.trim(),
      });

      toast.success("Account created and verified successfully.", { title: "Welcome to ShareVerse" });
      navigate("/login", {
        replace: true,
        state: {
          message: "Account created and verified successfully. Sign in to start splitting costs or buying together.",
        },
      });
      return true;
    } catch (err) {
      console.error(err);
      setError(getSignupError(err.response?.data));
      return false;
    } finally {
      setLoading(false);
    }
  }

  submitSignupRef.current = submitSignup;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const identityError = validateIdentityStep(form, usernameStatus);
    if (identityError) {
      setError(identityError);
      return;
    }

    const contactError = validateContactStep(form);
    if (contactError) {
      setError(contactError);
      return;
    }

    const securityError = validateSecurityStep(form, acceptedTerms);
    if (securityError) {
      setError(securityError);
      return;
    }

    if (!hasVerificationSession) {
      await handleRequestOtp();
      return;
    }

    await submitSignup();
  };

  const handleOtpDigitChange = (index, rawValue) => {
    const nextDigit = rawValue.replace(/\D/g, "").slice(-1);
    setOtpDigits((current) => {
      const next = [...current];
      next[index] = nextDigit;
      return next;
    });
    setError("");

    if (nextDigit && index < OTP_LENGTH - 1) {
      window.requestAnimationFrame(() => {
        otpInputsRef.current[index + 1]?.focus();
      });
    }
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpInputsRef.current[index - 1]?.focus();
      return;
    }
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    const pastedDigits = (event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pastedDigits) {
      return;
    }
    event.preventDefault();
    setOtpDigits(Array.from({ length: OTP_LENGTH }, (_, index) => pastedDigits[index] || ""));
    setError("");
    const focusIndex = Math.min(pastedDigits.length, OTP_LENGTH - 1);
    window.requestAnimationFrame(() => {
      otpInputsRef.current[focusIndex]?.focus();
    });
  };

  const handleGoogleSuccess = (payload) => {
    const accessToken = payload?.access || "";

    if (!accessToken) {
      setError("We could not finish Google sign-in right now. Please try again.");
      return;
    }

    try {
      setAuthToken(accessToken);
    } catch {
      // ignore localStorage write issues
    }

    setError("");
    setIsAuth(true);
    toast.success(
      payload?.created
        ? "Your ShareVerse account is ready and you are already signed in."
        : "Signed in with your Google account.",
      { title: payload?.created ? "Welcome to ShareVerse" : "Welcome back" }
    );
    navigate("/home", { replace: true });
  };

  return (
    <AuthShell
      eyebrow="Create account"
      title="Set up your ShareVerse account."
      subtitle="Use Google or complete one short form, then enter the 6-digit code we send to your email."
      themeMode={themeMode}
      toggleTheme={toggleTheme}
      footer={<SignupFooter />}
      panelWidthClass="max-w-2xl"
      compact
    >
      <div className="sv-signup-shell">
        <div>
          <p className="sv-eyebrow">Quick signup</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-slate-950 sm:mt-3 sm:text-3xl">
            Create your account in one short flow
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-600 sm:mt-3 sm:text-sm sm:leading-7">
            Choose a username, add your email, set a password, then verify the code from this same page.
          </p>
        </div>

        {error ? (
          <div className="sv-signup-alert is-error mt-5">
            <strong>Something needs attention</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {verificationNotice ? (
          <div className="sv-signup-alert is-success mt-5">
            <strong>Verification ready</strong>
            <span>{verificationNotice}</span>
          </div>
        ) : null}

        <GoogleAuthButton
          mode="signup"
          themeMode={themeMode}
          disabled={loading || otpLoading}
          title="Sign up with Google"
          description="Create your ShareVerse account with one verified Google email and skip the manual OTP steps."
          note="If you already have a ShareVerse account with the same email, we will sign you in instead."
          className="mt-5"
          onSuccess={handleGoogleSuccess}
          onError={setError}
        />

        <div className="sv-google-auth-divider">
          <span>Or continue with email</span>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <IdentityStep form={form} handleChange={handleChange} usernameStatus={usernameStatus} usernameStatusCopy={usernameStatusCopy} />
          <ContactStep form={form} handleChange={handleChange} />
          <SecurityStep form={form} handleChange={handleChange} acceptedTerms={acceptedTerms} setAcceptedTerms={setAcceptedTerms} passwordStrength={passwordStrength} passwordChecklist={passwordChecklist} showPassword={showPassword} setShowPassword={setShowPassword} showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword} setError={setError} />
          <VerificationStep form={form} deliveryChannel={deliveryChannel} hasVerificationSession={hasVerificationSession} handleRequestOtp={handleRequestOtp} otpLoading={otpLoading} remainingCooldownSeconds={remainingCooldownSeconds} remainingExpirySeconds={remainingExpirySeconds} devOtp={devOtp} otpDigits={otpDigits} otpInputsRef={otpInputsRef} handleOtpDigitChange={handleOtpDigitChange} handleOtpKeyDown={handleOtpKeyDown} handleOtpPaste={handleOtpPaste} />

          <div className="sv-signup-mobile-submit">
            <div className="sv-signup-mobile-submit-copy">
              <p>{hasVerificationSession ? "Finish signup" : "Send your verification code"}</p>
              <span>
                {hasVerificationSession
                  ? "Enter all 6 digits to create the account right away."
                  : "We will send the code to your email and keep you on this same page."}
              </span>
            </div>
            <button
              type="submit"
              disabled={submitDisabled}
              className="sv-btn-primary w-full justify-center gap-2"
            >
              {loading ? <LoadingSpinner /> : otpLoading ? <LoadingSpinner /> : hasVerificationSession ? <CheckCircleIcon className="h-4 w-4" /> : <ShieldIcon className="h-4 w-4" />}
              {loading
                ? "Creating your account..."
                : otpLoading
                  ? "Sending code..."
                  : getSignupButtonLabel(hasVerificationSession)}
            </button>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}

function SignupFooter() {
  return (
    <div className="space-y-2.5">
      <p className="text-[13px] text-slate-600 sm:text-sm">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-teal-800 hover:text-teal-700">
          Sign in
        </Link>
      </p>
      <p className="text-[11px] leading-5 text-slate-500 sm:text-xs sm:leading-6">
        By signing up, you agree to the{" "}
        <Link to="/terms" className="font-semibold text-teal-800 hover:text-teal-700">Terms</Link>,{" "}
        <Link to="/privacy" className="font-semibold text-teal-800 hover:text-teal-700">Privacy Policy</Link>,{" "}
        <Link to="/refunds" className="font-semibold text-teal-800 hover:text-teal-700">Refund Policy</Link>, and{" "}
        <Link to="/shipping" className="font-semibold text-teal-800 hover:text-teal-700">Shipping Policy</Link>.
      </p>
    </div>
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

function IdentityStep({ form, handleChange, usernameStatus, usernameStatusCopy }) {
  return (
    <section className="sv-signup-stage sv-animate-rise">
      <div className="sv-signup-stage-card">
        <div>
          <p className="sv-eyebrow">Account details</p>
          <h3 className="sv-title mt-2">Choose your login name</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Your name is optional. Your username is what you will use to sign in.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FieldShell label="First name" helper="Optional">
            <input
              type="text"
              name="first_name"
              autoComplete="given-name"
              placeholder="First name"
              value={form.first_name}
              onChange={handleChange}
              className="sv-input"
            />
          </FieldShell>

          <FieldShell label="Last name" helper="Optional">
            <input
              type="text"
              name="last_name"
              autoComplete="family-name"
              placeholder="Last name"
              value={form.last_name}
              onChange={handleChange}
              className="sv-input"
            />
          </FieldShell>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.72fr)]">
          <FieldShell label="Username" helper="This becomes your ShareVerse login name.">
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

          <div className={`sv-signup-availability ${usernameStatusCopy.className}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{usernameStatusCopy.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{usernameStatusCopy.body}</p>
              </div>
              {usernameStatus.state === "checking" ? (
                <LoadingSpinner className="h-4.5 w-4.5" />
              ) : usernameStatus.state === "available" ? (
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
              ) : usernameStatus.state === "taken" ? (
                <ShieldIcon className="h-5 w-5 text-rose-600" />
              ) : (
                <SparkIcon className="h-5 w-5 text-slate-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactStep({ form, handleChange }) {
  return (
    <section className="sv-signup-stage sv-animate-rise">
      <div className="sv-signup-stage-card">
        <div>
          <p className="sv-eyebrow">Verification details</p>
          <h3 className="sv-title mt-2">Where should we send your code?</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Signup verification is sent to your email. Phone is optional.
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FieldShell label="Email" helper="We use this to deliver your signup OTP.">
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              className="sv-input"
            />
          </FieldShell>

          <FieldShell label="Phone" helper="Optional, but helpful for account recovery later.">
            <input
              type="text"
              name="phone"
              autoComplete="tel"
              placeholder="Phone number"
              value={form.phone}
              onChange={handleChange}
              className="sv-input"
            />
          </FieldShell>
        </div>
      </div>
    </section>
  );
}

function SecurityStep({
  form,
  handleChange,
  acceptedTerms,
  setAcceptedTerms,
  passwordStrength,
  passwordChecklist,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  setError,
}) {
  return (
    <section className="sv-signup-stage sv-animate-rise">
      <div className="sv-signup-stage-card">
        <div>
          <p className="sv-eyebrow">Security</p>
          <h3 className="sv-title mt-2">Set your password</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Use at least 8 characters. A mix of letters, numbers, and a symbol is best.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <FieldShell label="Password" helper="Use at least 8 characters.">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  placeholder="Create a password"
                  value={form.password}
                  onChange={handleChange}
                  className="sv-input pr-16 sm:pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[13px] font-semibold text-slate-600 hover:bg-slate-200 sm:right-3 sm:px-3 sm:text-sm"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </FieldShell>

            <FieldShell label="Confirm password" helper="Use the same password again.">
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="sv-input pr-16 sm:pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[13px] font-semibold text-slate-600 hover:bg-slate-200 sm:right-3 sm:px-3 sm:text-sm"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </FieldShell>
          </div>

          <div className="sv-signup-side-note">
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span>Password strength</span>
              <span className={passwordStrength.tone}>{passwordStrength.label}</span>
            </div>
            <div className="sv-password-meter mt-3">
              <div
                className={`sv-password-meter-fill ${passwordStrength.fill}`}
                style={{ width: `${passwordStrength.width}%` }}
              />
            </div>

            <div className="sv-signup-password-list mt-4 sm:grid-cols-2">
              {passwordChecklist.map((item) => (
                <div key={item.label} className={`sv-signup-password-item ${item.ready ? "is-ready" : ""}`}>
                  <span className="sv-signup-password-icon">
                    {item.ready ? <CheckCircleIcon className="h-4 w-4" /> : <SparkIcon className="h-4 w-4" />}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <label className="sv-signup-terms-card">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => {
                setAcceptedTerms(event.target.checked);
                setError("");
              }}
              className="mt-1 h-5 w-5 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
            />
            <span>
              I agree to the{" "}
              <Link to="/terms" className="font-semibold text-teal-800 hover:text-teal-700">
                Terms &amp; Conditions
              </Link>
              ,{" "}
              <Link to="/privacy" className="font-semibold text-teal-800 hover:text-teal-700">
                Privacy Policy
              </Link>
              ,{" "}
              <Link to="/refunds" className="font-semibold text-teal-800 hover:text-teal-700">
                Refund Policy
              </Link>
              , and{" "}
              <Link to="/shipping" className="font-semibold text-teal-800 hover:text-teal-700">
                Shipping Policy
              </Link>
              .
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}

function VerificationStep({
  form,
  deliveryChannel,
  hasVerificationSession,
  handleRequestOtp,
  otpLoading,
  remainingCooldownSeconds,
  remainingExpirySeconds,
  devOtp,
  otpDigits,
  otpInputsRef,
  handleOtpDigitChange,
  handleOtpKeyDown,
  handleOtpPaste,
}) {
  return (
    <section className="sv-signup-stage sv-animate-rise">
      <div className="sv-signup-stage-card">
        <div>
          <p className="sv-eyebrow">Verification</p>
          <h3 className="sv-title mt-2">Enter your 6-digit OTP</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Send the code to {form.email.trim() || "your email"}, then enter all 6 digits here to finish signup.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <div className="sv-signup-verification-summary">
            <div className="sv-signup-summary-pill">
              <span>Username</span>
              <strong>{form.username.trim() || "Not set"}</strong>
            </div>
            <div className="sv-signup-summary-pill">
              <span>Delivery</span>
              <strong>{hasVerificationSession ? deliveryChannel : "Waiting for code"}</strong>
            </div>
            <div className="sv-signup-summary-pill">
              <span>Expiry</span>
              <strong>
                {hasVerificationSession && remainingExpirySeconds > 0
                  ? formatDuration(remainingExpirySeconds)
                  : hasVerificationSession
                    ? "Expired"
                    : "Waiting"}
              </strong>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {hasVerificationSession ? (
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={otpLoading || remainingCooldownSeconds > 0}
                className="sv-btn-secondary w-full justify-center gap-2 sm:w-auto"
              >
                {otpLoading ? <LoadingSpinner /> : <ShieldIcon className="h-4 w-4" />}
                {otpLoading
                  ? "Sending code..."
                  : remainingCooldownSeconds > 0
                    ? `Resend in ${formatDuration(remainingCooldownSeconds)}`
                    : "Send new code"}
              </button>
            ) : null}
            <p className="text-sm leading-6 text-slate-500">
              {hasVerificationSession
                ? remainingCooldownSeconds > 0
                  ? `You can resend another code in ${formatDuration(remainingCooldownSeconds)}.`
                  : "Need another code? You can request a fresh one here."
                : "Tap the main button below and we will send the verification code to your email."}
            </p>
          </div>

          {devOtp ? (
            <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 sm:text-sm">
              Development OTP: <strong>{devOtp}</strong>
            </div>
          ) : null}

          <div>
            <p className="text-[13px] font-semibold text-slate-800 sm:text-sm">Enter the 6-digit code</p>
            <p className="mt-1 text-[12px] leading-6 text-slate-500 sm:text-sm sm:leading-7">
              As soon as all 6 digits are filled, we will try to verify and create the account automatically.
            </p>
            <div className="sv-signup-otp-grid mt-4" onPaste={handleOtpPaste}>
              {Array.from({ length: OTP_LENGTH }).map((_, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    otpInputsRef.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={otpDigits[index]}
                  onChange={(event) => handleOtpDigitChange(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  className="sv-signup-otp-input"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
