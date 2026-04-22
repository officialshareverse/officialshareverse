import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  __navigateMock,
  __setMockLocation,
} from "react-router-dom";

import Login from "./Login";

const mockApi = {
  post: jest.fn(),
};

const mockSetAuthToken = jest.fn();

jest.mock("../api/axios", () => ({
  __esModule: true,
  default: {
    post: (...args) => mockApi.post(...args),
  },
}));

jest.mock("../auth/session", () => ({
  setAuthToken: (...args) => mockSetAuthToken(...args),
}));

jest.mock("../components/AuthShell", () => ({
  __esModule: true,
  default: ({ children, footer }) => (
    <div>
      <div data-testid="auth-shell">{children}</div>
      <div>{footer}</div>
    </div>
  ),
}));

jest.mock("../components/BrandMark", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("../components/GoogleAuthButton", () => ({
  __esModule: true,
  default: () => <button type="button">Continue with Google</button>,
}));

beforeEach(() => {
  __setMockLocation({ pathname: "/login", state: null });
});

test("signs in with email and remembers the resolved username", async () => {
  const setIsAuth = jest.fn();

  mockApi.post.mockResolvedValue({
    data: {
      access: "access-token-1",
      user: { username: "chetak" },
    },
  });

  render(<Login setIsAuth={setIsAuth} themeMode="light" toggleTheme={jest.fn()} />);

  await userEvent.type(screen.getByPlaceholderText(/your-username or you@example\.com/i), "chetakpagare@gmail.com");
  await userEvent.type(screen.getByPlaceholderText(/enter your password/i), "Secret123!");
  await userEvent.click(screen.getByRole("checkbox", { name: /remember me/i }));
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith("login/", {
      username: "chetakpagare@gmail.com",
      password: "Secret123!",
    });
  });

  expect(mockSetAuthToken).toHaveBeenCalledWith("access-token-1");
  expect(setIsAuth).toHaveBeenCalledWith(true);
  expect(window.localStorage.getItem("sv-login-remembered-username")).toBe("chetak");
  expect(JSON.parse(window.localStorage.getItem("sv-login-last-meta"))).toMatchObject({
    username: "chetak",
  });
  expect(__navigateMock).toHaveBeenCalledWith("/home", { replace: true });
});

test("requests a forgot-password OTP and resets the password", async () => {
  mockApi.post
    .mockResolvedValueOnce({
      data: {
        reset_session_id: "reset-session-1",
        dev_otp: "654321",
      },
    })
    .mockResolvedValueOnce({ data: {} });

  render(<Login setIsAuth={jest.fn()} themeMode="light" toggleTheme={jest.fn()} />);

  await userEvent.click(screen.getByRole("button", { name: /forgot password/i }));
  await userEvent.type(screen.getByPlaceholderText(/^Username or email$/i), "chetak");
  await userEvent.type(screen.getByPlaceholderText(/Phone number/i), "9876543210");
  await userEvent.click(screen.getByRole("button", { name: /^Send OTP$/i }));

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenNthCalledWith(1, "forgot-password/request-otp/", {
      username: "chetak",
      phone: "9876543210",
      email: "",
    });
  });

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /reset password/i })).toBeInTheDocument();
  });

  expect(
    screen.getByText("654321")
  ).toBeInTheDocument();

  await userEvent.type(screen.getByPlaceholderText(/6-digit OTP/i), "654321");
  await userEvent.type(screen.getByPlaceholderText(/^New password$/i), "ResetPass123!");
  await userEvent.type(screen.getByPlaceholderText(/Confirm new password/i), "ResetPass123!");
  await userEvent.click(screen.getByRole("button", { name: /reset password/i }));

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenNthCalledWith(2, "forgot-password/confirm-otp/", {
      username: "chetak",
      reset_session_id: "reset-session-1",
      otp: "654321",
      new_password: "ResetPass123!",
    });
  });

  await waitFor(() => {
    expect(
      screen.getByText(/Password updated successfully\. You can sign in with your new password\./i)
    ).toBeInTheDocument();
  });
});
