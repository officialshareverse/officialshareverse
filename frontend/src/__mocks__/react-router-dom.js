const React = require("react");

const navigateMock = jest.fn();

const createDefaultLocation = () => ({
  pathname: "/",
  search: "",
  hash: "",
  state: null,
  key: "test-location",
});

let mockLocation = createDefaultLocation();
let mockParams = {};

function normalizePath(value) {
  if (!value) {
    return "/";
  }

  const normalized = value.startsWith("/") ? value : `/${value}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function splitPath(value) {
  return normalizePath(value).split("/").filter(Boolean);
}

function getParamsForRoute(routePath, pathname) {
  if (routePath === "*") {
    return {};
  }

  const routeSegments = splitPath(routePath || "/");
  const pathSegments = splitPath(pathname || "/");

  if (routeSegments.length !== pathSegments.length) {
    return null;
  }

  const params = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathSegment = pathSegments[index];

    if (routeSegment.startsWith(":")) {
      params[routeSegment.slice(1)] = pathSegment;
      continue;
    }

    if (routeSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

function BrowserRouter({ children }) {
  return React.createElement(React.Fragment, null, children);
}

function MemoryRouter({ children }) {
  return React.createElement(React.Fragment, null, children);
}

function Routes({ children, location }) {
  if (location) {
    mockLocation = { ...createDefaultLocation(), ...location };
  }

  let fallbackElement = null;
  const childArray = React.Children.toArray(children).filter(Boolean);

  for (const child of childArray) {
    if (!child?.props) {
      continue;
    }

    if (child.props.path === "*") {
      fallbackElement = child.props.element ?? child.props.children ?? null;
      continue;
    }

    const nextParams = getParamsForRoute(child.props.path || "/", mockLocation.pathname);
    if (nextParams) {
      mockParams = nextParams;
      return child.props.element ?? child.props.children ?? null;
    }
  }

  mockParams = {};
  return fallbackElement;
}

function Route() {
  return null;
}

function Navigate({ to, replace = false, state = null }) {
  const destination = typeof to === "string" ? to : to?.pathname || "/";
  navigateMock(destination, { replace, state });
  mockLocation = {
    ...mockLocation,
    pathname: destination,
    state,
  };

  return React.createElement("div", {
    "data-testid": "navigate",
    "data-to": destination,
  });
}

function Link({ to, children, onClick, ...rest }) {
  const href = typeof to === "string" ? to : to?.pathname || "/";

  return React.createElement(
    "a",
    {
      href,
      onClick: (event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          navigateMock(href, { replace: false });
        }
      },
      ...rest,
    },
    children
  );
}

function NavLink(props) {
  return Link(props);
}

function Outlet() {
  return null;
}

function useNavigate() {
  return navigateMock;
}

function useLocation() {
  return mockLocation;
}

function useParams() {
  return mockParams;
}

function __setMockLocation(nextLocation) {
  mockLocation = {
    ...createDefaultLocation(),
    ...(nextLocation || {}),
  };
}

function __setMockParams(nextParams) {
  mockParams = { ...(nextParams || {}) };
}

function __navigateMock() {
  return navigateMock;
}

function __resetRouterMocks() {
  navigateMock.mockReset();
  mockLocation = createDefaultLocation();
  mockParams = {};
}

module.exports = {
  BrowserRouter,
  Link,
  MemoryRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  __navigateMock: navigateMock,
  __resetRouterMocks,
  __setMockLocation,
  __setMockParams,
};
