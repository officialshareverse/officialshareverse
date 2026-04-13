import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Navbar from "./components/Navbar";
import ChatsInbox from "./pages/ChatsInbox";
import CreateGroup from "./pages/CreateGroup";
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

const isAuthenticated = () => {
  return localStorage.getItem("token") !== null;
};

const PrivateRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/" />;
};

const PublicRoute = ({ children }) => {
  return !isAuthenticated() ? children : <Navigate to="/home" />;
};

function App() {
  const [isAuth, setIsAuth] = useState(isAuthenticated());

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuth(!!token);
  }, []);

  return (
    <BrowserRouter>
      {isAuth && <Navbar setIsAuth={setIsAuth} />}

      <Routes>
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
    </BrowserRouter>
  );
}

export default App;
