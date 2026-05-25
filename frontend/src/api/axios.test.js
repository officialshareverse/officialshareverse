const mockAxiosPost = jest.fn();
const mockApiInstance = jest.fn();
let mockRequestInterceptor = null;
let mockResponseErrorInterceptor = null;

jest.mock("axios", () => ({
  create: jest.fn(() => mockApiInstance),
  post: (...args) => mockAxiosPost(...args),
}));

jest.mock("./baseUrl", () => ({
  getApiBaseUrl: () => "/api/",
}));

function resetMockApiInstance() {
  mockApiInstance.mockReset();
  mockApiInstance.mockImplementation((config) => Promise.resolve({ data: { retried: true }, config }));
  mockApiInstance.interceptors = {
    request: {
      use: jest.fn((fulfilled) => {
        mockRequestInterceptor = fulfilled;
      }),
    },
    response: {
      use: jest.fn((_fulfilled, rejected) => {
        mockResponseErrorInterceptor = rejected;
      }),
    },
  };
}

function loadApiModule() {
  let moduleExports;
  jest.isolateModules(() => {
    moduleExports = require("./axios");
  });
  return moduleExports;
}

describe("API auth refresh interceptor", () => {
  beforeEach(() => {
    jest.resetModules();
    mockAxiosPost.mockReset();
    mockRequestInterceptor = null;
    mockResponseErrorInterceptor = null;
    resetMockApiInstance();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test("attaches the current access token to requests", () => {
    window.sessionStorage.setItem("sv-access-token", "access-token");
    loadApiModule();

    const request = mockRequestInterceptor({ headers: {} });

    expect(request.headers.Authorization).toBe("Bearer access-token");
  });

  test("queues concurrent 401 responses behind one refresh and replays them", async () => {
    loadApiModule();
    mockAxiosPost.mockResolvedValueOnce({ data: { access: "fresh-token" } });

    const firstRequest = {
      response: { status: 401 },
      config: { url: "dashboard/", headers: { Accept: "application/json" } },
    };
    const secondRequest = {
      response: { status: 401 },
      config: { url: "notifications/", headers: {} },
    };

    await Promise.all([
      mockResponseErrorInterceptor(firstRequest),
      mockResponseErrorInterceptor(secondRequest),
    ]);

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    expect(mockAxiosPost).toHaveBeenCalledWith("/api/auth/refresh/", {}, { withCredentials: true });
    expect(window.sessionStorage.getItem("sv-access-token")).toBe("fresh-token");
    expect(mockApiInstance).toHaveBeenCalledTimes(2);
    expect(mockApiInstance.mock.calls[0][0].headers.Authorization).toBe("Bearer fresh-token");
    expect(mockApiInstance.mock.calls[1][0].headers.Authorization).toBe("Bearer fresh-token");
  });

  test("shares direct refresh calls from websocket reconnects", async () => {
    const { refreshAccessToken } = loadApiModule();
    mockAxiosPost.mockResolvedValueOnce({ data: { access: "socket-token" } });

    const [firstToken, secondToken] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(firstToken).toBe("socket-token");
    expect(secondToken).toBe("socket-token");
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem("sv-access-token")).toBe("socket-token");
  });

  test("does not refresh auth endpoint failures", async () => {
    loadApiModule();
    const loginFailure = {
      response: { status: 401 },
      config: { url: "login/", headers: {} },
    };

    await expect(mockResponseErrorInterceptor(loginFailure)).rejects.toBe(loginFailure);

    expect(mockAxiosPost).not.toHaveBeenCalled();
    expect(mockApiInstance).not.toHaveBeenCalled();
  });
});
