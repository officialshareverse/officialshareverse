import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  __navigateMock,
  __setMockLocation,
} from "react-router-dom";

import Home from "./Home";

const mockApi = {
  get: jest.fn(),
};

jest.mock("../api/axios", () => ({
  __esModule: true,
  default: {
    get: (...args) => mockApi.get(...args),
  },
}));

jest.mock("../components/BrandMark", () => ({
  __esModule: true,
  default: () => <div>Brand mark</div>,
}));

jest.mock("../hooks/useIsMobile", () => ({
  __esModule: true,
  default: () => false,
}));

function installHomeDataMocks() {
  mockApi.get.mockImplementation((url) => {
    if (url === "groups/") {
      return Promise.resolve({ data: [] });
    }

    if (url === "dashboard/") {
      return Promise.resolve({
        data: {
          current_user: { id: 17, username: "chetak" },
          owner_summary: {
            total_groups_created: 0,
            buy_together_waiting: 0,
          },
          notifications: [],
          groups: [],
          wallet_balance: "0",
          active_groups: 0,
        },
      });
    }

    if (url === "profile/") {
      return Promise.resolve({
        data: {
          first_name: "Chetak",
          profile_completion: 0,
          total_spent: 0,
        },
      });
    }

    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
}

beforeEach(() => {
  mockApi.get.mockReset();
  __navigateMock.mockReset();
  __setMockLocation({ pathname: "/home", state: null });
  window.localStorage.clear();
});

test("shows the visual intro before the 3-step walkthrough", async () => {
  installHomeDataMocks();

  render(<Home />);

  expect(
    await screen.findByRole("heading", { name: /rs 649 per month can become rs 162 each/i })
  ).toBeInTheDocument();
  expect(screen.getByText("Netflix")).toBeInTheDocument();
  expect(screen.getAllByText("Rs 162")).toHaveLength(4);

  await userEvent.click(screen.getByRole("button", { name: /next panel/i }));
  expect(screen.getByRole("heading", { name: /wallet, chat, confirmations/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /next panel/i }));
  expect(screen.getByRole("heading", { name: /share a plan, join a live group/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /join a group/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /continue to walkthrough/i }));
  expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /add rs 100 to your wallet/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /open wallet/i }));

  await waitFor(() => {
    expect(__navigateMock).toHaveBeenCalledWith("/wallet");
  });
  expect(window.localStorage.getItem("sv-home-intro-seen-v1-17")).toBe("1");
  expect(window.localStorage.getItem("sv-home-guide-seen-v3-17")).toBe("1");
});
