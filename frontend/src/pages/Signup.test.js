import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  __navigateMock,
  __setMockLocation,
} from "react-router-dom";

import Signup from "./Signup";

const mockApi = {
  post: jest.fn(),
};

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  show: jest.fn(),
  dismiss: jest.fn(),
  clear: jest.fn(),
};

jest.mock("../api/axios", () => ({
  __esModule: true,
  default: {
    post: (...args) => mockApi.post(...args),
  },
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

jest.mock("../components/GoogleAuthButton", () => ({
  __esModule: true,
  default: () => <button type="button">Continue with Google</button>,
}));

jest.mock("../components/ToastProvider", () => ({
  useToast: () => mockToast,
}));

beforeEach(() => {
  __setMockLocation({ pathname: "/signup", state: null });
});

test("checks username availability, requests OTP, and creates the account after OTP entry", async () => {
  mockApi.post.mockImplementation((url, payload) => {
    if (url === "signup/check-availability/") {
      return Promise.resolve({
        data: {
          available: true,
          message: "Username available",
        },
      });
    }

    if (url === "signup/request-otp/") {
      return Promise.resolve({
        data: {
          signup_session_id: "signup-session-1",
          delivery_channel: "email",
          dev_otp: "123456",
          expires_in_seconds: 600,
        },
      });
    }

    if (url === "signup/") {
      return Promise.resolve({ data: { ok: true, payload } });
    }

    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  const { container } = render(
    <Signup setIsAuth={jest.fn()} themeMode="light" toggleTheme={jest.fn()} />
  );

  await userEvent.type(screen.getByPlaceholderText(/your-username/i), "sharepilot");

  await waitFor(
    () => {
      expect(mockApi.post).toHaveBeenCalledWith("signup/check-availability/", {
        username: "sharepilot",
      });
    },
    { timeout: 1500 }
  );

  await userEvent.click(screen.getByRole("button", { name: /next step/i }));
  await userEvent.type(screen.getByPlaceholderText(/you@example\.com/i), "pilot@example.com");
  await userEvent.click(screen.getByRole("button", { name: /next step/i }));

  await userEvent.type(screen.getByPlaceholderText(/create a password/i), "Secret123!");
  await userEvent.type(screen.getByPlaceholderText(/confirm your password/i), "Secret123!");
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: /next step/i }));

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /send verification code/i }));
  });

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith("signup/request-otp/", {
      username: "sharepilot",
      email: "pilot@example.com",
      phone: "",
    });
  });

  expect(mockToast.info).toHaveBeenCalledWith(
    "Your signup code is ready. Enter all 6 digits to finish.",
    { title: "Verification code sent" }
  );

  const otpInputs = Array.from(container.querySelectorAll(".sv-signup-otp-input"));
  expect(otpInputs).toHaveLength(6);

  ["1", "2", "3", "4", "5", "6"].forEach((digit, index) => {
    fireEvent.change(otpInputs[index], { target: { value: digit } });
  });

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith("signup/", {
      first_name: "",
      last_name: "",
      username: "sharepilot",
      email: "pilot@example.com",
      phone: null,
      password: "Secret123!",
      signup_session_id: "signup-session-1",
      otp: "123456",
    });
  });

  expect(mockToast.success).toHaveBeenCalledWith(
    "Account created and verified successfully.",
    { title: "Welcome to ShareVerse" }
  );
  expect(__navigateMock).toHaveBeenCalledWith(
    "/login",
    expect.objectContaining({
      replace: true,
      state: expect.objectContaining({
        message: expect.stringMatching(/Account created and verified successfully/i),
      }),
    })
  );
});
