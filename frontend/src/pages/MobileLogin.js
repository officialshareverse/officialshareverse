import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import { setAuthToken } from "../auth/session";
import BrandMark from "../components/BrandMark";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { LoadingSpinner } from "../components/UiIcons";

export default function MobileLogin({ setIsAuth }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailContinue = () => {
    setError("");
    if (email.trim()) {
      setStep(2);
    } else {
      setError("Please enter your email address or username.");
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await API.post("login/", {
        username: email.trim(),
        password: password,
      });

      const accessToken = response.data?.access || "";
      if (accessToken) {
        setAuthToken(accessToken);
        if (setIsAuth) setIsAuth(true);
        
        // save last login meta like Login.js does
        try {
          window.localStorage.setItem("sv-login-last-meta", JSON.stringify({
            username: email.trim(),
            time: new Date().toISOString(),
          }));
        } catch {}

        navigate("/home", { replace: true });
      } else {
        setError("We could not sign you in. Please try again.");
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        setError("Incorrect email or password.");
      } else {
        setError(err.response?.data?.error || "We could not sign you in right now. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (payload) => {
    const accessToken = payload?.access || "";
    if (accessToken) {
      setAuthToken(accessToken);
      if (setIsAuth) setIsAuth(true);
      navigate("/home", { replace: true });
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 bg-slate-50 dark:bg-slate-950">
      <BrandMark glow sizeClass="h-12 w-12 mb-6" />
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome to ShareVerse</h1>
      <p className="text-sm text-slate-500 mb-8 text-center">Your subscription management platform</p>

      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[28px] p-6 shadow-xl border border-slate-200 dark:border-slate-800 transition-all duration-300">
        
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <GoogleAuthButton 
               mode="continue" 
               onSuccess={handleGoogleSuccess}
               onError={(err) => { navigate('/login'); }}
            />
            
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
              <span className="px-4 text-[11px] font-bold tracking-wider text-slate-400 uppercase">OR</span>
              <div className="flex-1 border-t border-slate-200 dark:border-slate-800"></div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200 mb-2">Username or Email</label>
            <input 
              type="text" 
              placeholder="Enter your email or username"
              className={`w-full px-4 py-3.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors ${step === 2 ? 'opacity-60 bg-slate-50 dark:bg-slate-800' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={step === 2 || loading}
            />
          </div>

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-slate-900 dark:text-slate-200">Password</label>
                {/* Add simple forgot password hook if they want later */}
              </div>
              <input 
                type="password" 
                placeholder="Enter your password"
                className="w-full px-4 py-3.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 font-medium animate-in fade-in">{error}</p>
          )}

          {step === 1 ? (
            <button 
              onClick={handleEmailContinue}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              Continue <span aria-hidden="true">&rarr;</span>
            </button>
          ) : (
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => { setStep(1); setError(""); }}
                disabled={loading}
                className="px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button 
                onClick={handleLogin}
                disabled={loading}
                className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? <LoadingSpinner className="h-5 w-5 text-white" /> : "Sign In"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center animate-in fade-in">
        <p className="text-[13px] text-slate-500">
          New to ShareVerse?{" "}
          <Link to={`/signup${email.trim() ? `?email=${encodeURIComponent(email)}` : ''}`} className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
