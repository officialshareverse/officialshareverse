import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { __setMockLocation } from "react-router-dom";

import CreateGroup from "./CreateGroup";

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

jest.mock("../components/ToastProvider", () => ({
  useToast: () => mockToast,
}));

beforeEach(() => {
  mockApi.post.mockReset();
  __setMockLocation({
    pathname: "/create",
    state: {
      activationEntry: "home-activation",
      activationPath: "group_buy",
      activationTemplateId: "learning-membership-buy",
    },
  });
});

test("prefills create flow defaults from the home activation template", async () => {
  render(<CreateGroup />);

  expect(
    screen.getByText(/starting from learning membership/i)
  ).toBeInTheDocument();
  expect(screen.getByText(/buy-together template/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /next step/i }));

  expect(
    screen.getByDisplayValue("Learning membership circle")
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue("6")).toBeInTheDocument();
  expect(screen.getByDisplayValue("249")).toBeInTheDocument();
});
