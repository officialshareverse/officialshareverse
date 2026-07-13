import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  api,
  registerSessionUpdateHandler,
  registerUnauthorizedHandler,
  setSessionTokens,
} from "../api/client";
import { syncPushRegistrationAsync, unregisterPushTokenAsync } from "../notifications/push";
import { clearSentryUser, setSentryUser } from "../utils/sentry";
import { clearStoredSession, readStoredSession, writeStoredSession } from "./session";

const AuthContext = createContext(null);
const MAX_PROFILE_RETRIES = 3;
const PROFILE_RETRY_BACKOFF_MS = [1000, 2000, 4000];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isTransientError = (error) => !error?.response || error.response.status >= 500;
const isUnauthorized = (error) => error?.response?.status === 401;
const isForbidden = (error) => error?.response?.status === 403;

async function applySessionPayload(payload, setSession, setUser) {
  const nextSession = { accessToken: payload.access, refreshToken: payload.refresh };
  await writeStoredSession(nextSession);
  setSessionTokens(nextSession);
  setSession(nextSession);
  setUser(payload.user || null);
  setSentryUser(payload.user || null);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [authError, setAuthError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    const refresh = session?.refreshToken || "";
    try {
      await unregisterPushTokenAsync(api);
      if (refresh) await api.post("mobile/auth/logout/", { refresh });
    } catch {
      // Local logout remains successful when the server is unavailable.
    } finally {
      setSessionTokens(null);
      await clearStoredSession();
      setSession(null);
      setUser(null);
      setAuthError("");
      clearSentryUser();
    }
  }, [session?.refreshToken]);

  useEffect(() => {
    registerUnauthorizedHandler(() => void signOut());
  }, [signOut]);

  useEffect(() => {
    registerSessionUpdateHandler((nextSession) => setSession(nextSession));
    return () => registerSessionUpdateHandler(null);
  }, []);

  const runProfileBootstrap = useCallback(async () => {
    for (let attempt = 0; attempt <= MAX_PROFILE_RETRIES; attempt += 1) {
      try {
        const profileResponse = await api.get("profile/");
        if (!mountedRef.current) return;
        setAuthError("");
        setUser(profileResponse.data || null);
        setSentryUser(profileResponse.data || null);
        return;
      } catch (error) {
        if (isUnauthorized(error) || isForbidden(error)) throw error;
        if (attempt < MAX_PROFILE_RETRIES && isTransientError(error)) {
          await sleep(PROFILE_RETRY_BACKOFF_MS[attempt]);
          continue;
        }
        throw error;
      }
    }
  }, []);

  const handleBootstrapError = useCallback((error) => {
    if (isUnauthorized(error)) {
      setSessionTokens(null);
      setSession(null);
      setUser(null);
      setAuthError("");
      clearSentryUser();
      void clearStoredSession();
      return;
    }
    if (isForbidden(error)) {
      setAuthError("You don't have permission to access this account.");
      return;
    }
    if (isTransientError(error)) {
      setAuthError("Couldn't reach the ShareVerse server. Tap to retry.");
      return;
    }
    setAuthError("Something went wrong while loading your profile. Tap to retry.");
  }, []);

  const retryBootstrap = useCallback(async () => {
    let storedSession = session;
    if (!storedSession) {
      storedSession = await readStoredSession();
      if (!storedSession) return;
      setSessionTokens(storedSession);
      setSession(storedSession);
    }
    setAuthError("");
    setIsBootstrapping(true);
    try {
      await runProfileBootstrap();
    } catch (error) {
      if (mountedRef.current) handleBootstrapError(error);
    } finally {
      if (mountedRef.current) setIsBootstrapping(false);
    }
  }, [handleBootstrapError, runProfileBootstrap, session]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedSession = await readStoredSession();
        if (!storedSession) return;
        setSessionTokens(storedSession);
        if (!mountedRef.current) return;
        setSession(storedSession);
        await runProfileBootstrap();
      } catch (error) {
        if (mountedRef.current) handleBootstrapError(error);
      } finally {
        if (mountedRef.current) setIsBootstrapping(false);
      }
    };
    void bootstrap();
  }, [handleBootstrapError, runProfileBootstrap]);

  useEffect(() => {
    if (session?.accessToken) {
      void syncPushRegistrationAsync(api).catch(() => {});
    }
  }, [session?.accessToken]);

  const signIn = useCallback(async ({ username, password }) => {
    const response = await api.post("mobile/login/", { username, password });
    await applySessionPayload(response.data, setSession, setUser);
    return response.data;
  }, []);

  const signInWithGoogle = useCallback(async (credential) => {
    const response = await api.post("mobile/auth/google/", { credential });
    await applySessionPayload(response.data, setSession, setUser);
    return response.data;
  }, []);

  const finishSignup = useCallback(async (payload) => {
    const response = await api.post("mobile/signup/", payload);
    await applySessionPayload(response.data, setSession, setUser);
    return response.data;
  }, []);

  const requestSignupOtp = useCallback(async (payload) => {
    const response = await api.post("signup/request-otp/", payload);
    return response.data;
  }, []);
  const requestPasswordResetOtp = useCallback(async (payload) => {
    const response = await api.post("forgot-password/request-otp/", payload);
    return response.data;
  }, []);
  const confirmPasswordReset = useCallback(async (payload) => {
    const response = await api.post("forgot-password/confirm-otp/", payload);
    return response.data;
  }, []);
  const refreshProfile = useCallback(async () => {
    const response = await api.get("profile/");
    setUser(response.data || null);
    setSentryUser(response.data || null);
    return response.data;
  }, []);

  const value = useMemo(
    () => ({
      api, user, session, isAuthenticated: Boolean(session?.accessToken), isBootstrapping,
      authError, retryBootstrap, signIn, signInWithGoogle, finishSignup,
      requestSignupOtp, requestPasswordResetOtp, confirmPasswordReset,
      refreshProfile, signOut,
    }),
    [
      authError, confirmPasswordReset, finishSignup, isBootstrapping,
      requestPasswordResetOtp, requestSignupOtp, refreshProfile, retryBootstrap,
      session, signIn, signInWithGoogle, signOut, user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
