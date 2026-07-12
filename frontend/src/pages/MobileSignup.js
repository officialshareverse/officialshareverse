import { useState } from "react";
import { Link } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { LoadingSpinner, ShieldIcon } from "../components/UiIcons";

export default function MobileSignup({
  form, handleChange, 
  usernameStatus,
  referralStatus,
  acceptedTerms, setAcceptedTerms,
  error, setError,
  loading, otpLoading,
  hasVerificationSession, verificationNotice,
  otpDigits, handleOtpDigitChange, handleOtpKeyDown, handleOtpPaste, otpInputsRef,
  handleRequestOtp, submitSignupRef, handleGoogleSuccess, loginHref,
  validateIdentityStep, validateContactStep, validateSecurityStep, validateReferralStep,
  remainingCooldownSeconds, remainingExpirySeconds, formatDuration,
}) {
  const [mobileStep, setMobileStep] = useState(1);
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const displayError = localError || error;

  const handleNext = async () => {
    setLocalError("");
    setError("");

    if (mobileStep === 1) {
      // Validate all fields on step 1
      const identityErr = validateIdentityStep(form, usernameStatus);
      if (identityErr) return setLocalError(identityErr);
      const contactErr = validateContactStep(form);
      if (contactErr) return setLocalError(contactErr);
      const securityErr = validateSecurityStep(form, acceptedTerms);
      if (securityErr) return setLocalError(securityErr);
      const referralErr = validateReferralStep(form, referralStatus);
      if (referralErr) return setLocalError(referralErr);
      
      // Request OTP and move to step 2 only on success.
      // handleRequestOtp must return a boolean (or throw) so we don't strand the user
      // on the OTP screen with no session id.
      try {
        const otpRequested = await handleRequestOtp();
        if (otpRequested === false) {
          // Error already surfaced via setError/toast inside handleRequestOtp.
          return;
        }
      } catch (err) {
        setLocalError(err?.response?.data?.error || "Couldn't send the verification code. Please try again.");
        return;
      }
      setMobileStep(2);
    } else if (mobileStep === 2) {
      await submitSignupRef.current();
    }
  };

  const handleBack = () => {
    setLocalError("");
    setError("");
    setMobileStep(1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Compact header */}
      <div className="flex items-center justify-center pt-10 pb-4">
        <BrandMark glow sizeClass="h-10 w-10" />
      </div>
      <h1 className="text-[22px] font-bold text-slate-900 dark:text-white text-center leading-tight">
        {mobileStep === 1 ? "Create your account" : "Verify your email"}
      </h1>
      <p className="text-[13px] text-slate-500 text-center mt-1 mb-5">
        {mobileStep === 1 ? "Start saving on subscriptions in 30 seconds" : (verificationNotice || "We sent a 6-digit code to your email")}
      </p>

      <div className="flex-1 px-5 pb-6">
        <div className="w-full max-w-sm mx-auto bg-white dark:bg-slate-900 rounded-[24px] p-5 shadow-lg border border-slate-200 dark:border-slate-800">
          
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {[1, 2].map(s => (
              <div key={s} className={`h-1 rounded-full transition-all duration-300 ${s === mobileStep ? 'w-10 bg-teal-500' : s < mobileStep ? 'w-6 bg-teal-200 dark:bg-teal-900' : 'w-6 bg-slate-200 dark:bg-slate-800'}`} />
            ))}
          </div>

          {mobileStep === 1 && (
            <div className="animate-in fade-in duration-200 space-y-3.5">
              {/* Google Auth - prominent */}
              <GoogleAuthButton 
                 mode="signup" 
                 onSuccess={handleGoogleSuccess}
                 onError={setLocalError}
              />
              
              <div className="flex items-center my-1">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
                <span className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">OR EMAIL</span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-800 dark:text-slate-200 mb-1.5">Username</label>
                <input 
                  type="text" 
                  name="username"
                  placeholder="Pick a username"
                  autoComplete="username"
                  className="w-full px-3.5 py-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                  value={form.username}
                  onChange={handleChange}
                />
                {usernameStatus.state === "checking" && <p className="text-[11px] text-slate-400 mt-1">Checking...</p>}
                {usernameStatus.state === "available" && <p className="text-[11px] text-emerald-500 mt-1">✓ Available</p>}
                {usernameStatus.state === "taken" && <p className="text-[11px] text-rose-500 mt-1">Already taken</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-800 dark:text-slate-200 mb-1.5">Email</label>
                <input 
                  type="email" 
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full px-3.5 py-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              {/* Password with show/hide */}
              <div>
                <label className="block text-[13px] font-semibold text-slate-800 dark:text-slate-200 mb-1.5">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    className="w-full px-3.5 py-3 pr-12 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                    value={form.password}
                    onChange={handleChange}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors select-none"
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
                {form.password && form.password.length < 8 && (
                  <p className="text-[11px] text-amber-500 mt-1">Use at least 8 characters</p>
                )}
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2.5 pt-1">
                <input 
                  type="checkbox" 
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  I accept the <Link to="/terms" className="text-teal-600 underline">Terms</Link> and <Link to="/privacy" className="text-teal-600 underline">Privacy Policy</Link>
                </span>
              </label>
            </div>
          )}

          {mobileStep === 2 && (
            <div className="animate-in fade-in duration-200">
              <div className="text-center mb-5">
                <ShieldIcon className="h-9 w-9 text-teal-500 mx-auto mb-2" />
              </div>
              
              {/* OTP input */}
              <div className="flex items-center justify-center gap-2">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpInputsRef.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="h-12 w-10 text-center text-lg font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                  />
                ))}
              </div>

              {/* OTP expiry & resend */}
              <div className="flex items-center justify-between mt-4 px-1">
                {remainingExpirySeconds > 0 ? (
                  <p className="text-[11px] text-slate-400">Expires in {formatDuration ? formatDuration(remainingExpirySeconds) : `${remainingExpirySeconds}s`}</p>
                ) : (
                  <p className="text-[11px] text-rose-400">Code expired</p>
                )}
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={otpLoading || (remainingCooldownSeconds > 0)}
                  className="text-[12px] font-semibold text-teal-600 hover:text-teal-700 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
                >
                  {remainingCooldownSeconds > 0 ? `Resend in ${remainingCooldownSeconds}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}

          {/* Error display */}
          {displayError && (
            <p className="text-[12px] text-red-500 font-medium animate-in fade-in mt-3 text-center leading-relaxed">{displayError}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2.5 mt-5">
            {mobileStep > 1 && (
              <button 
                onClick={handleBack}
                disabled={loading || otpLoading}
                className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}
            <button 
              onClick={handleNext}
              disabled={loading || otpLoading}
              className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 shadow-sm shadow-teal-500/20"
            >
              {loading || otpLoading ? <LoadingSpinner className="h-5 w-5 text-white" /> : mobileStep === 2 ? "Complete Signup" : "Create Account"}
            </button>
          </div>
        </div>

        {/* Trust strip */}
        <div className="flex items-center justify-center gap-4 mt-5">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">🔒 Encrypted</span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">🛡️ No spam</span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">⚡ 30 seconds</span>
        </div>

        {/* Login link */}
        <div className="mt-5 text-center">
          <p className="text-[13px] text-slate-500">
            Already have an account?{" "}
            <Link to={loginHref} className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
