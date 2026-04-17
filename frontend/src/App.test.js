import { render } from "@testing-library/react";

import App from "./App";

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    (() => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
});

test("renders the app shell without crashing", () => {
  expect(() => render(<App />)).not.toThrow();
});
