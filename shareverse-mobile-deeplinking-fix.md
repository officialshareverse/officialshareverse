# Fix: Mobile deep-linking completely broken

## Problem
The mobile app declares `"scheme": "shareverse"` in `app.json` but:

1. **`NavigationContainer` has no `linking` prop** (`mobile/src/navigation/RootNavigator.js` ). So tapping a `shareverse://...` URL (or an `https://shareverse.in/invite/<token>` link that should open the app) does nothing — React Navigation doesn't know how to map URLs to screens.

2. **Push notifications always navigate to the generic `Notifications` screen** (`PushNotificationBridge` ). The handler branches on `data.category` / `data.kind` but both branches call `navigationRef.navigate("Notifications")` — chat notifications never open the chat thread, group-update notifications never open the group detail.

3. **The backend push payload has no `group_id`** (`backend/core/push.py` `send_push_notification_to_user` , and `backend/core/views/notification_helpers.py` `build_notification_payload` ). The payload only has `notification_id`, `category`, `kind`, `context_title`. So even with perfect deep-linking, the mobile app has no way to know WHICH group/chat a notification refers to.

4. **`GroupDetailScreen` crashes on direct navigation** (`mobile/src/screens/app/GroupDetailScreen.js`): `const { group } = route.params;` with no fallback fetch. If the screen is reached via deep link (no `group` param), `group.subscription_name` throws.

This breaks the primary referral/invite growth loop on mobile AND makes every push notification land on a useless generic inbox.

## Fix strategy
This is a multi-layer fix. The layers are independent — each one improves things on its own — but all four are needed for end-to-end deep-linking.

### Layer 1 (mobile): Add `linking` config to `NavigationContainer`
Map `shareverse://` and `https://shareverse.in` URLs to screens.

### Layer 2 (mobile): Fix `PushNotificationBridge` to deep-link from push data
Branch on `data.kind` + `data.group_id` (once Layer 4 adds `group_id` to the payload) to navigate to `GroupChat`, `JoinedGroupDetail`, `GroupDetail`, or `Notifications`.

### Layer 3 (mobile): Add fallback fetch to `GroupDetailScreen` (and `JoinedGroupDetailScreen`) so deep links that land directly on those screens don't crash.

### Layer 4 (backend): Add `group_id` to notification payloads so push notifications can deep-link to the right screen. This requires extending `create_notification()` to accept an optional `group_id` and threading it through the chat/group-update call sites.

---

## Change 1 — `mobile/src/navigation/RootNavigator.js` — add `linking` config

### 1a. Add a `linking` config object above the component

Add this above `export default function RootNavigator()`:

```js
/**
 * A11 fix: deep-linking config. Maps incoming URLs to navigation screens.
 *
 * Supported URL shapes:
 *   shareverse://invite/<token>            → Signup (with invite token)
 *   shareverse://r/<code>                  → Signup (with referral code)
 *   shareverse://group/<id>                → GroupDetail
 *   shareverse://joined/<id>               → JoinedGroupDetail
 *   shareverse://chat/<id>                 → GroupChat
 *   https://shareverse.in/invite/<token>   → Signup (with invite token)
 *   https://shareverse.in/r/<code>         → Signup (with referral code)
 *
 * Auth-gated screens (GroupDetail, JoinedGroupDetail, GroupChat) are only
 * reachable when the user is authenticated. If a deep link targets one of
 * them while logged out, NavigationContainer will fall back to the AuthStack
 * (which doesn't define those routes) and the link is silently ignored —
 * the user lands on Login. The pending deep link is preserved by the
 * SignupScreen/LoginScreen via the `pendingDeepLink` param below.
 */
const linking = {
  prefixes: ["shareverse://", "https://shareverse.in", "https://www.shareverse.in"],
  config: {
    screens: {
      // Auth stack
      Login: "login",
      Signup: {
        path: "signup",
        parse: {
          invite: (token) => token || null,
          ref: (code) => code || null,
        },
      },
      ForgotPassword: "forgot-password",

      // App stack — invite/referral landings (also reachable while authed)
      Signup: {
        path: "signup",
        parse: {
          invite: (token) => token || null,
          ref: (code) => code || null,
        },
      },

      // App stack — group targets
      GroupDetail: "group/:groupId",
      JoinedGroupDetail: "joined/:groupId",
      GroupChat: "chat/:groupId",

      // Tab routes (for completeness; not typically deep-linked)
      HomeTab: "home",
      MarketplaceTab: "groups",
      WalletTab: "wallet",
      ProfileTab: "profile",

      // Fallbacks
      Notifications: "notifications",
      Chats: "chats",
    },
  },
};
```

> **Adaptation note for Gemini:** the `Signup` screen is registered in BOTH `AuthStack` and (via the path `signup`) as a deep-link target. React Navigation 7's `linking.config.screens` is a flat map of route names → paths; it doesn't care which stack the route lives in. The `Signup` route name must match exactly the `name="Signup"` prop on `<Stack.Screen>` in `AuthStack` (line ~92155). The `parse` block turns URL query params (`?invite=<token>` or `?ref=<code>`) into route params.

### 1b. Pass `linking` to `NavigationContainer`

OLD (line ~92253–92258):
```jsx
  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? <PushNotificationBridge /> : null}
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
```

NEW:
```jsx
  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      {isAuthenticated ? <PushNotificationBridge /> : null}
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
```

---

## Change 2 — `mobile/src/navigation/RootNavigator.js` — fix `PushNotificationBridge`

The current handler always navigates to `Notifications`. Replace it with a handler that branches on `data.kind` and `data.group_id` to deep-link to the right screen.

OLD (lines ~92113–92149):
```jsx
function PushNotificationBridge() {
  useEffect(() => {
    const support = getPushRuntimeSupport();
    if (!support.supported) {
      return undefined;
    }

    Notifications.setBadgeCountAsync(0);

    const subscription = addPushNotificationResponseListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (!navigationRef.isReady()) {
        return;
      }

      if (data?.category === "groups" || data?.kind === "chat") {
        navigationRef.navigate("Notifications");
        return;
      }

      navigationRef.navigate("Notifications");
    });

    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        Notifications.setBadgeCountAsync(0);
      }
    });

    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return null;
}
```

NEW:
```jsx
/**
 * A11 fix: deep-link from push notification taps.
 *
 * The backend push payload (see backend/core/push.py) includes:
 *   - notification_id
 *   - category  ("wallet" | "system" | "groups")
 *   - kind      ("wallet" | "system" | "chat" | "review" | "group_update")
 *   - group_id  (added by Change 4 below; may be missing on older payloads)
 *   - context_title
 *
 * Routing rules:
 *   kind === "chat" + group_id        → GroupChat (with groupId param)
 *   kind === "group_update" + group_id → JoinedGroupDetail (member view)
 *   kind === "review"                  → Notifications (no deep target)
 *   kind === "wallet"                  → WalletTab (via Tabs → Wallet)
 *   everything else                    → Notifications (safe fallback)
 *
 * If the user is not authenticated, the app stack isn't mounted, so we
 * fall back to Notifications (which is in the app stack and won't be
 * reachable either) — but the bootstrap flow will redirect to Login, and
 * the pending deep link is lost. To recover it, we store it in a module
 * variable that LoginScreen can read after successful auth. (See
 * `getPendingDeepLink` / `clearPendingDeepLink` below.)
 */
let pendingDeepLink = null;
export function getPendingDeepLink() {
  return pendingDeepLink;
}
export function clearPendingDeepLink() {
  pendingDeepLink = null;
}

function navigateFromPushData(data) {
  if (!navigationRef.isReady()) {
    return;
  }

  const kind = data?.kind;
  const groupId = data?.group_id != null ? String(data.group_id) : null;

  // Chat notification → open the group chat thread.
  if (kind === "chat" && groupId) {
    try {
      navigationRef.navigate("GroupChat", { groupId });
      return;
    } catch {
      // Fall through to Notifications if the route isn't mounted (e.g.,
      // user is on the auth stack).
    }
  }

  // Group-update notification → open the joined-group detail (member view).
  // The member is the recipient; they want to see status, not the owner
  // management view.
  if (kind === "group_update" && groupId) {
    try {
      navigationRef.navigate("JoinedGroupDetail", { groupId });
      return;
    } catch {
      // Fall through.
    }
  }

  // Wallet notification → open the Wallet tab.
  if (kind === "wallet") {
    try {
      // Navigate to the Tabs root first, then the Wallet tab. React
      // Navigation 7 supports nested navigation via the parent route name.
      navigationRef.navigate("Tabs", { screen: "WalletTab" });
      return;
    } catch {
      // Fall through.
    }
  }

  // Review notifications don't have a single target screen (the review
  // could be on any past group); land on Notifications so the user sees
  // the context. Everything else also lands on Notifications.
  try {
    navigationRef.navigate("Notifications");
  } catch {
    // If Notifications isn't mounted (auth stack), stash the intent so
    // LoginScreen can replay it after auth.
    pendingDeepLink = { kind, groupId, notificationId: data?.notification_id };
  }
}

function PushNotificationBridge() {
  useEffect(() => {
    const support = getPushRuntimeSupport();
    if (!support.supported) {
      return undefined;
    }

    Notifications.setBadgeCountAsync(0);

    const subscription = addPushNotificationResponseListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (!navigationRef.isReady()) {
        // Stash for later replay after the navigator is ready.
        pendingDeepLink = {
          kind: data?.kind,
          groupId: data?.group_id != null ? String(data.group_id) : null,
          notificationId: data?.notification_id,
        };
        return;
      }

      navigateFromPushData(data);
    });

    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        Notifications.setBadgeCountAsync(0);
      }
    });

    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return null;
}
```

### 2a. Replay pending deep link after login (optional but recommended)

In `LoginScreen` (and `SignupScreen`), after successful authentication, check for a pending deep link and replay it. Add this to the post-login navigation block in `mobile/src/screens/auth/LoginScreen.js`:

```js
import { getPendingDeepLink, clearPendingDeepLink } from "../../navigation/RootNavigator";

// ... after successful login, BEFORE the default navigate("HomeTab") ...
const pending = getPendingDeepLink();
if (pending) {
  clearPendingDeepLink();
  if (pending.kind === "chat" && pending.groupId) {
    navigation.replace("GroupChat", { groupId: pending.groupId });
    return;
  }
  if (pending.kind === "group_update" && pending.groupId) {
    navigation.replace("JoinedGroupDetail", { groupId: pending.groupId });
    return;
  }
}
// Default: navigate to home.
navigation.replace("HomeTab");
```

> **Adaptation note for Gemini:** the exact post-login navigation call in `LoginScreen` must be found and replaced — read the file first. The pattern is usually `navigation.replace("...")` or `navigation.reset(...)`. Apply the same replay logic in `SignupScreen` after the signup-confirm flow completes.

---

## Change 3 — `mobile/src/screens/app/GroupDetailScreen.js` — fallback fetch on direct navigation

The screen currently does `const { group } = route.params;` with no fallback. When reached via deep link, `group` is undefined and the screen crashes.

OLD (around line ~94105):
```jsx
export default function GroupDetailScreen({ route, navigation }) {
  const { group } = route.params;
  // ... uses group.subscription_name, group.id, etc. immediately ...
```

NEW:
```jsx
import { useAuth } from "../../auth/AuthProvider";

export default function GroupDetailScreen({ route, navigation }) {
  const { api } = useAuth();
  const routeGroup = route.params?.group;
  const groupId = route.params?.groupId || routeGroup?.id;

  const [group, setGroup] = useState(routeGroup || null);
  const [loading, setLoading] = useState(!routeGroup && Boolean(groupId));
  const [error, setError] = useState("");

  // A11 fix: if we arrived via deep link without a group param, fetch it.
  useEffect(() => {
    if (routeGroup || !groupId) {
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        // The marketplace list endpoint returns groups; use it as a
        // fallback to locate this one. A dedicated GET /groups/<id>/
        // endpoint would be better (audit item H-F4), but this matches
        // the existing pattern in JoinedGroupDetailScreen.
        const res = await api.get("groups/", { params: { page_size: 100 } });
        if (cancelled) return;
        const items = res.data?.results || res.data || [];
        const found = items.find((item) => String(item.id) === String(groupId));
        if (found) {
          setGroup(found);
        } else {
          setError("We could not find this group anymore.");
        }
      } catch (e) {
        if (!cancelled) setError("We could not load this group right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, groupId, routeGroup]);

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (error || !group) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text, textAlign: "center" }}>
            {error || "We could not find this group."}
          </Text>
          <AppButton title="Back to groups" onPress={() => navigation.navigate("MarketplaceTab")} variant="secondary" />
        </View>
      </Screen>
    );
  }

  // ... existing render logic using `group` ...
```

> **Adaptation note for Gemini:** the existing `GroupDetailScreen` already imports certain helpers and has a specific structure. Read the full file first and integrate the fallback-fetch logic without removing existing functionality. The key additions are: (1) read `groupId` from `route.params` as a fallback when `group` is missing, (2) add a `useEffect` that fetches the group if `routeGroup` is missing, (3) render a loading state and an error state. The `Screen`, `ActivityIndicator`, `colors`, `AppButton` imports must match what's already at the top of the file — add any that are missing.

### 3a. Apply the same pattern to `JoinedGroupDetailScreen`

`mobile/src/screens/app/JoinedGroupDetailScreen.js` already fetches the dashboard to find the group , so it technically doesn't crash on direct navigation — but it's inefficient and fragile. Add the same `groupId`-from-params fallback so a deep link to `joined/<id>` works even if the group isn't in the dashboard's first page.

The minimal fix is to ensure `route.params.groupId` is read and the existing fetch logic uses it. Read the file and adapt — the existing `load()` function already finds the group by ID from the dashboard response; just make sure `groupId` is sourced from `route.params?.groupId || route.params?.group?.id`.

---

## Change 4 — Backend: add `group_id` to notification payloads

This is the critical missing piece. Without `group_id` in the push payload, Layer 2's `data.group_id` is always `undefined`, and chat/group-update notifications still can't deep-link to the right screen.

### 4a. Extend `create_notification()` to accept an optional `group_id`

File: `backend/core/views/common.py` (or wherever `create_notification` lives — confirmed  in the compiled source).

OLD:
```python
def create_notification(*, user=None, user_id=None, message):
    from .views import build_notification_payload

    create_kwargs = {"message": message}
    if user is not None:
        create_kwargs["user"] = user
    elif user_id is not None:
        create_kwargs["user_id"] = user_id
    else:
        raise ValueError("create_notification requires either user or user_id.")

    notification = Notification.objects.create(**create_kwargs)

    def dispatch_notification():
        payload = build_notification_payload(notification)
        push_notification_to_user(notification.user_id, payload)
        push_badge_update_to_user(notification.user_id, reason="notification")
        send_push_notification_to_user(notification.user_id, payload)
        send_web_push_to_user(notification.user_id, payload)

    transaction.on_commit(dispatch_notification)
    return notification
```

NEW:
```python
def create_notification(*, user=None, user_id=None, message, group_id=None):
    """
    Create a notification and dispatch it via WebSocket + mobile push + web push.

    A11 fix: added optional `group_id` so push payloads can include the
    group context, enabling mobile deep-linking from push notification taps.
    The `group_id` is stored on the Notification row (if the model has the
    field — see migration below) and included in the push payload.
    """
    from .views import build_notification_payload

    create_kwargs = {"message": message}
    if user is not None:
        create_kwargs["user"] = user
    elif user_id is not None:
        create_kwargs["user_id"] = user_id
    else:
        raise ValueError("create_notification requires either user or user_id.")

    # A11 fix: attach group_id if provided. The Notification model must
    # have a nullable `group` FK (see migration in 4b).
    if group_id is not None:
        create_kwargs["group_id"] = group_id

    notification = Notification.objects.create(**create_kwargs)

    def dispatch_notification():
        payload = build_notification_payload(notification)
        push_notification_to_user(notification.user_id, payload)
        push_badge_update_to_user(notification.user_id, reason="notification")
        send_push_notification_to_user(notification.user_id, payload)
        send_web_push_to_user(notification.user_id, payload)

    transaction.on_commit(dispatch_notification)
    return notification
```

### 4b. Add a `group` FK to the `Notification` model + migration

File: `backend/core/models.py` — find the `Notification` model and add:

```python
class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # A11 fix: optional FK to the group this notification is about.
    # Nullable so existing notifications (and notifications not tied to a
    # specific group, like wallet/system notifications) still work.
    group = models.ForeignKey(
        "Group",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"]),
        ]
```

Then create a migration:

```bash
cd backend
python manage.py makemigrations core --name add_group_fk_to_notification
```

The generated migration will be something like `0044_add_group_fk_to_notification.py`. Verify it adds a nullable `group_id` column.

### 4c. Include `group_id` in the push payload

File: `backend/core/push.py` — `send_push_notification_to_user` .

OLD (lines ~6014–6019):
```python
    push_data = {
        "notification_id": notification_payload.get("id"),
        "category": notification_payload.get("category"),
        "kind": notification_payload.get("kind"),
        "context_title": notification_payload.get("context_title"),
    }
```

NEW:
```python
    push_data = {
        "notification_id": notification_payload.get("id"),
        "category": notification_payload.get("category"),
        "kind": notification_payload.get("kind"),
        "context_title": notification_payload.get("context_title"),
        # A11 fix: include group_id so mobile can deep-link to the right
        # screen on tap. May be None for wallet/system notifications.
        "group_id": notification_payload.get("group_id"),
    }
```

### 4d. Include `group_id` in `build_notification_payload`

File: `backend/core/views/notification_helpers.py` — `build_notification_payload`.

OLD:
```python
def build_notification_payload(notification):
    metadata = classify_notification_message(notification.message)
    return {
        "id": notification.id,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
        "category": metadata["category"],
        "category_label": metadata["category_label"],
        "kind": metadata["kind"],
        "icon": metadata["icon"],
        "tone": metadata["tone"],
        "context_title": metadata["context_title"],
    }
```

NEW:
```python
def build_notification_payload(notification):
    metadata = classify_notification_message(notification.message)
    return {
        "id": notification.id,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
        "category": metadata["category"],
        "category_label": metadata["category_label"],
        "kind": metadata["kind"],
        "icon": metadata["icon"],
        "tone": metadata["tone"],
        "context_title": metadata["context_title"],
        # A11 fix: include group_id for mobile deep-linking. The field is
        # nullable on the Notification model (added in migration 0044).
        "group_id": getattr(notification, "group_id", None),
    }
```

### 4e. Thread `group_id` through the chat and group-update notification call sites

This is the most important step — without it, `notification.group_id` is always `None` and the mobile deep-link still doesn't work.

Search the backend for all `create_notification(...)` calls that are about a specific group, and add `group_id=group.id`. The key call sites (confirmed via grep):

**Chat messages** — `backend/core/consumers.py` `GroupChatConsumer.create_message` and `backend/core/views/chat.py` `GroupChatView.post`:
```python
# OLD:
create_notification(user=participant, message=f"...{group.subscription.name}...")

# NEW:
create_notification(user=participant, message=f"...{group.subscription.name}...", group_id=group.id)
```

**Group status updates** (proof submitted, funds released, refund issued, member joined, etc.) — search `backend/core/views/common.py`, `groups_management.py`, `groups_public.py` for `create_notification(` calls inside group-related functions and add `group_id=group.id` (or `group_id=locked_group.id`).

> **Adaptation note for Gemini:** run `rg "create_notification\(" backend/core/` to find ALL call sites. For each one, determine if the notification is about a specific group. If yes, add `group_id=<the group's id>`. If the call site doesn't have a `group` variable in scope, you may need to pass it down from the caller. Wallet/system notifications (password reset, OTP, wallet top-up) should NOT get a `group_id` — leave those calls unchanged.

### 4f. Update the web frontend to consume `group_id` (optional, for parity)

The web `NotificationsInbox.js` already navigates to the right page on click using its own logic, so this is optional. But if you want the web notification payload to include `group_id` for consistency, the `build_notification_payload` change in 4d already handles it — no further web changes needed.

---

## Change 5 — `app.json` — add iOS universal links + Android intent filters (production polish)

For `https://shareverse.in/invite/<token>` to open the app (instead of the browser) on iOS, you need an Apple App Site Association (AASA) file hosted at `https://shareverse.in/.well-known/apple-app-site-association`. For Android, you need an `assetlinks.json` at `https://shareverse.in/.well-known/assetlinks.json` plus intent filters in `app.json`.

This is outside the codebase but required for production deep-linking. Add to `app.json`:

```json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:shareverse.in"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            { "scheme": "https", "host": "shareverse.in", "pathPrefix": "/invite" },
            { "scheme": "https", "host": "shareverse.in", "pathPrefix": "/r" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

And host these files on the web server (Vercel serves `shareverse.in`):

**`https://shareverse.in/.well-known/apple-app-site-association`**:
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["TEAMID.com.shareverse.mobile"],
        "components": [
          { "/": "/invite/*" },
          { "/": "/r/*" }
        ]
      }
    ]
  }
}
```

**`https://shareverse.in/.well-known/assetlinks.json`**:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.shareverse.mobile",
      "sha256_cert_fingerprints": ["YOUR_APP_SIGNING_CERT_SHA256"]
    }
  }
]
```

> **Adaptation note for Gemini:** the `TEAMID` and `sha256_cert_fingerprints` values must be filled in by the team — they're not in the codebase. Track this as a deployment task. The `app.json` changes above are safe to merge without the hosted files (deep links via `shareverse://` scheme will still work; only `https://` universal links require the hosted files).

---

## Acceptance criteria (verify before merging)

### Mobile (Changes 1, 2, 3)
1. `rg "linking=\{linking\}" mobile/src/navigation/RootNavigator.js` returns a match (the `linking` prop is wired in).
2. `rg "navigationRef\.navigate\(\"Notifications\"\)" mobile/src/navigation/RootNavigator.js` returns at most ONE match (the fallback in `navigateFromPushData`), not two (the old duplicate branches are gone).
3. `rg "getPendingDeepLink|clearPendingDeepLink" mobile/src/` returns matches in both `RootNavigator.js` (export) and `LoginScreen.js` + `SignupScreen.js` (consumers).
4. Manual test ( Expo Go or dev build ):
   - Run `npx uri-scheme open "shareverse://group/1" --android` (or `--ios`) → app opens `GroupDetailScreen` with `groupId=1` (and fetches the group if not passed via params).
   - Run `npx uri-scheme open "shareverse://chat/1" --android` → app opens `GroupChatScreen` with `groupId=1`.
   - Run `npx uri-scheme open "shareverse://invite/abc-123" --android` → app opens `SignupScreen` with `invite=abc-123`.
   - Run `npx uri-scheme open "shareverse://r/SV-ABCD1234" --android` → app opens `SignupScreen` with `ref=SV-ABCD1234`.
5. Manual test (push): send a test push with `{ "kind": "chat", "group_id": 1 }` via the Expo push API → tapping the notification opens `GroupChatScreen` with `groupId=1`, NOT the generic `Notifications` screen.
6. `GroupDetailScreen` does NOT crash when navigated to via deep link without a `group` param (the fallback fetch fires and renders a loading state, then the group or an error message).

### Backend (Change 4)
7. `python manage.py makemigrations core --name add_group_fk_to_notification --dry-run` shows a migration that adds a nullable `group_id` FK to `Notification`.
8. `python manage.py migrate` applies the migration cleanly.
9. `rg "group_id" backend/core/push.py` returns a match (the payload includes `group_id`).
10. `rg "group_id" backend/core/views/notification_helpers.py` returns a match (`build_notification_payload` includes `group_id`).
11. `rg "create_notification\(.*group_id=" backend/core/` returns matches at all group-related call sites (chat messages, group status updates). Wallet/system notification calls should NOT have `group_id=`.
12. `python manage.py test core.tests --verbosity=1` — no NEW failures vs. the pre-fix baseline.
13. Manual test: trigger a chat message in a group → the recipient's push notification payload (visible in the Expo push tool or via logging) includes `"group_id": <the group's id>`.

### Production polish (Change 5)
14. `app.json` includes `ios.associatedDomains` and `android.intentFilters` (or a tracked ticket to add them).
15. AASA and assetlinks files are hosted at `shareverse.in/.well-known/` (or a tracked deployment ticket).

## Files touched
- `mobile/src/navigation/RootNavigator.js` (add `linking` config + `linking` prop on `NavigationContainer`; rewrite `PushNotificationBridge`; add `pendingDeepLink` helpers)
- `mobile/src/screens/auth/LoginScreen.js` (replay pending deep link after login)
- `mobile/src/screens/auth/SignupScreen.js` (replay pending deep link after signup)
- `mobile/src/screens/app/GroupDetailScreen.js` (fallback fetch on direct navigation)
- `mobile/src/screens/app/JoinedGroupDetailScreen.js` (read `groupId` from params)
- `app.json` (add `associatedDomains` + `intentFilters` — Change 5)
- `backend/core/models.py` (add `group` FK to `Notification`)
- `backend/core/migrations/0044_add_group_fk_to_notification.py` (new migration, auto-generated)
- `backend/core/views/common.py` (extend `create_notification` signature; thread `group_id` through group-related call sites)
- `backend/core/views/chat.py` (pass `group_id` to `create_notification` in `GroupChatView.post`)
- `backend/core/consumers.py` (pass `group_id` to `create_notification` in `GroupChatConsumer.create_message`)
- `backend/core/views/groups_management.py` (pass `group_id` to `create_notification` in group status-update handlers)
- `backend/core/views/groups_public.py` (pass `group_id` to `create_notification` in join/leave handlers)
- `backend/core/push.py` (include `group_id` in `push_data`)
- `backend/core/views/notification_helpers.py` (include `group_id` in `build_notification_payload`)
- Web server config (Vercel) — host AASA + assetlinks files (Change 5)

## Out of scope (track separately)
- The audit also flagged that `MarketplaceScreen` fetches all groups with no pagination (H-M13) and `GroupDetailScreen`/`JoinedGroupDetailScreen` fetch the entire marketplace/dashboard to find one group (H-F4, H-M9). A dedicated `GET /api/groups/<id>/` endpoint would fix all three — track as a separate ticket. The fallback fetch in Change 3 uses the existing marketplace endpoint as a stopgap.
- The `Notification` model could also gain a `kind`/`category` column to avoid re-classifying the message string on every read (the current `classify_notification_message` runs a regex on every payload build). Track as a separate perf ticket.
- Web push (`send_web_push_to_user`) also receives the payload and could deep-link on click, but the web app already has its own notification-click handling in `NotificationsInbox.js`. No web changes needed for this fix.

## Commit message
```
fix(mobile): wire up deep-linking + push-notification routing

The mobile app declared scheme: "shareverse" in app.json but
NavigationContainer had no linking prop, so invite/referral links did
nothing. Push notifications always navigated to the generic Notifications
screen, never to the chat thread or group detail.

- Added linking config to NavigationContainer mapping shareverse:// and
  https://shareverse.in URLs to screens (group/:id, joined/:id, chat/:id,
  signup with invite/referral params).
- Rewrote PushNotificationBridge to branch on data.kind + data.group_id:
  chat → GroupChat, group_update → JoinedGroupDetail, wallet → WalletTab,
  fallback → Notifications. Added pendingDeepLink replay for taps received
  before the navigator is ready or before login.
- Added fallback fetch to GroupDetailScreen so deep links without a group
  param don't crash (reads groupId from route.params, fetches via
  marketplace endpoint).
- Backend: added nullable group FK to Notification model + migration,
  extended create_notification() to accept group_id, included group_id in
  push payload + build_notification_payload, threaded group_id through
  all group-related create_notification call sites (chat, group status
  updates). Wallet/system notifications intentionally have no group_id.
- app.json: added iOS associatedDomains + Android intentFilters for
  universal links (requires hosted AASA + assetlinks files — tracked
  separately).

This unblocks the primary referral/invite growth loop on mobile and makes
push notifications actually useful.
```
