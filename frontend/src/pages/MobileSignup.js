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
  validateIdentityStep, validateContactStep, validateSecurityStep, validateReferralStep
}) {
  const [mobileStep, setMobileStep] = useState(1);
  const [localError, setLocalError] = useState("");

  const displayError = localError || error;

  const handleNext = async () => {
    setLocalError("");
    setError("");

    if (mobileStep === 1) {
      const err = validateIdentityStep(form, usernameStatus) || validateContactStep(form);
      if (err) return setLocalError(err);
      setMobileStep(2);
    } else if (mobileStep === 2) {
      const err = validateSecurityStep(form, acceptedTerms);
      if (err) return setLocalError(err);
      setMobileStep(3);
    } else if (mobileStep === 3) {
      const err = validateReferralStep(form, referralStatus);
      if (err) return setLocalError(err);
      
      if (!hasVerificationSession) {
        await handleRequestOtp();
      }
      setMobileStep(4);
    } else if (mobileStep === 4) {
      await submitSignupRef.current();
    }
  };

  const handleBack = () => {
    setLocalError("");
    setError("");
    setMobileStep(s => Math.max(1, s - 1));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 bg-slate-50 dark:bg-slate-950">
      <BrandMark glow sizeClass="h-12 w-12 mb-6" />
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Create Account</h1>
      <p className="text-sm text-slate-500 mb-8 text-center">Set up your ShareVerse profile</p>

      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[28px] p-6 shadow-xl border border-slate-200 dark:border-slate-800 transition-all duration-300">
        
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${s === mobileStep ? 'bg-teal-500' : s < mobileStep ? 'bg-teal-200 dark:bg-teal-900' : 'bg-slate-200 dark:bg-slate-800'}`} />
          ))}
        </div>

        {mobileStep === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
            <GoogleAuthButton 
               mode="signup" 
               onSuccess={handleGoogleSuccess}
               onError={setLocalError}
            />
            
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
              <span className="px-4 text-[11px] font-bold tracking-wider text-slate-400 uppercase">OR EMAIL</span>
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Username</label>
              <input 
                type="text" 
                name="username"
                placeholder="Choose a username"
                className="w-full px-4 py-3.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                value={form.username}
                onChange={handleChange}
              />
              {usernameStatus.state === "checking" && <p className="text-[11px] text-slate-500 mt-2">Checking availability...</p>}
              {usernameStatus.state === "taken" && <p className="text-[11px] text-rose-500 mt-2">Username is taken.</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Email Address</label>
              <input 
                type="email" 
                name="email"
                placeholder="Enter your email"
                className="w-full px-4 py-3.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                value={form.email}
                onChange={handleChange}
              />
            </div>
          </div>
        )}

        {mobileStep === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Password</label>
              <input 
                type="password" 
                name="password"
                placeholder="Create a password"
                className="w-full px-4 py-3.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                value={form.password}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Confirm Password</label>
              <input 
                type="password" 
                name="confirmPassword"
                placeholder="Repeat password"
                className="w-full px-4 py-3.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </div>
            
            <label className="flex items-start gap-3 mt-4">
              <input 
                type="checkbox" 
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                I accept the <Link to="/terms" className="text-teal-600 hover:underline">Terms</Link> and <Link to="/privacy" className="text-teal-600 hover:underline">Privacy Policy</Link>
              </span>
            </label>
          </div>
        )}

        {mobileStep === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Referral Code (Optional)</label>
              <input 
                type="text" 
                name="referral_code"
                placeholder="Got a code?"
                className="w-full px-4 py-3.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                value={form.referral_code}
                onChange={handleChange}
              />
              {referralStatus.state === "checking" && <p className="text-[11px] text-slate-500 mt-2">Checking...</p>}
              {referralStatus.state === "invalid" && <p className="text-[11px] text-rose-500 mt-2">Invalid code.</p>}
              {referralStatus.state === "valid" && <p className="text-[11px] text-emerald-500 mt-2">Valid! Referrer: {referralStatus.referrerUsername}</p>}
            </div>
          </div>
        )}

        {mobileStep === 4 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
            <div className="text-center">
              <ShieldIcon className="h-10 w-10 text-teal-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verify Email</h3>
              <p className="text-[13px] text-slate-500 mt-1">{verificationNotice || "We sent a 6-digit code to your email."}</p>
            </div>
            
            <div className="flex items-center justify-center gap-2 mt-6">
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
          </div>
        )}

        {displayError && (
          <p className="text-xs text-red-500 font-medium animate-in fade-in mt-4 text-center">{displayError}</p>
        )}

        <div className="flex gap-3 mt-6">
          {mobileStep > 1 && (
            <button 
              onClick={handleBack}
              disabled={loading || otpLoading}
              className="px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}
          <button 
            onClick={handleNext}
            disabled={loading || otpLoading}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading || otpLoading ? <LoadingSpinner className="h-5 w-5 text-white" /> : mobileStep === 4 ? "Complete Signup" : "Next"}
          </button>
        </div>
      </div>

      <div className="mt-8 text-center animate-in fade-in">
        <p className="text-[13px] text-slate-500">
          Already have an account?{" "}
          <Link to={loginHref} className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
