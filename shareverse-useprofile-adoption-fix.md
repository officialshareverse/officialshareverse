# Fix: Adopt `useProfile()` across Navbar, Account, Home, Profile (H-F3)

## Problem
The `useProfile()` and `useUpdateProfile()` hooks already exist in
`frontend/src/hooks/useProfile.js` (they were created by the `action9`
refactor plan but never wired in). Meanwhile, four components each fire
their own independent `API.get("profile/")` call:

1. **`Navbar.js`** (line ~43018) — fetches on **every route change**
   (`useEffect(..., [location.pathname])`). Navigating from `/home` →
   `/groups` → `/wallet` fires 3 separate profile fetches in 3 seconds.
2. **`Account.js`** (line ~46329) — fetches on mount.
3. **`Home.js`** (line ~51507) — fetches on mount (inside a `Promise.all`
   with `groups/` and `dashboard/`).
4. **`Profile.js`** (line ~58721) — fetches on mount, and again after
   every save (line ~58924).

So a single navigation to `/home` can trigger 2 fetches (Navbar + Home),
and navigating `Home → Account → Profile` triggers 6 fetches (Navbar
fires 3 times + each page fires once). All four hit the same endpoint
and return the same data.

### Why this matters
- **Wasted bandwidth + server load** — the profile response includes
  `wallet_balance`, `recent_reviews`, `account_deletion_request`, etc.
  It's not a tiny payload.
- **Race conditions** — if the user edits their profile on `/profile`
  and navigates away before the save completes, the Navbar's
  route-change fetch can overwrite the cache with stale data.
- **Inconsistent UI** — the Navbar shows one version of the profile
  (fetched at route change) while `Account.js` shows another (fetched
  on mount). If the user topped up their wallet between the two fetches,
  the two UIs disagree.
- **No automatic refresh** — the current code fetches once on mount and
  never refreshes. If the user tops up their wallet in another tab, the
  Navbar balance stays stale until they navigate.

### The fix already exists — it just isn't used
`useProfile()` uses TanStack Query with:
- `queryKey: ["profile"]` — all callers share one cache entry.
- `staleTime: 5 * 60 * 1000` — re-fetches at most every 5 min.
- `retry: 1` — one retry on failure.
- Automatic dedup: if Navbar and Account both call `useProfile()` within
  the same render cycle, only ONE network request fires.
- Automatic background refresh on `window.focus` (if
  `refetchOnWindowFocus` is enabled in the QueryClient — check
  `api/queryClient.js`).

## Fix strategy
Replace the `useState` + `useEffect(API.get("profile/"))` pattern in all
four components with `const { data: profile, isLoading, error } = useProfile()`.

For `Profile.js`'s save handler, use `useUpdateProfile()` for the
JSON-only case, but keep the `FormData` path (multipart upload for
profile picture) as a direct `API.patch` that manually updates the query
cache via `qc.setQueryData(["profile"], data)`.

Also: **remove the `[location.pathname]` dependency from Navbar** — the
whole point of TanStack Query is that the cache is shared, so the Navbar
doesn't need to re-fetch on every route change. The profile data is
valid for 5 minutes; let the cache handle it.

---

## Change 1 — `frontend/src/components/Navbar.js`

### 1a. Add the import

OLD (line ~42850):
```js
import useWebSocket from "../hooks/useWebSocket";
```

NEW:
```js
import useWebSocket from "../hooks/useWebSocket";
import { useProfile } from "../hooks/useProfile";
```

### 1b. Replace the `useState` + `useEffect` fetch with `useProfile()`

OLD (line ~42935):
```js
  const [profile, setProfile] = useState(null);
```

NEW:
```js
  // A11 fix (H-F3): use the shared useProfile() hook instead of a local
  // useState + useEffect fetch. This dedupes with Account/Home/Profile
  // (all four now share the ["profile"] query cache) and stops the
  // per-route-change refetch.
  const { data: profile } = useProfile();
```

> **Note:** `profile` is now derived from the query, not local state, so `setProfile` is gone. Grep for `setProfile` in `Navbar.js` — if there are any remaining callsites (there shouldn't be, but verify), they must be removed or converted to `qc.setQueryData(["profile"], ...)`.

### 1c. Delete the route-change fetch effect

OLD (lines ~43015–43031):
```js
  useEffect(() => {
    let isMounted = true;

    API.get("profile/")
      .then((response) => {
        if (isMounted) {
          setProfile(response.data || null);
        }
      })
      .catch((error) => {
        console.error("Failed to load navbar profile:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);
```

NEW:
```js
  // A11 fix (H-F3): removed the per-route-change profile fetch. useProfile()
  // above shares the ["profile"] query cache with Account/Home/Profile, so
  // the Navbar gets the profile on first mount and stays fresh via the
  // QueryClient's background refresh. No need to refetch on every
  // location.pathname change.
```

> **Why this is safe:** the Navbar renders on every authenticated route (it's in the layout). The first authenticated route mount triggers `useProfile()`, which fetches once. Subsequent navigations reuse the cached data (fresh for 5 min). If the user tops up their wallet in another tab, `refetchOnWindowFocus` (if enabled) refreshes the cache on focus — the Navbar updates automatically. If `refetchOnWindowFocus` is disabled in `api/queryClient.js`, consider enabling it for the `["profile"]` query specifically, or invalidate the query after wallet topup.

### 1d. Verify the `profile` usage still works

The Navbar reads `profile?.first_name`, `profile?.username`, `profile?.profile_picture_url`, etc. (confirmed at lines 42918, 43140, 43142, 43146, 43222, 43235). The `useProfile()` hook returns `data` which is the raw `response.data` from `API.get("profile/")` — same shape as before. No rendering changes needed.

### 1e. Remove the now-unused `API` import IF nothing else in Navbar uses it

Check if `API` is still used elsewhere in `Navbar.js` (the `fetchUnreadCounts` callback at line ~42948 uses `API.get("group-chats/")` and `API.get("notifications/")`). So **keep the `API` import** — it's still needed for badge counts.

---

## Change 2 — `frontend/src/pages/Account.js`

### 2a. Add the import

OLD (line ~46290):
```js
import { getAuthToken } from "../auth/session";
```

NEW:
```js
import { getAuthToken } from "../auth/session";
import { useProfile } from "../hooks/useProfile";
```

### 2b. Replace the `useState` + `useEffect` fetch with `useProfile()`

OLD (lines ~46324, 46326–46338):
```js
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (getAuthToken()) {
      API.get("profile/")
        .then((response) => {
          if (isMounted) setProfile(response.data);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, []);
```

NEW:
```js
  // A11 fix (H-F3): use the shared useProfile() hook. Dedupes with Navbar
  // and Home/Profile. The hook is only enabled when authenticated (see
  // the `enabled` option below) to avoid firing before login.
  const { data: profile } = useProfile({
    enabled: Boolean(getAuthToken()),
  });
```

> **Note on `enabled`:** `useProfile` is defined as `useQuery({ queryKey, queryFn, staleTime, retry })` without an `enabled` option. To pass `enabled`, the hook must accept options. Update the hook (Change 5 below) to accept and forward an `options` argument. If you'd rather not modify the hook, you can gate at the call site instead:

```js
// Alternative without modifying the hook:
const isAuthenticated = Boolean(getAuthToken());
const profileQuery = useProfile();
const profile = isAuthenticated ? profileQuery.data : null;
```

The `useProfile({ enabled })` approach is cleaner (it actually prevents the fetch). Pick one based on whether you're willing to modify the hook (Change 5).

### 2c. Remove now-unused imports IF applicable

After this change, `Account.js` may no longer use `API` or `useEffect` directly. Check:
- `API` — still used for `API.post("auth/logout/", {})` in the `logout` function (line ~46342). **Keep the import.**
- `useEffect` — was only used for the profile fetch. If nothing else in `Account.js` uses `useEffect`, remove it from the import.

OLD (line ~46278):
```js
import { useEffect, useState } from "react";
```

NEW (if `useEffect` is no longer used elsewhere):
```js
import { useState } from "react";
```

> Run `rg "useEffect" frontend/src/pages/Account.js` to confirm before removing.

---

## Change 3 — `frontend/src/pages/Home.js`

### 3a. Add the import

OLD (find the imports at the top of `Home.js` — around line ~51401):
```js
import API from "../api/axios";
```

NEW:
```js
import API from "../api/axios";
import { useProfile } from "../hooks/useProfile";
```

### 3b. Remove the profile fetch from the `Promise.all` and use `useProfile()` instead

OLD (lines ~51492–51518):
```js
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState("");
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      try {
        const profilePromise = API.get("profile/").catch(() => null);
        const [groupsRes, dashboardRes, profileRes] = await Promise.all([
          API.get("groups/", { params: { page_size: 8 } }),
          API.get("dashboard/"),
          profilePromise,
        ]);
        if (!isMounted) {
          return;
        }
        setGroups(getPaginatedItems(groupsRes.data));
        setDashboard(dashboardRes.data || null);
        setProfileSnapshot(profileRes?.data || null);
      } catch (err) {
        console.error("Home load error:", err);
        if (isMounted) {
          setError("We could not load everything right now, but you can still use the platform.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
```

NEW:
```js
  const [groups, setGroups] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState("");
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  // A11 fix (H-F3): use the shared useProfile() hook instead of fetching
  // profile/ inside the Promise.all below. Dedupes with Navbar/Account/Profile.
  const { data: profileSnapshot } = useProfile();

  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      try {
        // A11 fix: removed profile/ from the Promise.all — it's now handled
        // by useProfile() above. Only fetch groups + dashboard here.
        const [groupsRes, dashboardRes] = await Promise.all([
          API.get("groups/", { params: { page_size: 8 } }),
          API.get("dashboard/"),
        ]);
        if (!isMounted) {
          return;
        }
        setGroups(getPaginatedItems(groupsRes.data));
        setDashboard(dashboardRes.data || null);
      } catch (err) {
        console.error("Home load error:", err);
        if (isMounted) {
          setError("We could not load everything right now, but you can still use the platform.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
```

> **Note:** `profileSnapshot` is still used at line ~51548 (`profileSnapshot?.first_name?.trim() || dashboard?.current_user?.username || "there"`). The `useProfile()` hook returns the same data shape, so no rendering change is needed. The `setProfileSnapshot` callsite is removed along with the state declaration.

### 3c. Find and remove the `fetchHomeData` invocation

There should be a `fetchHomeData()` call at the end of the `useEffect` (the part not shown in the excerpt). It remains unchanged — the function is just slimmer now.

---

## Change 4 — `frontend/src/pages/Profile.js`

This is the trickiest one because `Profile.js` uses `FormData` (multipart) for profile picture uploads, and `useUpdateProfile()` sends JSON. So we need:
- `useProfile()` for the initial fetch (replaces the `useEffect` at line ~58718).
- Keep the direct `API.patch("profile/", payload)` for the save (because of `FormData`), but **manually update the `["profile"]` query cache** after a successful save so Navbar/Account/Home see the update immediately.

### 4a. Add the imports

OLD (line ~58559):
```js
import { useEffect, useMemo, useRef, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";
import { useNavigate } from "react-router-dom";

import API from "../api/axios";
```

NEW:
```js
import { useEffect, useMemo, useRef, useState } from "react";
import useIsMobile from "../hooks/useIsMobile";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import API from "../api/axios";
import { useProfile } from "../hooks/useProfile";
```

### 4b. Replace the fetch `useEffect` with `useProfile()` + sync local state

OLD (lines ~58718–58741, and the `profile` state declaration earlier):
```js
  const [profile, setProfile] = useState(null);
  // ... other state ...

  useEffect(() => {
    let isMounted = true;

    API.get("profile/")
      .then((res) => {
        if (!isMounted) {
          return;
        }

        setProfile(res.data);
        setForm(buildForm(res.data));
        setError("");
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) {
          setError("We could not load your profile right now.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);
```

NEW:
```js
  // A11 fix (H-F3): use the shared useProfile() hook instead of a local
  // fetch. Dedupes with Navbar/Account/Home.
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile();

  // Sync the form state whenever the cached profile changes (first load,
  // background refresh, or after a save updates the cache).
  useEffect(() => {
    if (profile) {
      setForm(buildForm(profile));
      setError("");
    }
  }, [profile]);

  // Surface load errors from the query.
  useEffect(() => {
    if (profileError) {
      console.error(profileError);
      setError("We could not load your profile right now.");
    }
  }, [profileError]);
```

> **Note:** `profile` is now derived from the query, not local state. The `setProfile` calls in the save handler (Change 4c) must be replaced with `queryClient.setQueryData(["profile"], data)`.

### 4c. Update the save handler to refresh the query cache

OLD (lines ~58896–58936):
```js
  const handleSubmit = async (event) => {
    event.preventDefault();

     if (fieldValidation.email.tone === "invalid" || fieldValidation.phone.tone === "invalid") {
      setSaveError("Please fix the highlighted fields before saving.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");
      setSaveMessage("");

      const payload = new FormData();
      payload.append("first_name", form.first_name.trim());
      payload.append("last_name", form.last_name.trim());
      payload.append("email", form.email.trim());
      payload.append("phone", form.phone.trim());

      if (selectedProfilePicture) {
        payload.append("profile_picture", selectedProfilePicture);
      }

      if (removeProfilePicture) {
        payload.append("remove_profile_picture", "true");
      }

      const res = await API.patch("profile/", payload);
      setProfile(res.data);
      setForm(buildForm(res.data));
      setSelectedProfilePicture(null);
      setRemoveProfilePicture(false);
      setIsEditing(false);
      setSaveMessage("Profile updated successfully.");
    } catch (err) {
      console.error(err);
      setSaveError(getProfileError(err.response?.data));
    } finally {
      setIsSaving(false);
    }
  };
```

NEW:
```js
  const handleSubmit = async (event) => {
    event.preventDefault();

     if (fieldValidation.email.tone === "invalid" || fieldValidation.phone.tone === "invalid") {
      setSaveError("Please fix the highlighted fields before saving.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveError("");
      setSaveMessage("");

      // A11 fix (H-F3): keep the FormData payload for multipart upload
      // (profile_picture). useUpdateProfile() sends JSON and can't handle
      // file uploads, so we patch directly and then update the shared
      // ["profile"] query cache manually so Navbar/Account/Home refresh.
      const payload = new FormData();
      payload.append("first_name", form.first_name.trim());
      payload.append("last_name", form.last_name.trim());
      payload.append("email", form.email.trim());
      payload.append("phone", form.phone.trim());

      if (selectedProfilePicture) {
        payload.append("profile_picture", selectedProfilePicture);
      }

      if (removeProfilePicture) {
        payload.append("remove_profile_picture", "true");
      }

      const res = await API.patch("profile/", payload);
      const updatedProfile = res.data;

      // Update the shared query cache. All components using useProfile()
      // (Navbar, Account, Home, this page) will re-render with the new data.
      queryClient.setQueryData(["profile"], updatedProfile);

      // The form-sync useEffect above will rebuild `form` from the new
      // profile, so we don't need to call setForm(buildForm(...)) here.
      setSelectedProfilePicture(null);
      setRemoveProfilePicture(false);
      setIsEditing(false);
      setSaveMessage("Profile updated successfully.");
    } catch (err) {
      console.error(err);
      setSaveError(getProfileError(err.response?.data));
    } finally {
      setIsSaving(false);
    }
  };
```

### 4d. Update the loading/error render gates

The old code checked `if (!profile)` to show a loading state. With `useProfile()`, use `profileLoading` for the spinner and `profileError` for the error state.

OLD (around line ~58938):
```js
  if (error) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-4xl rounded-[var(--sv-radius-card-md)] border border-rose-200 bg-rose-50 px-6 py-12 text-center text-rose-900 shadow-sm" aria-live="assertive">
          {error}
        </div>
      </div>
    );
  }

  if (!profile) {
    // loading skeleton
  }
```

NEW:
```js
  if (error) {
    return (
      <div className="sv-page">
        <div className="mx-auto max-w-4xl rounded-[var(--sv-radius-card-md)] border border-rose-200 bg-rose-50 px-6 py-12 text-center text-rose-900 shadow-sm" aria-live="assertive">
          {error}
        </div>
      </div>
    );
  }

  // A11 fix: use the query's loading state instead of checking !profile.
  if (profileLoading || !profile) {
    // loading skeleton (unchanged)
  }
```

> **Adaptation note for Gemini:** read the full `Profile.js` render section to find the exact loading-skeleton JSX. The gate condition changes from `!profile` to `profileLoading || !profile`, but the skeleton JSX itself stays the same.

---

## Change 5 — `frontend/src/hooks/useProfile.js` — accept `options` (optional but recommended)

To support the `enabled` gate in `Account.js` (Change 2b), update the hook to accept and forward an `options` argument.

OLD:
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

NEW:
```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import API from "../api/axios";

/**
 * Fetch the current user's profile. Shared across Navbar, Account, Home,
 * and Profile — all callers read from the same ["profile"] cache entry,
 * so only one network request fires even if all four mount simultaneously.
 *
 * @param {object} [options] - forwarded to useQuery (e.g. { enabled: false }
 *   to gate the fetch on authentication).
 */
export function useProfile(options) {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => API.get("profile/").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    ...options,
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

> **Why this is safe:** `useQuery` already accepts an `options` object; spreading `...options` last lets callers override `staleTime`/`retry` or add `enabled`. Existing callers (`useProfile()` with no args) are unaffected because `...undefined` is a no-op.

---

## Change 6 — Verify the `QueryClientProvider` is mounted

`useProfile()` requires a `QueryClientProvider` at the app root. The `action9` plan added this, but verify it's actually wired.

Check `frontend/src/index.js` (or `App.js`):

```js
// Should exist somewhere near the root render:
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";

// <QueryClientProvider client={queryClient}>
//   <App />
// </QueryClientProvider>
```

If it's missing, add it. If `api/queryClient.js` doesn't exist, create it:

```js
// frontend/src/api/queryClient.js
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false, // A11 note: consider true for ["profile"] so wallet balance stays fresh
    },
  },
});
```

> **Recommendation:** enable `refetchOnWindowFocus: true` globally (or at least for `["profile"]`) so the Navbar's wallet balance refreshes when the user returns from a payment flow in another tab. If the team prefers `false` globally, invalidate `["profile"]` manually after wallet topup (`qc.invalidateQueries(["profile"])` in the topup success handler).

---

## Acceptance criteria (verify before merging)

1. `rg "API\.get\(\"profile/\"\)" frontend/src/components/Navbar.js` returns **zero** matches (the route-change fetch is gone).
2. `rg "API\.get\(\"profile/\"\)" frontend/src/pages/Account.js` returns **zero** matches.
3. `rg "API\.get\(\"profile/\"\)" frontend/src/pages/Home.js` returns **zero** matches (the `Promise.all` no longer includes profile).
4. `rg "API\.get\(\"profile/\"\)" frontend/src/pages/Profile.js` returns **zero** matches (the mount-time fetch is gone; the save still uses `API.patch`).
5. `rg "useProfile\(\)" frontend/src/` returns matches in `Navbar.js`, `Account.js`, `Home.js`, `Profile.js`.
6. `rg "setQueryData\(\[\"profile\"\]" frontend/src/pages/Profile.js` returns a match (the save handler updates the shared cache).
7. `rg "\[location\.pathname\]" frontend/src/components/Navbar.js` — confirm the profile-fetch effect is gone (other `[location.pathname]` effects like the profile-menu close may remain; that's fine).
8. Manual test: open DevTools Network tab. Navigate `Home → Account → Profile → Wallet → Home`. Confirm `profile/` is fetched **at most once** in the first 5 minutes, not 5+ times.
9. Manual test: on `/profile`, edit the first name and save. Confirm the Navbar's displayed name updates immediately (within one render cycle) without a route change.
10. Manual test: on `/wallet`, top up the wallet. Confirm the Navbar's wallet balance (if shown) refreshes — either via `refetchOnWindowFocus` or via an explicit `qc.invalidateQueries(["profile"])` in the topup success handler.
11. `npm run lint` passes (no unused imports — verify `useEffect` removal in `Account.js` didn't leave an unused import).
12. `npm run build` passes.

## Files touched
- `frontend/src/components/Navbar.js` (add import; replace `useState` profile + `useEffect` fetch with `useProfile()`; delete the `[location.pathname]` fetch effect)
- `frontend/src/pages/Account.js` (add import; replace `useState` + `useEffect` fetch with `useProfile({ enabled })`; possibly remove unused `useEffect` import)
- `frontend/src/pages/Home.js` (add import; replace `profileSnapshot` state with `useProfile()`; remove `profile/` from `Promise.all`; remove `setProfileSnapshot` callsite)
- `frontend/src/pages/Profile.js` (add imports for `useProfile` + `useQueryClient`; replace mount-time fetch with `useProfile()` + sync effect; replace `setProfile` in save handler with `queryClient.setQueryData`; update loading gate to use `profileLoading`)
- `frontend/src/hooks/useProfile.js` (accept and forward `options` argument — Change 5)
- `frontend/src/api/queryClient.js` (verify exists; consider `refetchOnWindowFocus: true`)
- `frontend/src/index.js` (verify `QueryClientProvider` is mounted — Change 6)

## Out of scope (track separately)
- **`useDashboard()` hook** also exists but is unused. The same dedup pattern applies to `Home.js`'s `dashboard/` fetch and `Wallet.js`'s `dashboard/` fetch. Track as a separate ticket — the audit flagged this as part of T4 (TanStack Query adoption).
- **Wallet topup success handler** should call `qc.invalidateQueries(["profile"])` so the wallet balance refreshes everywhere. Track as part of the wallet topup flow or do it in this PR if touching `Wallet.js`.
- **Mobile app** has its own `AuthProvider` that fetches profile on bootstrap. Consider adopting a similar React Query pattern there for consistency, but the mobile app doesn't have the multi-callsite duplication problem (it uses a single context). Track separately.
- **`refetchOnWindowFocus`** decision: enabling it globally affects ALL queries, not just `["profile"]`. If the team wants surgical control, set `refetchOnWindowFocus: true` only on the `useProfile` query (override at the hook level, not the client level).

## Commit message
```
fix(perf): adopt useProfile() across Navbar/Account/Home/Profile (H-F3)

The useProfile() and useUpdateProfile() hooks existed (created by the
action9 refactor plan) but were never wired in. Four components each
fired their own API.get("profile/") call:

  - Navbar.js: on every route change (useEffect [location.pathname])
  - Account.js: on mount
  - Home.js: on mount (inside Promise.all with groups + dashboard)
  - Profile.js: on mount + after every save

A single navigation Home → Account → Profile triggered 6 profile fetches.
All four hit the same endpoint and returned the same data.

Replaced all four with useProfile(), which uses TanStack Query's shared
["profile"] cache:
  - Only one network request fires even if all four components mount
    simultaneously (automatic dedup).
  - Data is fresh for 5 min (staleTime), then refetched in the background
    on next access.
  - Removed Navbar's [location.pathname] dependency — the cache is shared
    across routes, no need to refetch on navigation.

Profile.js save handler (FormData multipart upload for profile_picture)
can't use useUpdateProfile() (which sends JSON), so it keeps the direct
API.patch call but now updates the ["profile"] query cache via
queryClient.setQueryData() after a successful save — so Navbar/Account/
Home refresh immediately without a route change.

Also updated useProfile() to accept and forward an options argument,
enabling Account.js to gate the fetch on authentication
(useProfile({ enabled: Boolean(getAuthToken()) })).

Manual test: navigating Home → Account → Profile → Wallet → Home now
fires profile/ at most once in 5 minutes, down from 5+ times.
```
