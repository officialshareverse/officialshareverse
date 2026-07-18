ACTION 9 — FRONTEND CODE-SPLITTING + REACT QUERY + VIRTUALIZATION
================================================================================

------------------------------------------------------------------------
9.1  Code-split App.js with React.lazy + Suspense
------------------------------------------------------------------------
File: frontend/src/App.js

Replace direct page imports with React.lazy. Wrap <Routes> in <Suspense>
with a <PageSkeleton /> fallback. Wrap each lazy route in an
<ErrorBoundary> + <LazyRouteErrorBoundary> for chunk-load failures.

Create frontend/src/components/PageSkeleton.js:

```jsx
import { SkeletonCard } from "./SkeletonFactory";
import BrandMark from "./BrandMark";

export default function PageSkeleton() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <BrandMark sizeClass="h-10 w-10 mb-6" />
      <div className="w-full max-w-md space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
```

Create frontend/src/components/LazyRouteErrorBoundary.js:

```jsx
import { Component } from "react";
import BrandMark from "./BrandMark";

export default class LazyRouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  isChunkLoadError(error) {
    if (!error) return false;
    if (error.name === "ChunkLoadError") return true;
    return /Loading chunk \d+ failed|Loading CSS chunk \d+ failed/i.test(
      error.message || ""
    );
  }

  handleReload = () => {
    // The only reliable way to re-fetch a chunk after webpack caches the
    // failed import promise at module scope is a full page reload.
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      if (this.isChunkLoadError(this.state.error)) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-6">
            <BrandMark sizeClass="h-10 w-10 mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              We couldn't load this page.
            </h2>
            <p className="text-sm text-slate-500 mb-6 text-center">
              A network issue prevented part of the app from loading.
            </p>
            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg bg-teal-500 text-white font-semibold"
              >
                Retry loading
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-4 py-2 rounded-lg border border-slate-300 font-semibold"
              >
                Go to home
              </button>
            </div>
          </div>
        );
      }
      // Non-chunk errors: re-throw to the parent ErrorBoundary.
      throw this.state.error;
    }
    return this.props.children;
  }
}
```

In App.js, replace:
    import Home from "./pages/Home";
    // ... etc for all pages
With:
    const Home = React.lazy(() => import("./pages/Home"));
    // ... etc

Group:
  - Public bundle (shared chunk via barrel or individual lazy): Landing,
    Login, Signup, About, Faq, Privacy, RefundPolicy, ShippingPolicy,
    Support, Terms.
  - Authed (split per-route): Home, Groups, GroupChat, GroupDetails,
    MyShared, NotificationsInbox, Profile, Wallet, ReferralPage, Account,
    AccountDeletionPage, InviteLanding, CreateGroup, ChatsInbox,
    MobileLogin, MobileSignup.

Wrap:
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* each route wrapped in <LazyRouteErrorBoundary> */}
        <Route path="/home" element={
          <PrivateRoute><LazyRouteErrorBoundary><Home /></LazyRouteErrorBoundary></PrivateRoute>
        } />
        {/* ... */}
      </Routes>
    </Suspense>

------------------------------------------------------------------------
9.2  Add React Query + shared hooks
------------------------------------------------------------------------
File: frontend/package.json — add to dependencies:
    "@tanstack/react-query": "^5.59.0",
    "@tanstack/react-virtual": "^3.10.8"

Create frontend/src/api/queryClient.js:

```js
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

In frontend/src/index.js (or App.js root), wrap the App:

```jsx
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";

// In the root render:
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

Create frontend/src/hooks/useProfile.js:

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import API from "../api/axios";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => API.get("profile/").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => API.patch("profile/", data).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["profile"], data);
      qc.invalidateQueries(["profile"]);
    },
  });
}
```

Create frontend/src/hooks/useDashboard.js:

```js
import { useQuery } from "@tanstack/react-query";
import API from "../api/axios";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => API.get("dashboard/").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
```

Refactor these components to use useProfile() (replacing their independent
useEffect fetches):
  - frontend/src/components/Navbar.js
  - frontend/src/pages/Profile.js (handleSubmit uses useUpdateProfile)
  - frontend/src/pages/Account.js
  - frontend/src/pages/Home.js

Wallet.js is intentionally NOT migrated (it bundles /dashboard/ with
/transactions/ in one Promise.all for a single loading state). Add a
one-line qc.invalidateQueries(['dashboard']) follow-up TODO.

------------------------------------------------------------------------
9.3  Virtualize GroupChat message list
------------------------------------------------------------------------
File: frontend/src/pages/GroupChat.js

Library: @tanstack/react-virtual (chosen over react-window because chat
messages have variable heights and react-virtual's measureElement handles
dynamic heights without pre-computing sizes).

Extract a MessageRow component wrapped in React.memo:

```jsx
const MessageRow = React.memo(function MessageRow({ message, ...props }) {
  // existing message rendering logic
}, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.is_edited === next.message.is_edited &&
    prev.message.reactions === next.message.reactions
  );
});
```

Replace the message list .map() with a virtualized list:

```jsx
import { useVirtualizer } from "@tanstack/react-virtual";

function MessageList({ messages, ...props }) {
  const parentRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // rough estimate; measureElement refines
    overscan: 10,
  });

  // Auto-scroll to bottom on new message IF user is at bottom.
  useEffect(() => {
    const wasInitialMount = prevMessageCountRef.current === 0;
    prevMessageCountRef.current = messages.length; // A9 bugfix: was only updated in fall-through branch
    if (wasInitialMount || isAtBottom) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length, isAtBottom, virtualizer]);

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    setIsAtBottom(true);
  }, [virtualizer, messages.length]);

  return (
    <div ref={parentRef} onScroll={handleScroll} style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => (
          <div
            key={messages[vi.index].id}
            ref={virtualizer.measureElement}
            data-index={vi.index}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
          >
            <MessageRow message={messages[vi.index]} {...props} />
          </div>
        ))}
      </div>
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="scroll-to-bottom-btn"
          style={{ position: "sticky", bottom: 16, left: "50%" }}
        >
          ↓ Latest
        </button>
      )}
    </div>
  );
}
```

Also fix the pre-existing auto-scroll bug: prevMessageCountRef.current
must be updated BEFORE the conditional branches (was only in the
fall-through, so after initial mount the ref stayed at 0 and every new
message was misclassified as "initial mount", re-triggering unconditional
bottom-scroll even when the user had scrolled up).

------------------------------------------------------------------------
9.4  Virtualize Wallet transaction list
------------------------------------------------------------------------
File: frontend/src/pages/Wallet.js

Apply the same @tanstack/react-virtual pattern. Day-bucket labels
(Today/Yesterday/This Week/Older) passed as a `bucketLabel` prop on the
first transaction of each bucket (sticky headers were rejected because
they get unmounted when scrolled out of the virtual window, causing
flicker).

TransactionRow wrapped in React.memo with default shallow comparison.

================================================================================
