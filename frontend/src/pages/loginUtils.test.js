import {
  buildLastLoginNote,
  createResetForm,
  extractApiError,
  formatRelativeLoginTime,
} from "./loginUtils";

describe("login utilities", () => {
  test("extractApiError prefers a top-level API error and includes retry metadata", () => {
    expect(
      extractApiError(
        {
          error: "Too many attempts.",
          retry_after_seconds: 32,
        },
        "Fallback"
      )
    ).toBe("Too many attempts. Try again in 32s.");
  });

  test("extractApiError falls back to the first field error", () => {
    expect(
      extractApiError(
        {
          username: ["Username is required."],
        },
        "Fallback"
      )
    ).toBe("Username is required.");
  });

  test("formatRelativeLoginTime returns a short relative label for recent logins", () => {
    const now = new Date("2026-04-22T12:00:00.000Z").getTime();
    expect(formatRelativeLoginTime("2026-04-22T11:17:00.000Z", now)).toBe("43m ago");
    expect(formatRelativeLoginTime("2026-04-22T08:00:00.000Z", now)).toBe("4h ago");
  });

  test("buildLastLoginNote hides mismatched usernames and formats matching ones", () => {
    const now = new Date("2026-04-22T12:00:00.000Z").getTime();
    const lastLoginMeta = {
      username: "chetak",
      time: "2026-04-22T11:30:00.000Z",
    };

    expect(buildLastLoginNote(lastLoginMeta, "someone-else", now)).toBe("");
    expect(buildLastLoginNote(lastLoginMeta, "chetak", now)).toBe(
      "Last login on this device as @chetak: 30m ago"
    );
  });

  test("createResetForm starts with an optional username and empty fields", () => {
    expect(createResetForm("chetak")).toEqual({
      username: "chetak",
      phone: "",
      email: "",
      otp: "",
      new_password: "",
      confirm_password: "",
    });
  });
});
