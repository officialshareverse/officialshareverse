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

test("shows the first-action activation modal and launches buy-together setup with a template", async () => {
  installHomeDataMocks();

  render(<Home />);

  expect(
    await screen.findByRole("heading", { name: /what would you like to do first/i })
  ).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole("button", { name: /start a buy-together/i })
  );
  await userEvent.click(
    screen.getByRole("button", { name: /learning membership/i })
  );
  await userEvent.click(
    screen.getByRole("button", { name: /start buy-together setup/i })
  );

  await waitFor(() => {
    expect(__navigateMock).toHaveBeenCalledWith("/create", {
      state: {
        activationEntry: "home-activation",
        activationPath: "group_buy",
        activationTemplateId: "learning-membership-buy",
      },
    });
  });
});
