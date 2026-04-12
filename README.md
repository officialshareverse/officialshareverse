# ShareVerse

ShareVerse is a full-stack platform for coordinating shared plans and buy-together groups.

It combines group creation, wallet-backed joins, member chat, notifications, ratings, secure account flows, and Razorpay top-ups in one product. The current app is built for two main flows:

- `sharing`: a host opens spots in an existing plan and members join the active cycle
- `group_buy`: members join first, funds are held, the purchaser completes the purchase, and payout releases after access confirmations

## Product Highlights

- JWT-based authentication with signup, login, forgot password, and OTP reset
- Sharing groups with owner-managed access coordination
- Buy-together groups with escrow-style holds, proof upload, member confirmations, disputes, and timed refunds
- Wallet balance, transaction history, top-ups through Razorpay, and internal withdraw flow
- Group chat, chat inbox, unread counts, and notifications
- Ratings and trust signals on user profiles
- Legal/support pages for terms, privacy, refunds, and support
- Safer credential handling with encrypted storage and owner-only reveal flow

## Tech Stack

- Frontend: React 19, React Router, Axios, Tailwind utility styling
- Backend: Django, Django REST Framework, SimpleJWT
- Payments: Razorpay Orders API and webhook verification
- Cache / throttling: Redis when configured, local memory fallback otherwise
- Database: SQLite by default, PostgreSQL-ready through environment variables

## Repository Structure

```text
mystartup/
|-- backend/
|   |-- core/
|   |-- mystartup/
|   |-- manage.py
|   `-- .env.example
|-- docs/
|   |-- DEPLOYMENT.md
|   `-- LAUNCH_CHECKLIST.md
|-- frontend/
|   |-- public/
|   |-- src/
|   `-- .env.example
`-- README.md
```

## Local Development

### Prerequisites

- Python `3.13.3` is the current working version in this repo
- Node.js `22.15.0`
- npm `10.9.2`

### Backend Setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py runserver
```

The backend runs at `http://127.0.0.1:8000/`.

### Frontend Setup

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm start
```

The frontend runs at `http://localhost:3000/`.

## Environment Files

Backend env example: [backend/.env.example](backend/.env.example)

Frontend env example: [frontend/.env.example](frontend/.env.example)

Important backend values:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_EXPOSE_DEV_OTP`
- `CREDENTIAL_ENCRYPTION_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `DJANGO_REDIS_URL`
- `POSTGRES_*`

## Payment Notes

- Wallet top-ups use Razorpay order creation plus signature verification.
- Razorpay webhooks are supported at `/api/payments/razorpay/webhook/`.
- The current `withdraw money` flow is an internal wallet deduction, not a real bank payout rail yet.

## Background Jobs

Buy-together refunds and auto-releases should be processed on a schedule:

```powershell
cd backend
python manage.py process_expired_group_buy_refunds
```

Recommended schedule: every `5 minutes`.

## Production Notes

- Use PostgreSQL for production instead of SQLite.
- Configure Redis for shared OTP / rate-limit state in multi-server deployments.
- Set `DJANGO_EXPOSE_DEV_OTP=false`.
- Keep `CREDENTIAL_ENCRYPTION_KEY` stable across deploys.
- Configure Razorpay live keys and webhook secret through environment variables, never in frontend code.
- Serve backend media from durable storage if purchase proof uploads matter in production.

## Launch Docs

- Deployment guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Launch checklist: [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md)

## Current Focus Areas Before Public Launch

- Real bank payout integration for withdrawals
- Production monitoring, backups, and alerting
- Final policy/legal review of terms, privacy, and refund language
- Domain, HTTPS, and live webhook verification
