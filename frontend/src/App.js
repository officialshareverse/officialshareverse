import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { refreshAccessToken } from "./api/axios";
import { getAuthToken } from "./auth/session";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import {
  SkeletonBlock,
  SkeletonCard,
  SkeletonTextGroup,
} from "./components/SkeletonFactory";
import SpotlightSearch from "./components/SpotlightSearch";
import { ToastProvider } from "./components/ToastProvider";
import { DownloadIcon } from "./components/UiIcons";
import AboutPage from "./pages/AboutPage";
import Account from "./pages/Account";
import AccountDeletionPage from "./pages/AccountDeletionPage";
import ChatsInbox from "./pages/ChatsInbox";
import CreateGroup from "./pages/CreateGroup";
import FaqPage from "./pages/FaqPage";
import GroupChat from "./pages/GroupChat";
import Groups from "./pages/Groups";
import GroupDetails from "./pages/GroupDetails";
import Home from "./pages/Home";
import InviteLanding from "./pages/InviteLanding";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import MyShared from "./pages/MyShared";
import NotificationsInbox from "./pages/NotificationsInbox";
import PrivacyPage from "./pages/PrivacyPage";
import Profile from "./pages/Profile";
import ReferralPage from "./pages/ReferralPage";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import ShippingPolicyPage from "./pages/ShippingPolicyPage";
import Signup from "./pages/Signup";
import SupportPage from "./pages/SupportPage";
import TermsPage from "./pages/TermsPage";
import Wallet from "./pages/Wallet";
import useIsMobile from "./hooks/useIsMobile";

const THEME_STORAGE_KEY = "sv-theme-preference";

const isAuthenticated = () => {
  return getAuthToken() !== null;
};

function getSafeRedirectTarget(search, fallback = "/home") {
  const redirectValue = new URLSearchParams(search || "").get("redirect") || "";
  if (!redirectValue.startsWith("/") || redirectValue.startsWith("//")) {
    return fallback;
  }
  return redirectValue;
}

function getInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const PrivateRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/" />;
};

const PublicRoute = ({ children }) => {
  const location = useLocation();
  return !isAuthenticated() ? children : <Navigate to={getSafeRedirectTarget(location.search)} replace />;
};

function isRunningStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIosSafariLike() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(userAgent);
  const isWebKit = /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent);
  return isIos && isWebKit;
}

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [themeMode, setThemeMode] = useState(getInitialTheme);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      const token = getAuthToken();
      if (token) {
        if (isMounted) {
          setIsAuth(true);
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        const nextAccessToken = await refreshAccessToken();
        if (nextAccessToken) {
          if (isMounted) {
            setIsAuth(true);
          }
        } else if (isMounted) {
          setIsAuth(false);
        }
      } catch {
        if (isMounted) {
          setIsAuth(false);
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sv-auth-shell-active", isAuth);

    return () => {
      document.body.classList.remove("sv-auth-shell-active");
    };
  }, [isAuth]);

  useEffect(() => {
    document.body.classList.toggle("sv-dark", themeMode === "dark");
    document.body.classList.toggle("dark", themeMode === "dark");
    document.body.classList.toggle("sv-light", themeMode === "light");
    document.documentElement.style.colorScheme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);

    return () => {
      document.body.classList.remove("sv-dark", "sv-light", "dark");
    };
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  };

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          {isBootstrapping ? (
            <AuthBootstrapScreen />
          ) : (
            <AppRoutes
              isAuth={isAuth}
              setIsAuth={setIsAuth}
              themeMode={themeMode}
              toggleTheme={toggleTheme}
            />
          )}
          <PwaInstallPrompt />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function AppRoutes({ isAuth, setIsAuth, themeMode, toggleTheme }) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const isChatPage = Boolean(location.pathname.match(/^\/groups\/[^/]+\/chat\/?$/));
  const [isRouteLoading, setIsRouteLoading] = useState(true);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const openSpotlight = useCallback(() => setIsSpotlightOpen(true), []);
  const closeSpotlight = useCallback(() => setIsSpotlightOpen(false), []);

  useEffect(() => {
    setIsRouteLoading(true);
    const timeoutId = window.setTimeout(() => {
      setIsRouteLoading(false);
    }, 380);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.style.setProperty("--sv-parallax-offset", "0px");
  }, [location.pathname]);

  useEffect(() => {
    let animationFrameId = 0;

    const syncScrollUi = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      document.documentElement.style.setProperty(
        "--sv-parallax-offset",
        `${Math.min(scrollY * 0.08, 42)}px`
      );
      animationFrameId = 0;
    };

    const handleScroll = () => {
      if (animationFrameId) {
        return;
      }
      animationFrameId = window.requestAnimationFrame(syncScrollUi);
    };

    syncScrollUi();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <>
      <div className={`sv-route-loading ${isRouteLoading ? "is-active" : ""}`} aria-hidden="true">
        <span className="sv-route-loading-bar" />
      </div>

      {isAuth && !(isMobile && isChatPage) ? (
        <Navbar
          setIsAuth={setIsAuth}
          themeMode={themeMode}
          toggleTheme={toggleTheme}
        />
      ) : null}

      <div key={location.pathname} className={`sv-route-stage ${isMobile && isChatPage ? 'sv-route-stage-chat-mobile' : ''}`}>
        <Routes location={location}>
          <Route
            path="/"
            element={
              <ErrorBoundary>
                <PublicRoute>
                  <Landing setIsAuth={setIsAuth} />
                </PublicRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/login"
            element={
              <ErrorBoundary>
                <PublicRoute>
                  <Login setIsAuth={setIsAuth} themeMode={themeMode} toggleTheme={toggleTheme} />
                </PublicRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/signup"
            element={
              <ErrorBoundary>
                <PublicRoute>
                  <Signup setIsAuth={setIsAuth} themeMode={themeMode} toggleTheme={toggleTheme} />
                </PublicRoute>
              </ErrorBoundary>
            }
          />

          <Route path="/about" element={<ErrorBoundary><AboutPage /></ErrorBoundary>} />
          <Route path="/faq" element={<ErrorBoundary><FaqPage /></ErrorBoundary>} />
          <Route path="/invite/:token" element={<ErrorBoundary><InviteLanding /></ErrorBoundary>} />
          <Route path="/terms" element={<ErrorBoundary><TermsPage /></ErrorBoundary>} />
          <Route path="/privacy" element={<ErrorBoundary><PrivacyPage /></ErrorBoundary>} />
          <Route path="/refunds" element={<ErrorBoundary><RefundPolicyPage /></ErrorBoundary>} />
          <Route path="/shipping" element={<ErrorBoundary><ShippingPolicyPage /></ErrorBoundary>} />
          <Route path="/support" element={<ErrorBoundary><SupportPage /></ErrorBoundary>} />
          <Route path="/account-deletion" element={<ErrorBoundary><AccountDeletionPage /></ErrorBoundary>} />

          <Route
            path="/home"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <Home />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <Navigate to="/home" replace />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/groups"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <Groups />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/groups/:groupId"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <GroupDetails />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/notifications"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <NotificationsInbox />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/chats"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <ChatsInbox />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/create"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <CreateGroup />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/my-shared"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <MyShared />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/profile"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/account"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <Account />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/wallet"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <Wallet />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/referrals"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <ReferralPage />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route
            path="/groups/:groupId/chat"
            element={
              <ErrorBoundary>
                <PrivateRoute>
                  <GroupChat />
                </PrivateRoute>
              </ErrorBoundary>
            }
          />

          <Route path="*" element={<ErrorBoundary><Navigate to="/" /></ErrorBoundary>} />
        </Routes>
      </div>

      <SpotlightSearch
        isAuth={isAuth}
        isOpen={isSpotlightOpen}
        onOpen={openSpotlight}
        onClose={closeSpotlight}
        themeMode={themeMode}
        toggleTheme={toggleTheme}
      />

      {/* ScrollTopButton removed as requested */}
    </>
  );
}

function AuthBootstrapScreen() {
  return (
    <div className="sv-page">
      <div className="sv-auth-bootstrap">
        <div className="sv-auth-bootstrap-shell">
          <SkeletonBlock className="h-10 w-40 rounded-full" />
          <SkeletonCard>
            <SkeletonTextGroup eyebrowWidth="w-24" titleWidth="w-3/4" />
          </SkeletonCard>
          <SkeletonCard className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-12 w-full rounded-[18px]" />
            ))}
          </SkeletonCard>
        </div>
      </div>
    </div>
  );
}

function PwaInstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(isRunningStandalone);
  const [showIosHint, setShowIosHint] = useState(() => isIosSafariLike() && !isRunningStandalone());

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setShowIosHint(false);
    };

    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setShowIosHint(false);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const syncInstalledState = () => setIsInstalled(isRunningStandalone());

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncInstalledState);
      return () => mediaQuery.removeEventListener("change", syncInstalledState);
    }

    mediaQuery.addListener(syncInstalledState);
    return () => mediaQuery.removeListener(syncInstalledState);
  }, []);

  if (isInstalled) {
    return null;
  }

  if (installPromptEvent) {
    return (
      <button
        type="button"
        className="sv-pwa-install"
        onClick={async () => {
          await installPromptEvent.prompt();
          setInstallPromptEvent(null);
        }}
      >
        <DownloadIcon className="h-4 w-4" />
        <span>Install ShareVerse</span>
      </button>
    );
  }

  if (!showIosHint) {
    return null;
  }

  return (
    <div className="sv-pwa-install sv-pwa-install-hint" role="status">
      <DownloadIcon className="h-4 w-4" />
      <span>Add ShareVerse to Home Screen from Safari share.</span>
      <button type="button" onClick={() => setShowIosHint(false)} aria-label="Dismiss install hint">
        Dismiss
      </button>
    </div>
  );
}

export default App;
