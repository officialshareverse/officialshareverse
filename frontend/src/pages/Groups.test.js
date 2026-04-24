import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Groups from "./Groups";

const mockApi = {
  get: jest.fn(),
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
    get: (...args) => mockApi.get(...args),
    post: (...args) => mockApi.post(...args),
  },
}));

jest.mock("../components/ToastProvider", () => ({
  useToast: () => mockToast,
}));

beforeEach(() => {
  mockApi.get.mockImplementation((url) => {
    if (url === "groups/") {
      return Promise.resolve({
        data: [
          {
            id: 11,
            subscription_name: "Team Software",
            owner_name: "Chetak",
            mode: "sharing",
            mode_label: "Sharing",
            status: "active",
            status_label: "Active",
            total_slots: 4,
            filled_slots: 2,
            remaining_slots: 2,
            join_price: "249.00",
            price_per_slot: "249.00",
            created_at: "2026-04-22T10:00:00Z",
            join_cta: "Join now",
            mode_description: "Split a tool you already manage.",
          },
          {
            id: 12,
            subscription_name: "Learning Membership",
            owner_name: "Aryan",
            mode: "group_buy",
            mode_label: "Buy together",
            status: "awaiting_purchase",
            status_label: "Awaiting purchase",
            total_slots: 5,
            filled_slots: 3,
            remaining_slots: 2,
            join_price: "199.00",
            price_per_slot: "199.00",
            created_at: "2026-04-21T10:00:00Z",
            join_cta: "Join buy-together",
            mode_description: "Commit first, purchase later.",
          },
        ],
      });
    }

    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
});

test("filters the marketplace and confirms a join", async () => {
  mockApi.post.mockResolvedValue({
    data: {
      message: "Joined successfully.",
      charged_amount: "249.00",
      platform_fee_amount: "12.45",
    },
  });

  render(<Groups />);

  await screen.findByText("Team Software");
  expect(screen.getByText("Learning Membership")).toBeInTheDocument();

  await userEvent.type(screen.getByPlaceholderText(/search plans or hosts/i), "learning");
  expect(screen.queryByText("Team Software")).not.toBeInTheDocument();
  expect(screen.getByText("Learning Membership")).toBeInTheDocument();

  await userEvent.clear(screen.getByPlaceholderText(/search plans or hosts/i));
  await userEvent.click(screen.getByRole("button", { name: /sharing/i }));
  expect(screen.getByText("Team Software")).toBeInTheDocument();
  expect(screen.queryByText("Learning Membership")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /join now/i }));
  expect(screen.getByText(/join confirmation/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /confirm and join/i }));

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith("join-group/", { group_id: 11 });
  });
});
