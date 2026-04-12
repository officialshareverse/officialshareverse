# ShareVerse Launch Checklist

Use this list before opening ShareVerse to real users.

## Product Readiness

- Verify signup, login, forgot password, and OTP reset on production
- Verify sharing group creation, join flow, and prorated late join pricing
- Verify buy-together flow from group creation to confirmation and payout release
- Verify group chat, chat inbox, and notification inbox
- Verify profile ratings and review visibility
- Verify terms, privacy, refunds, and support pages are live

## Payments

- Razorpay live keys configured
- Razorpay webhook live and signing correctly
- Real top-up flow tested with a small live payment
- Wallet credit verified after webhook delivery
- Refund path tested for an expired buy-together group
- Decide whether to block or label wallet withdrawals until bank payout rails are implemented

## Security

- `DJANGO_DEBUG=false`
- `DJANGO_EXPOSE_DEV_OTP=false`
- strong `DJANGO_SECRET_KEY`
- strong stable `CREDENTIAL_ENCRYPTION_KEY`
- Redis configured for production throttling
- backend `.env` files excluded from git
- access to payment secrets restricted to backend only

## Infrastructure

- PostgreSQL configured and backed up
- Redis configured
- backend media storage is persistent
- domain and HTTPS configured
- CORS and allowed hosts match production domains
- scheduled refund processor runs every 5 minutes
- logging and error monitoring are enabled

## Support and Operations

- `support@shareverse.app` or your support inbox is active
- refund policy matches actual operations
- dispute handling process is documented internally
- someone is monitoring payment failures and webhook issues
- support response targets are defined

## Legal and Policy

- terms reviewed by a lawyer
- privacy policy reviewed by a lawyer
- refund policy reviewed by a lawyer
- provider risk labels are in place for high-risk subscription types
- public messaging does not promise policy-unsafe credential sharing

## Go-Live Test Accounts

- one host account ready
- two member accounts ready
- one sharing-group test flow completed
- one buy-together test flow completed
- one notification flow completed
- one chat flow completed
- one rating flow completed

## Day-One Dashboard

Track these right after launch:

- new signups
- groups created
- groups joined
- wallet top-up success rate
- webhook failures
- support tickets
- access disputes
- refund volume
