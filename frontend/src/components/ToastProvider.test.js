import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider, useToast } from "./ToastProvider";

function ToastLauncher() {
  const toast = useToast();

  return (
    <button
      type="button"
      onClick={() =>
        toast.info("Swipe this toast away.", {
          title: "Mobile toast",
          duration: 60000,
        })
      }
    >
      Show toast
    </button>
  );
}

test("dismisses a toast with a horizontal swipe gesture", async () => {
  const originalPointerEvent = window.PointerEvent;
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    value: undefined,
  });

  render(
    <ToastProvider>
      <ToastLauncher />
    </ToastProvider>
  );

  await userEvent.click(screen.getByRole("button", { name: /show toast/i }));
  const toastCard = screen.getByRole("status");

  fireEvent.touchStart(toastCard, {
    touches: [{ clientX: 20 }],
  });
  fireEvent.touchMove(toastCard, {
    touches: [{ clientX: 130 }],
  });
  fireEvent.touchEnd(toastCard, {
    changedTouches: [{ clientX: 130 }],
  });

  expect(screen.queryByText("Swipe this toast away.")).not.toBeInTheDocument();

  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    value: originalPointerEvent,
  });
});
