import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { __navigateMock, __setMockLocation } from "react-router-dom";

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
});

test("renders a simple dashboard and opens create flow from the primary action", async () => {
  installHomeDataMocks();

  render(<Home />);

  expect(await screen.findByText(/Good .*Chetak/i)).toBeInTheDocument();
  expect(screen.getByText(/wallet balance/i)).toBeInTheDocument();
  expect(screen.getByText(/create your first split/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /create split/i }));

  await waitFor(() => {
    expect(__navigateMock).toHaveBeenCalledWith("/create");
  });
});
