import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { getAuthToken } from "./auth/session";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import SpotlightSearch from "./components/SpotlightSearch";
import { ToastProvider } from "./components/ToastProvider";
import AboutPage from "./pages/AboutPage";
import ChatsInbox from "./pages/ChatsInbox";
import CreateGroup from "./pages/CreateGroup";
import FaqPage from "./pages/FaqPage";
import GroupChat from "./pages/GroupChat";
import Groups from "./pages/Groups";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import MyShared from "./pages/MyShared";
import NotificationsInbox from "./pages/NotificationsInbox";
import PrivacyPage from "./pages/PrivacyPage";
import Profile from "./pages/Profile";
import RefundPolicyPage from "./pages/RefundPolicyPage";
import ShippingPolicyPage from "./pages/ShippingPolicyPage";
import Signup from "./pages/Signup";
import SupportPage from "./pages/SupportPage";
import TermsPage from "./pages/TermsPage";
import Wallet from "./pages/Wallet";

const THEME_STORAGE_KEY = "sv-theme-preference";

const isAuthenticated = () => {
  return getAuthToken() !== null;
};

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
  return !isAuthenticated() ? children : <Navigate to="/home" />;
};

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [themeMode, setThemeMode] = useState(getInitialTheme);

  useEffect(() => {
    const token = getAuthToken();
    setIsAuth(!!token);
    setIsBootstrapping(false);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sv-auth-shell-active", isAuth);

    return () => {
      document.body.classList.remove("sv-auth-shell-active");
    };
  }, [isAuth]);

  useEffect(() => {
    document.body.classList.toggle("sv-dark", themeMode === "dark");
    document.body.classList.toggle("sv-light", themeMode === "light");
    document.documentElement.style.colorScheme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);

    return () => {
      document.body.classList.remove("sv-dark", "sv-light");
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
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function AppRoutes({ isAuth, setIsAuth, themeMode, toggleTheme }) {
  const location = useLocation();
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

  return (
    <>
      <div className={`sv-route-loading ${isRouteLoading ? "is-active" : ""}`} aria-hidden="true">
        <span className="sv-route-loading-bar" />
      </div>

      {isAuth ? (
        <Navbar
          setIsAuth={setIsAuth}
          themeMode={themeMode}
          toggleTheme={toggleTheme}
          openSpotlight={openSpotlight}
        />
      ) : null}

      <div key={location.pathname} className="sv-route-stage">
        <Routes location={location}>
          <Route
            path="/"
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            }
          />

          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login setIsAuth={setIsAuth} />
              </PublicRoute>
            }
          />

          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />

          <Route path="/about" element={<AboutPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refunds" element={<RefundPolicyPage />} />
          <Route path="/shipping" element={<ShippingPolicyPage />} />
          <Route path="/support" element={<SupportPage />} />

          <Route
            path="/home"
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Navigate to="/home" replace />
              </PrivateRoute>
            }
          />

          <Route
            path="/groups"
            element={
              <PrivateRoute>
                <Groups />
              </PrivateRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <PrivateRoute>
                <NotificationsInbox />
              </PrivateRoute>
            }
          />

          <Route
            path="/chats"
            element={
              <PrivateRoute>
                <ChatsInbox />
              </PrivateRoute>
            }
          />

          <Route
            path="/create"
            element={
              <PrivateRoute>
                <CreateGroup />
              </PrivateRoute>
            }
          />

          <Route
            path="/my-shared"
            element={
              <PrivateRoute>
                <MyShared />
              </PrivateRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />

          <Route
            path="/wallet"
            element={
              <PrivateRoute>
                <Wallet />
              </PrivateRoute>
            }
          />

          <Route
            path="/groups/:groupId/chat"
            element={
              <PrivateRoute>
                <GroupChat />
              </PrivateRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" />} />
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
    </>
  );
}

function AuthBootstrapScreen() {
  return (
    <div className="sv-page">
      <div className="sv-auth-bootstrap">
        <div className="sv-auth-bootstrap-shell">
          <div className="sv-skeleton h-10 w-40 rounded-full" />
          <div className="sv-skeleton-card space-y-4">
            <div className="sv-skeleton h-4 w-24" />
            <div className="sv-skeleton h-10 w-3/4 rounded-[18px]" />
            <div className="sv-skeleton h-4 w-full" />
            <div className="sv-skeleton h-4 w-5/6" />
          </div>
          <div className="sv-skeleton-card space-y-4">
            <div className="sv-skeleton h-12 w-full rounded-[18px]" />
            <div className="sv-skeleton h-12 w-full rounded-[18px]" />
            <div className="sv-skeleton h-12 w-full rounded-[18px]" />
            <div className="sv-skeleton h-12 w-full rounded-[18px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
