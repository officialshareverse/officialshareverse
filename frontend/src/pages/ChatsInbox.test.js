import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { __navigateMock } from "react-router-dom";

import ChatsInbox from "./ChatsInbox";

const mockApi = {
  get: jest.fn(),
};

jest.mock("../api/axios", () => ({
  __esModule: true,
  default: {
    get: (...args) => mockApi.get(...args),
  },
}));

jest.mock("../hooks/useRevealOnScroll", () => ({
  __esModule: true,
  default: () => {},
}));

jest.mock("../hooks/usePullToRefresh", () => ({
  __esModule: true,
  default: () => ({
    bind: {},
    isRefreshing: false,
    isPulling: false,
    progress: 0,
  }),
}));

function buildChat(id, overrides = {}) {
  const { group: groupOverrides = {}, ...chatOverrides } = overrides;

  return {
    group: {
      id,
      subscription_name: `Group ${id}`,
      status: "active",
      mode: "sharing",
      mode_label: "Sharing",
      owner_name: "Alice",
      ...groupOverrides,
    },
    is_owner: false,
    participant_count: 4,
    unread_chat_count: 0,
    message_count: 10,
    last_activity_at: "2026-04-22T10:00:00Z",
    last_message: {
      created_at: "2026-04-22T10:00:00Z",
      message: "Latest group update",
    },
    participant_preview: [],
    active_typing_users: [],
    online_participant_count: 0,
    ...chatOverrides,
  };
}

test("filters chats, pins an important thread, and opens the selected group chat", async () => {
  mockApi.get.mockResolvedValue({
    data: {
      chats: [
        buildChat(11, {
          group: { subscription_name: "Netflix Premium" },
          unread_chat_count: 2,
          online_participant_count: 1,
          last_message: {
            created_at: "2026-04-22T10:00:00Z",
            message: "Need access by tonight",
          },
        }),
        buildChat(12, {
          group: { subscription_name: "Prime Video" },
          last_message: {
            created_at: "2026-04-22T09:00:00Z",
            message: "Renewal next week",
          },
        }),
      ],
      total_chats: 2,
      total_unread_count: 2,
    },
  });

  render(<ChatsInbox />);

  await screen.findByText("Netflix Premium");
  expect(screen.getByText("Prime Video")).toBeInTheDocument();

  await userEvent.type(screen.getByPlaceholderText(/search groups, hosts, or messages/i), "prime");
  expect(screen.queryByText("Netflix Premium")).not.toBeInTheDocument();
  expect(screen.getByText("Prime Video")).toBeInTheDocument();

  await userEvent.clear(screen.getByPlaceholderText(/search groups, hosts, or messages/i));
  await waitFor(() => {
    expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
  });

  const netflixCard = screen.getByText("Netflix Premium").closest("article");
  const pinButton = within(netflixCard).getByRole("button", { name: /pin chat/i });
  await userEvent.click(pinButton);

  await waitFor(() => {
    expect(window.localStorage.getItem("sv-pinned-chats-v1")).toBe(JSON.stringify([11]));
  });

  await userEvent.click(screen.getByRole("button", { name: /pinned/i }));
  expect(screen.getByText("Netflix Premium")).toBeInTheDocument();
  expect(screen.queryByText("Prime Video")).not.toBeInTheDocument();

  await userEvent.click(screen.getByText("Need access by tonight").closest("button"));
  expect(__navigateMock).toHaveBeenCalledWith("/groups/11/chat");
});
