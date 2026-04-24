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
  __setMockLocation({ pathname: "/create", state: null });
});

test("switches the create flow between sharing and buy-together modes", async () => {
  render(<CreateGroup />);

  expect(screen.getByText(/sharing summary/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /buy together first/i }));
  expect(screen.getByText(/buy-together summary/i)).toBeInTheDocument();
});
