import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MyShared from "./MyShared";

const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
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
    patch: (...args) => mockApi.patch(...args),
    delete: (...args) => mockApi.delete(...args),
  },
}));

jest.mock("../components/ToastProvider", () => ({
  useToast: () => mockToast,
}));

jest.mock("../hooks/useIsMobile", () => ({
  __esModule: true,
  default: () => false,
}));

function buildJoinedGroup(overrides = {}) {
  return {
    id: 42,
    subscription_name: "Spotify Family",
    mode: "sharing",
    mode_label: "Sharing",
    status: "awaiting_access",
    status_label: "Awaiting access",
    charged_amount: "149.00",
    price_per_slot: "149.00",
    unread_chat_count: 0,
    owner_name: "Alice",
    owner_id: 9,
    owner_rating: { can_review: false },
    access_confirmation_required: true,
    has_confirmed_access: false,
    can_report_access_issue: false,
    ...overrides,
  };
}

test("confirms member access and refreshes the joined-group state", async () => {
  let dashboardCalls = 0;

  mockApi.get.mockImplementation((url) => {
    if (url === "my-groups/") {
      return Promise.resolve({ data: [] });
    }

    if (url === "dashboard/") {
      dashboardCalls += 1;
      return Promise.resolve({
        data: {
          groups: [
            dashboardCalls === 1
              ? buildJoinedGroup()
              : buildJoinedGroup({
                  status: "active",
                  status_label: "Active",
                  has_confirmed_access: true,
                }),
          ],
        },
      });
    }

    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });

  mockApi.post.mockImplementation((url) => {
    if (url === "groups/42/confirm-access/") {
      return Promise.resolve({
        data: {
          message: "Access confirmed successfully",
        },
      });
    }

    return Promise.reject(new Error(`Unexpected POST ${url}`));
  });

  render(<MyShared />);

  await screen.findByText("Spotify Family");
  await userEvent.click(screen.getByRole("button", { name: /i received access/i }));

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith("groups/42/confirm-access/");
  });

  await waitFor(() => {
    expect(
      screen.getByText(/You already confirmed that you received access\./i)
    ).toBeInTheDocument();
  });

  expect(mockToast.success).toHaveBeenCalledWith("Access confirmed successfully");
});
