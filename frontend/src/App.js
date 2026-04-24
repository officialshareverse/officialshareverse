import { useEffect, useState } from "react";
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

function isAuthenticated() {
  return getAuthToken() !== null;
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

function PrivateRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/" />;
}

function PublicRoute({ children }) {
  return !isAuthenticated() ? children : <Navigate to="/home" />;
}

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [themeMode, setThemeMode] = useState(getInitialTheme);

  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
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
        if (isMounted) {
          setIsAuth(Boolean(nextAccessToken));
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
    }

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
    document.body.classList.toggle("sv-light", themeMode === "light");
    document.documentElement.style.colorScheme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);

    return () => {
      document.body.classList.remove("sv-dark", "sv-light");
    };
  }, [themeMode]);

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
              toggleTheme={() =>
                setThemeMode((current) => (current === "dark" ? "light" : "dark"))
              }
            />
          )}
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function AppRoutes({ isAuth, setIsAuth, themeMode, toggleTheme }) {
  const location = useLocation();
  const [isScrollTopVisible, setIsScrollTopVisible] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    function handleScroll() {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      setIsScrollTopVisible(scrollY > 360);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {isAuth ? (
        <Navbar
          setIsAuth={setIsAuth}
          themeMode={themeMode}
          toggleTheme={toggleTheme}
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
                <Login setIsAuth={setIsAuth} themeMode={themeMode} toggleTheme={toggleTheme} />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup setIsAuth={setIsAuth} themeMode={themeMode} toggleTheme={toggleTheme} />
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

      <ScrollTopButton
        isVisible={isScrollTopVisible}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      />
    </>
  );
}

function AuthBootstrapScreen() {
  return (
    <div className="sv-page">
      <div className="mx-auto max-w-xl space-y-4 py-8">
        <SkeletonBlock className="h-10 w-32 rounded-xl" />
        <SkeletonCard>
          <SkeletonTextGroup eyebrowWidth="w-20" titleWidth="w-2/3" />
        </SkeletonCard>
        <SkeletonCard className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-12 w-full rounded-xl" />
          ))}
        </SkeletonCard>
      </div>
    </div>
  );
}

function ScrollTopButton({ isVisible, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sv-scroll-top ${isVisible ? "is-visible" : ""}`}
      aria-label="Scroll back to top"
    >
      <span className="sv-scroll-top-icon" aria-hidden="true">^</span>
      <span>Top</span>
    </button>
  );
}

export default App;
