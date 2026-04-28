# ShareVerse Mobile

This is the native mobile client for ShareVerse, built with `Expo` and `React Native`.

## Included in this first mobile workspace

- Email/password sign in
- Google sign-in
- Email OTP signup
- Forgot password by email OTP
- Native token-based mobile auth using the new Django mobile endpoints
- Home dashboard
- Marketplace browse and join flow
- Native create split flow
- Hosted split list and split detail view
- Notifications inbox
- Chats inbox and group chat thread
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

To test Google sign-in in Expo Go or native builds, add your client IDs too:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-google-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-google-ios-client-id.apps.googleusercontent.com
```

## Production mobile env

For release builds, point the app at your live backend:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.shareverse.in/api/
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-google-android-client-id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your-google-ios-client-id.apps.googleusercontent.com
```

## Play Store build flow

1. Install Expo Application Services CLI:

```powershell
npm install -g eas-cli
```

2. Sign in to Expo:

```powershell
eas login
```

3. Build the production Android App Bundle:

```powershell
cd mobile
eas build --platform android --profile production
```

4. Download the generated `.aab` from Expo and upload it in Google Play Console.

Useful build profiles in [eas.json](./eas.json):

- `development`: development client build
- `preview`: internal APK build for quick testing
- `production`: Play Store `.aab` build

Before the first Play Store release, make sure you have:

- final package name: currently `com.shareverse.mobile`
- live API URL in `.env`
- privacy policy URL
- Play Store screenshots and listing copy
- Google Play testing track ready

## Backend routes used

- `POST /api/mobile/login/`
- `POST /api/mobile/auth/google/`
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
- `POST /api/create-group/`
- `GET /api/my-groups/`
- `GET /api/my-groups/<id>/`
- `POST /api/invite/generate/`
- `GET /api/notifications/`
- `POST /api/notifications/mark-all-read/`
- `POST /api/notifications/<id>/read/`
- `GET /api/group-chats/`
- `GET /api/groups/<id>/chat/`
- `POST /api/groups/<id>/chat/`
- `PATCH /api/groups/<id>/chat/`

## Next mobile upgrades

- Native Razorpay top-up flow
- Push notifications
- Richer owner tools for proof upload, refunds, and activation
- Joined-member mobile management for access confirm / issue reports
