# ShareVerse Deployment Guide

This repository is now prepared for a Render-based deployment.

Recommended production shape for this project:

- Frontend static site: `https://shareverse.in`
- Backend API: `https://api.shareverse.in`
- Backend runtime: Render Python web service with Gunicorn
- Database: Render PostgreSQL
- Cache: Render Redis
- Payments: Razorpay live keys plus webhook
- Payouts: RazorpayX live keys, source account number, and payout webhook
- Media: Django media served by the app for now, then moved to durable object storage later

## 1. Create the Render Services

This repo includes [render.yaml](../render.yaml). In Render, create a new Blueprint deployment from the GitHub repo.

The blueprint provisions:

- `shareverse-web`
- `shareverse-api`
- `shareverse-db`
- `shareverse-redis`

The backend health check path is:

```text
/api/health/
```

## 2. Prepare Environment Variables

Create a production env file based on [backend/.env.example](../backend/.env.example).

Render will generate and inject some values from the blueprint, but you still need to set the payment secrets manually.

Minimum backend production values:

```env
DJANGO_SECRET_KEY=replace-with-a-strong-secret
DJANGO_DEBUG=false
DJANGO_EXPOSE_DEV_OTP=false
DJANGO_ALLOWED_HOSTS=api.shareverse.in,.onrender.com
DJANGO_CORS_ALLOWED_ORIGINS=https://shareverse.in,https://shareverse-web.onrender.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://shareverse.in,https://shareverse-web.onrender.com,https://api.shareverse.in
DJANGO_SERVE_MEDIA=true

CREDENTIAL_ENCRYPTION_KEY=replace-with-a-stable-secret

RAZORPAY_KEY_ID=rzp_live_your_key
RAZORPAY_KEY_SECRET=your_live_secret
RAZORPAY_WEBHOOK_SECRET=your_live_webhook_secret
RAZORPAY_COMPANY_NAME=ShareVerse
RAZORPAY_CURRENCY=INR

RAZORPAYX_KEY_ID=rzp_live_your_razorpayx_key
RAZORPAYX_KEY_SECRET=your_razorpayx_secret
RAZORPAYX_WEBHOOK_SECRET=your_razorpayx_webhook_secret
RAZORPAYX_SOURCE_ACCOUNT_NUMBER=your_source_account_number

DATABASE_URL=postgres://...
DJANGO_REDIS_URL=redis://...
```

Frontend production values:

```env
REACT_APP_API_BASE_URL=https://api.shareverse.in/api/
```

For the very first Render deploy, keep the frontend pointed to the temporary Render backend URL so the site works before the custom API domain is ready:

```env
REACT_APP_API_BASE_URL=https://shareverse-api.onrender.com/api/
```

After `api.shareverse.in` is live over HTTPS, switch that frontend env var to the custom domain and redeploy the frontend.

## 3. Custom Domains and DNS

In Render, attach these custom domains:

- `shareverse.in` to `shareverse-web`
- `api.shareverse.in` to `shareverse-api`

Then add the DNS records that Render gives you in your domain provider panel.

Do not configure Razorpay webhooks until `https://api.shareverse.in` opens successfully in the browser.

## 4. Install Backend Dependencies Manually If Needed

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 5. Run Migrations Manually If Needed

```bash
cd backend
python manage.py migrate
```

Render’s backend build script already runs:

- `pip install -r requirements.txt`
- `python manage.py collectstatic --noinput`
- `python manage.py migrate`

## 6. Build the Frontend Manually If Needed

```bash
cd frontend
npm install
npm run build
```

Deploy the generated `frontend/build` directory to your static host, or serve it behind your web server.

## 7. Configure Razorpay Webhook

Create a Razorpay webhook that points to:

```text
https://api.shareverse.in/api/payments/razorpay/webhook/
```

Subscribe to at least these events:

- `payment.authorized`
- `payment.captured`
- `order.paid`

Use the same secret in `RAZORPAY_WEBHOOK_SECRET`.

## 8. Configure RazorpayX Payout Webhook

Create a RazorpayX webhook that points to:

```text
https://api.shareverse.in/api/payments/razorpayx/webhook/
```

Subscribe to payout lifecycle events so wallet balances stay in sync when payouts process, fail, or reverse.

Use the same secret in `RAZORPAYX_WEBHOOK_SECRET`.

## 9. Run the Refund / Auto-Release Job

Schedule this command every `5 minutes`:

```bash
cd backend
python manage.py process_expired_group_buy_refunds
```

This handles:

- expired buy-together refunds
- automatic release for clean confirmation windows

## 10. Security Settings to Double-Check

- `DJANGO_DEBUG=false`
- `DJANGO_EXPOSE_DEV_OTP=false`
- live Razorpay keys only on the backend
- live RazorpayX keys only on the backend
- stable `CREDENTIAL_ENCRYPTION_KEY`
- correct `DJANGO_ALLOWED_HOSTS`
- correct `DJANGO_CORS_ALLOWED_ORIGINS`
- HTTPS enabled on frontend and backend domains

## 11. Operational Notes

- SQLite is fine for local development, but production should use PostgreSQL.
- Redis is strongly recommended for multi-server OTP throttling and cache-backed rate limits.
- Purchase proof uploads currently use Django media storage. This works for an initial single-instance Render deploy, but move them to durable storage before scaling horizontally.
- Configure and test a real beneficiary payout path in RazorpayX before enabling public withdrawals.

## 12. Smoke Test After Deploy

Run this checklist after each production deploy:

1. Sign up a new user.
2. Log in successfully.
3. Create a sharing group.
4. Create a buy-together group.
5. Top up the wallet using Razorpay test or live sandbox flow as appropriate.
6. Save a payout method and request a small withdrawal.
7. Upload purchase proof in a full buy-together group.
8. Open notifications and chat.
9. Confirm the webhook credits a wallet top-up and updates a payout.
10. Run the refund processor once manually and confirm it completes cleanly.
