import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  __setMockLocation,
  __setMockParams,
} from "react-router-dom";

import GroupChat from "./GroupChat";

const mockApi = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
};

jest.mock("../api/axios", () => ({
  __esModule: true,
  default: {
    get: (...args) => mockApi.get(...args),
    post: (...args) => mockApi.post(...args),
    patch: (...args) => mockApi.patch(...args),
  },
}));

function buildChat(messages) {
  return {
    group: {
      subscription_name: "Spotify Family",
      mode_label: "Sharing",
      status_label: "Awaiting access",
      owner_name: "Alice",
    },
    participants: [
      {
        username: "chetak",
        role: "member",
        is_self: true,
        presence: { status: "online", is_online: true, is_typing: false },
      },
      {
        username: "Alice",
        role: "host",
        is_self: false,
        presence: { status: "online", is_online: true, is_typing: false },
      },
    ],
    messages,
  };
}

beforeEach(() => {
  __setMockParams({ groupId: "42" });
  __setMockLocation({ pathname: "/groups/42/chat" });
});

test("loads chat participants and sends a new group message", async () => {
  const initialMessages = [
    {
      id: 1,
      is_own: false,
      sender_username: "Alice",
      message: "Welcome to the split",
      created_at: "2026-04-22T09:00:00Z",
    },
  ];

  let latestChat = buildChat(initialMessages);

  mockApi.get.mockImplementation((url) => {
    if (url === "groups/42/chat/") {
      return Promise.resolve({ data: latestChat });
    }

    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });

  mockApi.patch.mockResolvedValue({ data: { ok: true } });
  mockApi.post.mockImplementation((url, payload) => {
    if (url === "groups/42/chat/") {
      const chatMessage = {
        id: 2,
        is_own: true,
        sender_username: "chetak",
        message: payload.message,
        created_at: "2026-04-22T10:05:00Z",
      };

      latestChat = buildChat([...initialMessages, chatMessage]);

      return Promise.resolve({
        data: {
          chat_message: chatMessage,
        },
      });
    }

    return Promise.reject(new Error(`Unexpected POST ${url}`));
  });

  render(<GroupChat />);

  await screen.findByText("Participants");
  expect(screen.getByText("Welcome to the split")).toBeInTheDocument();

  await userEvent.type(screen.getByPlaceholderText(/write to your group here/i), "New update for everyone");

  await waitFor(() => {
    expect(mockApi.patch).toHaveBeenCalledWith("groups/42/chat/", { is_typing: true });
  });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
  });

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith("groups/42/chat/", {
      message: "New update for everyone",
    });
  });

  await waitFor(() => {
    expect(screen.getByText("New update for everyone")).toBeInTheDocument();
  });
});
