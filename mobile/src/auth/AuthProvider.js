import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  api,
  registerSessionUpdateHandler,
  registerUnauthorizedHandler,
  setSessionTokens,
} from "../api/client";
import { clearStoredSession, readStoredSession, writeStoredSession } from "./session";

const AuthContext = createContext(null);

async function applySessionPayload(payload, setSession, setUser) {
  const nextSession = {
    accessToken: payload.access,
    refreshToken: payload.refresh,
  };

  await writeStoredSession(nextSession);
  setSessionTokens(nextSession);
  setSession(nextSession);
  setUser(payload.user || null);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const signOut = useCallback(async () => {
    const refresh = session?.refreshToken || "";
    try {
      if (refresh) {
        await api.post("mobile/auth/logout/", { refresh });
      }
    } catch {
      // Silent logout still clears local session.
    } finally {
      setSessionTokens(null);
      await clearStoredSession();
      setSession(null);
      setUser(null);
    }
  }, [session?.refreshToken]);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      void signOut();
    });
  }, [signOut]);

  useEffect(() => {
    registerSessionUpdateHandler((nextSession) => {
      setSession(nextSession);
    });

    return () => {
      registerSessionUpdateHandler(null);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const storedSession = await readStoredSession();
        if (!storedSession) {
          return;
        }

        setSessionTokens(storedSession);
        if (!isMounted) {
          return;
        }

        setSession(storedSession);
        const profileResponse = await api.get("profile/");
        if (!isMounted) {
          return;
        }
        setUser(profileResponse.data || null);
      } catch {
        if (!isMounted) {
          return;
        }
        setSessionTokens(null);
        await clearStoredSession();
        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(async ({ username, password }) => {
    const response = await api.post("mobile/login/", { username, password });
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
    return response.data;
  }, []);

  const value = useMemo(
    () => ({
      api,
      user,
      session,
      isAuthenticated: Boolean(session?.accessToken),
      isBootstrapping,
      signIn,
      finishSignup,
      requestSignupOtp,
      requestPasswordResetOtp,
      confirmPasswordReset,
      refreshProfile,
      signOut,
    }),
    [
      user,
      session,
      isBootstrapping,
      signIn,
      finishSignup,
      requestSignupOtp,
      requestPasswordResetOtp,
      confirmPasswordReset,
      refreshProfile,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
