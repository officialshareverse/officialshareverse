# ShareVerse Deployment Guide

This guide covers the current deployment path for ShareVerse as it exists in this repository.

## Recommended Production Shape

- Frontend: static React build served from Vercel, Netlify, Nginx, or another static host
- Backend: Django API served behind Gunicorn/Uvicorn on a Linux VM, container platform, or managed host
- Database: PostgreSQL
- Cache: Redis
- Payments: Razorpay live keys plus webhook
- Media: persistent storage for uploaded purchase proof files

## 1. Prepare Environment Variables

Create a production env file based on [backend/.env.example](../backend/.env.example).

Minimum backend production values:

```env
DJANGO_SECRET_KEY=replace-with-a-strong-secret
DJANGO_DEBUG=false
DJANGO_EXPOSE_DEV_OTP=false
DJANGO_ALLOWED_HOSTS=api.yourdomain.com
DJANGO_CORS_ALLOWED_ORIGINS=https://yourdomain.com

CREDENTIAL_ENCRYPTION_KEY=replace-with-a-stable-secret

RAZORPAY_KEY_ID=rzp_live_your_key
RAZORPAY_KEY_SECRET=your_live_secret
RAZORPAY_WEBHOOK_SECRET=your_live_webhook_secret
RAZORPAY_COMPANY_NAME=ShareVerse
RAZORPAY_CURRENCY=INR

DJANGO_REDIS_URL=redis://127.0.0.1:6379/1

POSTGRES_DB=shareverse
POSTGRES_USER=shareverse
POSTGRES_PASSWORD=replace-me
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

Frontend production values:

```env
REACT_APP_API_BASE_URL=https://api.yourdomain.com/api/
```

## 2. Install Backend Dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If you are deploying with PostgreSQL, also install:

```bash
pip install "psycopg[binary]>=3.2,<4.0"
```

## 3. Run Migrations

```bash
cd backend
python manage.py migrate
```

## 4. Build the Frontend

```bash
cd frontend
npm install
npm run build
```

Deploy the generated `frontend/build` directory to your static host, or serve it behind your web server.

## 5. Configure Razorpay Webhook

Create a Razorpay webhook that points to:

```text
https://api.yourdomain.com/api/payments/razorpay/webhook/
```

Subscribe to at least these events:

- `payment.authorized`
- `payment.captured`
- `order.paid`

Use the same secret in `RAZORPAY_WEBHOOK_SECRET`.

## 6. Run the Refund / Auto-Release Job

Schedule this command every `5 minutes`:

```bash
cd backend
python manage.py process_expired_group_buy_refunds
```

This handles:

- expired buy-together refunds
- automatic release for clean confirmation windows

## 7. Security Settings to Double-Check

- `DJANGO_DEBUG=false`
- `DJANGO_EXPOSE_DEV_OTP=false`
- live Razorpay keys only on the backend
- stable `CREDENTIAL_ENCRYPTION_KEY`
- correct `DJANGO_ALLOWED_HOSTS`
- correct `DJANGO_CORS_ALLOWED_ORIGINS`
- HTTPS enabled on frontend and backend domains

## 8. Operational Notes

- SQLite is fine for local development, but production should use PostgreSQL.
- Redis is strongly recommended for multi-server OTP throttling and cache-backed rate limits.
- Purchase proof uploads currently use Django media storage; move this to durable storage if you deploy across multiple instances.
- The current withdraw flow is not a bank payout integration. Treat it as a product placeholder until payout rails are added.

## 9. Smoke Test After Deploy

Run this checklist after each production deploy:

1. Sign up a new user.
2. Log in successfully.
3. Create a sharing group.
4. Create a buy-together group.
5. Top up the wallet using Razorpay test or live sandbox flow as appropriate.
6. Upload purchase proof in a full buy-together group.
7. Open notifications and chat.
8. Confirm the webhook credits a wallet top-up.
9. Run the refund processor once manually and confirm it completes cleanly.
