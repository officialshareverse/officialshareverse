import { render, screen, waitFor } from "@testing-library/react";
import {
  __navigateMock,
  __setMockLocation,
} from "react-router-dom";

import App from "./App";

const mockRefreshAccessToken = jest.fn();

let currentToken = null;
const mockGetAuthToken = jest.fn(() => currentToken);

jest.mock("./api/axios", () => ({
  __esModule: true,
  default: {},
  refreshAccessToken: (...args) => mockRefreshAccessToken(...args),
}));

jest.mock("./auth/session", () => ({
  getAuthToken: () => mockGetAuthToken(),
}));

jest.mock("./components/ErrorBoundary", () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));

jest.mock("./components/Navbar", () => ({
  __esModule: true,
  default: () => <div>Mock Navbar</div>,
}));

jest.mock("./components/ToastProvider", () => ({
  ToastProvider: ({ children }) => <>{children}</>,
}));

jest.mock("./components/SkeletonFactory", () => ({
  SkeletonBlock: () => <div data-testid="skeleton-block" />,
  SkeletonCard: ({ children }) => <div data-testid="skeleton-card">{children}</div>,
  SkeletonTextGroup: () => <div data-testid="skeleton-text-group" />,
}));

jest.mock("./pages/AboutPage", () => ({
  __esModule: true,
  default: () => <div>About page</div>,
}));
jest.mock("./pages/ChatsInbox", () => ({
  __esModule: true,
  default: () => <div>Chats inbox page</div>,
}));
jest.mock("./pages/CreateGroup", () => ({
  __esModule: true,
  default: () => <div>Create group page</div>,
}));
jest.mock("./pages/FaqPage", () => ({
  __esModule: true,
  default: () => <div>FAQ page</div>,
}));
jest.mock("./pages/GroupChat", () => ({
  __esModule: true,
  default: () => <div>Group chat page</div>,
}));
jest.mock("./pages/Groups", () => ({
  __esModule: true,
  default: () => <div>Groups page</div>,
}));
jest.mock("./pages/Home", () => ({
  __esModule: true,
  default: () => <div>Home page</div>,
}));
jest.mock("./pages/Landing", () => ({
  __esModule: true,
  default: () => <div>Landing page</div>,
}));
jest.mock("./pages/Login", () => ({
  __esModule: true,
  default: () => <div>Login page</div>,
}));
jest.mock("./pages/MyShared", () => ({
  __esModule: true,
  default: () => <div>My Shared page</div>,
}));
jest.mock("./pages/NotificationsInbox", () => ({
  __esModule: true,
  default: () => <div>Notifications page</div>,
}));
jest.mock("./pages/PrivacyPage", () => ({
  __esModule: true,
  default: () => <div>Privacy page</div>,
}));
jest.mock("./pages/Profile", () => ({
  __esModule: true,
  default: () => <div>Profile page</div>,
}));
jest.mock("./pages/RefundPolicyPage", () => ({
  __esModule: true,
  default: () => <div>Refunds page</div>,
}));
jest.mock("./pages/ShippingPolicyPage", () => ({
  __esModule: true,
  default: () => <div>Shipping page</div>,
}));
jest.mock("./pages/Signup", () => ({
  __esModule: true,
  default: () => <div>Signup page</div>,
}));
jest.mock("./pages/SupportPage", () => ({
  __esModule: true,
  default: () => <div>Support page</div>,
}));
jest.mock("./pages/TermsPage", () => ({
  __esModule: true,
  default: () => <div>Terms page</div>,
}));
jest.mock("./pages/Wallet", () => ({
  __esModule: true,
  default: () => <div>Wallet page</div>,
}));

beforeEach(() => {
  currentToken = null;
  mockRefreshAccessToken.mockReset();
  mockGetAuthToken.mockClear();
  __navigateMock.mockReset();
  __setMockLocation({ pathname: "/login" });
});

test("refreshes the access token before rendering authenticated routes", async () => {
  mockRefreshAccessToken.mockResolvedValue("fresh-access-token");

  render(<App />);

  await waitFor(() => {
    expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
  });

  await waitFor(() => {
    expect(screen.getByText("Mock Navbar")).toBeInTheDocument();
  });

  expect(screen.queryByText("Login page")).not.toBeInTheDocument();
  expect(__navigateMock).toHaveBeenCalledWith("/home", { replace: false, state: null });
});

test("skips refresh and renders private routes when an access token already exists", async () => {
  currentToken = "stored-access-token";
  __setMockLocation({ pathname: "/home" });

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText("Home page")).toBeInTheDocument();
  });
});
