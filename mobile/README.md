# ShareVerse Mobile

This is the native mobile client for ShareVerse, built with `Expo` and `React Native`.

## Included in this first mobile workspace

- Email/password sign in
- Email OTP signup
- Forgot password by email OTP
- Native token-based mobile auth using the new Django mobile endpoints
- Home dashboard
- Marketplace browse and join flow
- Wallet balances and transaction history
- Profile and referral screens

## Setup

```powershell
cd mobile
npm install
Copy-Item .env.example .env
npm start
```

From Expo you can then choose:

- `a` for Android emulator
- `i` for iOS simulator on macOS
- Expo Go on a physical device by scanning the QR code

For Android emulator, if your Django API is running on the same machine, use:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api/
```

For a physical device on the same Wi-Fi, use your laptop's LAN IP:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000/api/
```

## Backend routes used

- `POST /api/mobile/login/`
- `POST /api/mobile/signup/`
- `POST /api/mobile/auth/refresh/`
- `POST /api/mobile/auth/logout/`
- `POST /api/signup/request-otp/`
- `POST /api/forgot-password/request-otp/`
- `POST /api/forgot-password/confirm-otp/`
- `GET /api/dashboard/`
- `GET /api/groups/`
- `POST /api/join-group/`
- `GET /api/profile/`
- `GET /api/transactions/`
- `GET /api/referral/my-code/`

## Next mobile upgrades

- Native Razorpay top-up flow
- Google sign-in for Expo / native
- Push notifications
- Group chat screens
- Owner tools for creating and managing groups
