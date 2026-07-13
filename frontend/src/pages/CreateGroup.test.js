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

const originalMatchMedia = window.matchMedia;

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
  window.dataLayer = [];
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

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia,
  });
});

test("prefills create flow defaults from the home activation template", async () => {
  render(<CreateGroup />);

  expect(
    screen.getByText(/starting from learning membership/i)
  ).toBeInTheDocument();
  expect(screen.getByText(/^Buy-together$/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /^continue$/i }));

  expect(
    screen.getByDisplayValue("Learning membership circle")
  ).toBeInTheDocument();
  expect(screen.getByDisplayValue("6")).toBeInTheDocument();
  expect(screen.getByDisplayValue("249")).toBeInTheDocument();
});

test("shows the mobile step map and names the next destination", () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
  });

  render(<CreateGroup />);

  expect(screen.getByRole("list", { name: "Create split progress" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue: Details" })).toBeInTheDocument();
});
