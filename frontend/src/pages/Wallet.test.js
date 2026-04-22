import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Wallet from "./Wallet";

const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
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
    get: (...args) => mockApi.get(...args),
    post: (...args) => mockApi.post(...args),
    put: (...args) => mockApi.put(...args),
  },
}));

jest.mock("../components/ToastProvider", () => ({
  useToast: () => mockToast,
}));

jest.mock("../hooks/useRevealOnScroll", () => ({
  __esModule: true,
  default: () => {},
}));

function buildDashboard(overrides = {}) {
  return {
    balance: "2500.00",
    wallet_payments: { mode_label: "Razorpay" },
    wallet_payouts_config: { payout_enabled: false },
    wallet_payout_account: {
      account_type: "bank_account",
      masked_destination: "XXXX1122",
      contact_name: "Chetak",
      contact_email: "chetak@example.com",
      contact_phone: "9999999999",
      bank_account_holder_name: "Chetak Pagare",
      bank_account_ifsc: "SBIN0001234",
    },
    wallet_payouts: [],
    ...overrides,
  };
}

function installWalletDataMocks(dashboardOverrides = {}) {
  const dashboard = buildDashboard(dashboardOverrides);

  mockApi.get.mockImplementation((url) => {
    if (url === "dashboard/") {
      return Promise.resolve({ data: dashboard });
    }

    if (url === "transactions/") {
      return Promise.resolve({ data: [] });
    }

    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

afterEach(() => {
  delete window.Razorpay;
});

test("starts a Razorpay wallet top-up and verifies the payment", async () => {
  let razorpayOptions;

  installWalletDataMocks();

  window.Razorpay = jest.fn().mockImplementation((options) => {
    razorpayOptions = options;
    return {
      on: jest.fn(),
      open: jest.fn(() => {
        void options.handler({
          razorpay_payment_id: "pay_1",
          razorpay_order_id: "order_1",
          razorpay_signature: "sig_1",
        });
      }),
    };
  });

  mockApi.post.mockImplementation((url) => {
    if (url === "payments/razorpay/create-order/") {
      return Promise.resolve({
        data: {
          payment: { mode_label: "Razorpay" },
          checkout: {
            key: "rzp_test_123",
            order_id: "order_1",
            amount: "50000",
          },
        },
      });
    }

    if (url === "payments/razorpay/verify/") {
      return Promise.resolve({
        data: {
          message: "Wallet top-up credited successfully.",
        },
      });
    }

    return Promise.reject(new Error(`Unexpected POST ${url}`));
  });

  render(<Wallet />);

  const topupButton = await screen.findByRole("button", { name: /add money securely/i });
  fireEvent.submit(topupButton.closest("form"));

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith("payments/razorpay/create-order/", {
      amount: "500",
    });
  });

  expect(window.Razorpay).toHaveBeenCalled();
  expect(razorpayOptions.order_id).toBe("order_1");

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith("payments/razorpay/verify/", {
      razorpay_payment_id: "pay_1",
      razorpay_order_id: "order_1",
      razorpay_signature: "sig_1",
    });
  });

  expect(mockToast.success).toHaveBeenCalledWith(
    "Wallet top-up credited successfully.",
    { title: "Money added" }
  );
});

test("submits a manual withdrawal request from the wallet", async () => {
  installWalletDataMocks();
  mockApi.post.mockImplementation((url) => {
    if (url === "withdraw-money/") {
      return Promise.resolve({
        data: {
          message: "Withdrawal request submitted.",
        },
      });
    }

    return Promise.reject(new Error(`Unexpected POST ${url}`));
  });

  render(<Wallet />);

  await screen.findByRole("button", { name: /^Withdraw$/i });
  await userEvent.click(screen.getByRole("button", { name: /^Withdraw$/i }));
  await userEvent.type(screen.getByLabelText(/^Amount$/i), "300");
  fireEvent.click(screen.getByRole("button", { name: /request manual withdrawal/i }));

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith("withdraw-money/", {
      amount: "300",
      payout_mode: "IMPS",
    });
  });

  expect(mockToast.success).toHaveBeenCalledWith("Withdrawal request submitted.", {
    title: "Withdrawal requested",
  });
});
