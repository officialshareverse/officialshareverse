// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

jest.mock("react-router-dom");

function createMatchMedia(query) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  };
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: createMatchMedia,
});

window.scrollTo = jest.fn();

window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
window.cancelAnimationFrame = (id) => window.clearTimeout(id);

class MockIntersectionObserver {
  constructor(callback = () => {}) {
    this.callback = callback;
  }

  observe = (element) => {
    this.callback([{ isIntersecting: true, target: element }], this);
  };

  unobserve = () => {};

  disconnect = () => {};

  takeRecords = () => [];
}

class MockResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
Object.defineProperty(global, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});
Object.defineProperty(global, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

Object.defineProperty(window.navigator, "vibrate", {
  writable: true,
  configurable: true,
  value: jest.fn(),
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  jest.clearAllMocks();
  window.matchMedia = createMatchMedia;

  const router = require("react-router-dom");
  router.__resetRouterMocks?.();
});
