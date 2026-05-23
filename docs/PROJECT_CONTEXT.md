# ShareVerse Project Context

Last checked: 2026-05-19 from `C:\Users\ACER\mystartup`.

This note records the current repository state after scanning the workspace. Treat it as an engineering context file, not product copy.

## Product Shape

ShareVerse is a full-stack app for shared-cost digital plans.

Core flows:

- `sharing`: a host already has a plan and opens paid slots.
- `group_buy`: members join first, funds are held, the creator buys later, and payout releases after access confirmation or a clean confirmation-window timeout.

Current product areas in the repo include marketplace/home, create group, my shared groups, wallet, chats, notifications, referrals, profile, legal/support pages, and native mobile screens.

## Repository Layout

- Backend: `backend`
- Backend Django project: `backend/mystartup`
- Main backend app: `backend/core`
- Frontend web app: `frontend`
- Main frontend pages: `frontend/src/pages`
- Mobile Expo app: `mobile`
- Deployment docs: `docs`

The repo now includes a mobile app. Older context that only mentioned frontend/backend is incomplete.

## Current Stack

Backend, from `backend/requirements.txt`:

- Django `6.0.4`
- Django REST Framework `3.17.1`
- SimpleJWT `5.5.1`
- Channels, Daphne, channels-redis
- Redis client
- PostgreSQL support through `psycopg[binary]` and `dj-database-url`
- Gunicorn, WhiteNoise, Pillow
- Google auth through `google-auth`
- `requests==2.32.3` is already present

Frontend, from `frontend/package.json`:

- React `19.2.4`
- React Router DOM `7.14.0`
- Axios `1.15.0`
- Create React App / `react-scripts` `5.0.1`
- Tailwind utilities through Tailwind `3.4.1`, PostCSS, Autoprefixer

Mobile, from `mobile/package.json`:

- Expo `54.0.34`
- React Native `0.81.5`
- React `19.1.0`
- React Navigation 7
- Expo SecureStore, AuthSession, Notifications, DocumentPicker, WebBrowser, Font
- Axios `1.15.0`

## Auth State

Web auth has moved beyond the older localStorage-only access token pattern:

- `frontend/src/auth/session.js` stores the access token in `sessionStorage` under `sv-access-token`.
- It only reads legacy `localStorage` key `token` to migrate and remove it.
- `frontend/src/api/axios.js` uses `withCredentials: true`, refreshes access tokens through `/api/auth/refresh/`, and retries one failed 401 request.
- Backend refresh tokens are HttpOnly cookies, configured by `AUTH_REFRESH_COOKIE_*` settings.
- SimpleJWT rotation and blacklist are enabled in `backend/mystartup/settings.py`.

Mobile auth uses native token endpoints:

- `POST /api/mobile/login/`
- `POST /api/mobile/signup/`
- `POST /api/mobile/auth/google/`
- `POST /api/mobile/auth/refresh/`
- `POST /api/mobile/auth/logout/`

Mobile stores access and refresh tokens in Expo SecureStore.

Signup and password reset use OTP flows. Google sign-in is implemented in `backend/core/auth_views.py` and `frontend/src/components/GoogleAuthButton.js`; the mobile app also has a Google auth path.

## Pricing And Payout Economics

Current pricing helpers live in `backend/core/pricing.py`.

- `GROUP_JOIN_PLATFORM_FEE_RATE = Decimal("0.05")`
- `GROUP_EARNING_PLATFORM_FEE_RATE = Decimal("0.05")`
- Join price includes a 5% member-side platform fee.
- Creator payout also deducts a 5% earning-side platform fee before crediting the owner wallet.
- Sharing joins can be prorated by remaining cycle days.
- `get_group_join_pricing()` returns base price, subtotal, platform fee, final join price, prorating flags, and expiry metadata.

Important implication: do not change group economics without checking both member-side join fees and creator-side payout fees.

## Funds Flow

Sharing:

- Joining creates a paid `GroupMember` with held escrow status.
- Host payout is released only after the member confirms access.
- Release path uses `release_sharing_member_funds()` in `backend/core/views.py`.
- Released amount is contribution minus creator-side earning fee.

Buy-together:

- Members pay into held escrow.
- When the group fills, the owner must buy the plan and submit purchase proof.
- Members confirm access.
- Payout releases after all held members confirm, unless there is a reported issue.
- A clean confirmation-window timeout can auto-release funds.
- Missed purchase deadlines can auto-refund held members.
- Scheduled processor command: `python manage.py process_expired_group_buy_refunds`

Current constants in `backend/core/views.py`:

- Purchase deadline: `BUY_TOGETHER_PURCHASE_DEADLINE_HOURS = 6`
- Member confirmation window: `BUY_TOGETHER_MEMBER_CONFIRMATION_WINDOW_HOURS = 12`

## Payments And Withdrawals

Wallet top-ups:

- Razorpay order creation and verification are implemented.
- Razorpay webhook support exists at `/api/payments/razorpay/webhook/`.
- Top-up order model: `WalletTopupOrder`.
- Webhook model: `RazorpayWebhookEvent`.

Withdrawals:

- Manual withdrawal request flow is active.
- Manual request does not immediately deduct wallet balance.
- Admin processing deducts wallet balance, creates the debit transaction, and marks payout processed.
- Manual payout helpers live in `backend/core/manual_payouts.py`.
- RazorpayX payout creation, sync, and webhook support exist for future automated payouts.
- RazorpayX webhook path: `/api/payments/razorpayx/webhook/`.
- Automated payout mode depends on RazorpayX key, secret, and source account number being configured.

## Settings And Production Safety

`backend/mystartup/settings.py` now fails safer than the older notes:

- Default environment is `production` unless running tests or `DJANGO_ENV` is set.
- `DJANGO_SECRET_KEY` is required outside development and tests.
- `DJANGO_DEBUG` defaults to development-only.
- `DJANGO_EXPOSE_DEV_OTP` defaults to development/test only.
- Production raises `ImproperlyConfigured` if dev OTP exposure is enabled.
- Production defaults include `api.shareverse.in`, `shareverse.in`, and `www.shareverse.in`.
- HTTPS/security settings turn on when not debug and not test.

Practical local note:

- Plain `python backend\manage.py check` fails if no `.env` or `DJANGO_ENV` is configured, because production requires `DJANGO_SECRET_KEY`.
- `DJANGO_ENV=development python backend\manage.py check` passes.

## Deployment Shape

Current docs describe:

- Frontend: Vercel at `https://shareverse.in`
- Backend API: VPS at `https://api.shareverse.in`
- Backend runtime: Gunicorn behind Nginx
- Production database: PostgreSQL
- Production cache/rate-limit state: Redis
- Payments: Razorpay live keys plus webhook
- Withdrawals: manual request plus Django admin processing

Backend release script: `backend/release.sh`

Release order in the script:

1. `pip install -r requirements.txt`
2. `python manage.py check --deploy`
3. `python manage.py showmigrations --plan`
4. `python manage.py migrate --noinput`
5. `python manage.py collectstatic --noinput`

Schedule `python manage.py process_expired_group_buy_refunds` about every 5 minutes in production.

## Environment Variables

Important backend variables:

- `DJANGO_ENV`
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CORS_ALLOWED_ORIGIN_REGEXES`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DJANGO_EXPOSE_DEV_OTP`
- `DJANGO_SERVE_MEDIA`
- `DJANGO_AUTH_REFRESH_COOKIE_NAME`
- `DJANGO_AUTH_REFRESH_COOKIE_SECURE`
- `DJANGO_AUTH_REFRESH_COOKIE_SAMESITE`
- `DJANGO_AUTH_REFRESH_COOKIE_PATH`
- `DJANGO_AUTH_REFRESH_COOKIE_DOMAIN`
- `CREDENTIAL_ENCRYPTION_KEY`
- `DJANGO_GOOGLE_CLIENT_ID` or `DJANGO_GOOGLE_CLIENT_IDS`
- `DJANGO_EMAIL_*`
- `MSG91_*`
- `DATABASE_URL`
- `DJANGO_REDIS_URL` or `REDIS_URL`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAYX_KEY_ID`
- `RAZORPAYX_KEY_SECRET`
- `RAZORPAYX_WEBHOOK_SECRET`
- `RAZORPAYX_SOURCE_ACCOUNT_NUMBER`

Frontend variables:

- `REACT_APP_API_BASE_URL`
- `REACT_APP_GOOGLE_CLIENT_ID`

Mobile variables:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

## Migrations And Models

Migrations currently go through:

- `backend/core/migrations/0035_mask_payout_account_vpa_handles.py`

The older note that stopped at `0028_groupchatpresence.py` is outdated. Important later additions include invite/referral, wallet bonus balance, mobile push devices, account deletion, content reports/user blocks, and VPA masking.

Key models include:

- `User`
- `Subscription`
- `Group`
- `GroupMember`
- `GroupInviteLink`
- `ReferralCode`
- `Referral`
- `Wallet`
- `Transaction`
- `WalletTopupOrder`
- `PayoutAccount`
- `WalletPayout`
- `RazorpayWebhookEvent`
- `RazorpayXPayoutWebhookEvent`
- `MobilePushDevice`
- `AccountDeletionRequest`
- `GroupChatMessage`
- `GroupChatPresence`
- `UserBlock`
- `ContentReport`
- `PasswordResetOTP`
- `SignupOTP`

## Frontend Notes

The web app routes are in `frontend/src/App.js`.

Current private routes include:

- `/home`
- `/groups`
- `/notifications`
- `/chats`
- `/create`
- `/my-shared`
- `/profile`
- `/wallet`
- `/referrals`
- `/groups/:groupId/chat`

Public/legal routes include:

- `/`
- `/login`
- `/signup`
- `/about`
- `/faq`
- `/invite/:token`
- `/terms`
- `/privacy`
- `/refunds`
- `/shipping`
- `/support`
- `/account-deletion`

Frontend tests are no longer only an App shell test. There are currently 12 tracked `.test.js` files under `frontend/src`.

The older note about many browser-native `alert`, `confirm`, and `prompt` calls appears outdated for tracked frontend code: a scan of `frontend/src` found no direct calls.

## Large Files And Maintainability

Large files remain a major weakness:

- `backend/core/views.py`: about 181 KB, 4709 lines
- `backend/core/tests.py`: about 175 KB, 4042 lines
- `backend/core/serializers.py`: about 59 KB
- `backend/core/auth_views.py`: about 43 KB
- `frontend/src/pages/MyShared.js`: about 85 KB, 2024 lines
- `frontend/src/pages/Wallet.js`: about 65 KB
- `frontend/src/pages/Groups.js`: about 50 KB
- `frontend/src/pages/Home.js`: about 46 KB
- `frontend/src/pages/CreateGroup.js`: about 45 KB
- `frontend/src/pages/Profile.js`: about 44 KB
- `frontend/src/index.css`: 10216 lines

Splitting `views.py`, `tests.py`, `MyShared.js`, `Wallet.js`, and `index.css` would reduce future change risk.

## Current Verification Results

Git state at scan time:

- Modified: `frontend/src/pages/Profile.js`
- Untracked: `shareverse-testers.csv`
- Do not overwrite, revert, or commit those unless explicitly asked.

Tooling note:

- `rg --files` failed locally with `Access is denied`, so scans used `git ls-files`, PowerShell file reads, and `Select-String`.

Commands run:

- `python backend\manage.py check`
  - Failed without env due `DJANGO_SECRET_KEY must be set outside development and tests.`
  - This matches the safer production default.
- `$env:DJANGO_ENV='development'; python backend\manage.py check`
  - Passed: `System check identified no issues`.
- `npm run build` in `frontend`
  - Passed.
- `npm test -- --watchAll=false --runInBand` in `frontend`
  - Failed in sandbox with `spawn EPERM`.
  - Retried outside sandbox and timed out, so frontend test status is inconclusive from this scan.
- `python backend\manage.py test core.tests --verbosity 1`
  - Current suite reports `Found 142 test(s)`.
  - It did not match the older `106 tests pass` note.
  - Run output showed 1 failure and 2 errors before timeout/termination.
  - Failure: `test_forgot_password_fails_with_wrong_verification_details` expected HTTP 400 but received 200.
  - Errors: admin payout/account change-page tests hit `Missing staticfiles manifest entry for 'admin/css/base.css'`.

## Updated Priorities

1. Fix or explain the current backend test failures/errors.
2. Make frontend Jest runnable reliably in this local environment.
3. Keep `requests` in `backend/requirements.txt`; it is already present.
4. Preserve the safer production settings behavior.
5. Continue hardening auth storage and refresh behavior, but note that web refresh-cookie handling is already implemented.
6. Split the largest backend/frontend files into smaller modules and components.
7. Add or maintain focused tests around login, signup, wallet, my-shared, chats, payouts, and group-buy release/refund flows.
8. Consider moving the web frontend from CRA to Vite later.

