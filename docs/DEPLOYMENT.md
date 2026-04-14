# ShareVerse Deployment Guide

This guide reflects the current live production setup for ShareVerse.

## Current Production Shape

- Frontend: Vercel at `https://shareverse.in`
- Backend API: VPS-hosted Django app at `https://api.shareverse.in`
- Backend runtime: Gunicorn behind Nginx
- Database: PostgreSQL
- Cache / throttling: Redis
- Payments: Razorpay live keys plus webhook verification
- Withdrawals: manual request flow plus Django admin payout completion
- Media: Django media served by the app for now, then moved to durable storage later

The repo still includes [render.yaml](../render.yaml) as an optional Render blueprint, but the current live system is Vercel plus VPS.

## 1. Prepare Backend Environment Variables

Create a production env file based on [backend/.env.example](../backend/.env.example).

Minimum backend production values for the current live setup:

```env
DJANGO_SECRET_KEY=replace-with-a-strong-secret
DJANGO_DEBUG=false
DJANGO_EXPOSE_DEV_OTP=false
DJANGO_ALLOWED_HOSTS=api.shareverse.in
DJANGO_CORS_ALLOWED_ORIGINS=https://shareverse.in,https://www.shareverse.in
DJANGO_CSRF_TRUSTED_ORIGINS=https://shareverse.in,https://www.shareverse.in,https://api.shareverse.in
DJANGO_SERVE_MEDIA=true

CREDENTIAL_ENCRYPTION_KEY=replace-with-a-stable-secret

RAZORPAY_KEY_ID=rzp_live_your_key
RAZORPAY_KEY_SECRET=your_live_secret
RAZORPAY_WEBHOOK_SECRET=your_live_webhook_secret
RAZORPAY_COMPANY_NAME=ShareVerse
RAZORPAY_CURRENCY=INR

DATABASE_URL=postgres://...
DJANGO_REDIS_URL=redis://...
```

Optional future automated payout values:

```env
RAZORPAYX_KEY_ID=rzp_live_your_razorpayx_key
RAZORPAYX_KEY_SECRET=your_razorpayx_secret
RAZORPAYX_WEBHOOK_SECRET=your_razorpayx_webhook_secret
RAZORPAYX_SOURCE_ACCOUNT_NUMBER=your_source_account_number
```

Frontend production values:

```env
REACT_APP_API_BASE_URL=https://api.shareverse.in/api/
```

## 2. Deploy the Backend on the VPS

Use this flow after pulling a new release:

```bash
cd /var/www/officialshareverse
git pull origin main
cd backend
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py check
systemctl restart shareverse
```

If you changed only frontend code, Vercel will usually redeploy automatically from `main`.

## 3. Domains and DNS

Current production domains:

- `shareverse.in` on Vercel
- `www.shareverse.in` on Vercel
- `api.shareverse.in` on the VPS

Confirm:

- frontend opens over HTTPS
- backend health endpoint opens at `https://api.shareverse.in/api/health/`
- CORS and CSRF origins match the public domains

## 4. Configure the Razorpay Webhook

Create a Razorpay webhook that points to:

```text
https://api.shareverse.in/api/payments/razorpay/webhook/
```

Subscribe to at least these events:

- `payment.authorized`
- `payment.captured`
- `order.paid`

Use the same secret in `RAZORPAY_WEBHOOK_SECRET`.

## 5. Operate Manual Withdrawals Safely

Withdrawals are currently manual, not provider-automated.

Live flow:

1. User saves a bank account or UPI destination in the wallet page.
2. User requests a withdrawal from the wallet page.
3. A `pending` manual payout record is created.
4. You transfer the money manually outside the app.
5. You open Django admin at `https://api.shareverse.in/admin/`.
6. In `Wallet payouts`, open the pending payout, enter the transfer reference, tick `Process now`, and save.

That admin action:

- deducts the wallet balance
- creates the debit transaction
- marks the payout as processed
- keeps payout history consistent

Only process the admin payout after the money has actually been sent.

## 6. Optional Future Automated Payouts

If a payout provider is approved later, you can switch from manual withdrawals to automated payouts.

This repo already has RazorpayX hooks prepared for that future state:

- payout webhook path: `/api/payments/razorpayx/webhook/`
- payout health visibility through `/api/health/`

Do not enable automated withdrawals publicly until the provider is approved, tested, and reconciled end to end.

## 7. Run the Refund / Auto-Release Job

Schedule this command every `5 minutes`:

```bash
cd /var/www/officialshareverse/backend
source .venv/bin/activate
python manage.py process_expired_group_buy_refunds
```

This handles:

- expired buy-together refunds
- automatic release for clean confirmation windows

## 8. Security Settings to Double-Check

- `DJANGO_DEBUG=false`
- `DJANGO_EXPOSE_DEV_OTP=false`
- live Razorpay keys only on the backend
- stable `CREDENTIAL_ENCRYPTION_KEY`
- correct `DJANGO_ALLOWED_HOSTS`
- correct `DJANGO_CORS_ALLOWED_ORIGINS`
- HTTPS enabled on frontend and backend domains
- admin access restricted to trusted operators

## 9. Operational Notes

- SQLite is fine for local development, but production should use PostgreSQL.
- Redis is recommended for shared throttling and cache-backed rate limits.
- Purchase proof uploads currently use Django media storage. This works for an initial single-instance deployment, but move them to durable storage before scaling horizontally.
- Keep records of manual payouts, including date, amount, destination, and UTR / transaction reference.
- Review manual payout requests carefully before completing them in admin.

## 10. Smoke Test After Deploy

Run this checklist after each production deploy:

1. Sign up a new user.
2. Log in successfully.
3. Create a sharing group.
4. Create a buy-together group.
5. Top up the wallet using a small live Razorpay payment.
6. Save a payout destination and request a small withdrawal.
7. Process that withdrawal manually through Django admin.
8. Confirm the wallet balance decreases only after admin processing.
9. Upload purchase proof in a full buy-together group.
10. Open notifications and chat.
11. Run the refund processor once manually and confirm it completes cleanly.
