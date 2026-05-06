# Real Chat Time (WhatsApp-like)

Real-time 1:1 chat web app built with:
- **Frontend**: React + Vite + Tailwind
- **Backend**: Node + Express + Socket.IO + MongoDB (Mongoose)

## Run locally

### 1) Backend env

Copy `backend/.env.example` to `backend/.env` and fill:
- `MONGO_URI` (MongoDB connection string)
- optional: `JWT_SECRET`, `CLIENT_ORIGIN`
- optional for real email OTP:
  - `OTP_PROVIDER=resend` with `RESEND_API_KEY` and `OTP_EMAIL_FROM`
  - `OTP_PROVIDER=gmail` with `GMAIL_USER` and `GMAIL_PASSWORD`
  - optional for hosted IPv4-only environments: `GMAIL_SMTP_HOST`
  - `OTP_PROVIDER=smtp` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and optional `OTP_EMAIL_FROM`

If email provider config is missing and demo exposure is disabled, the server returns an OTP service error instead of exposing the code.
For local demo testing, use `OTP_PROVIDER=demo` together with `ALLOW_DEMO_OTP_IN_PRODUCTION=1` only if you intentionally want demo OTPs visible on the auth screen.
If `ALLOW_DEMO_OTP_IN_PRODUCTION=0` and `OTP_FALLBACK_TO_DEMO_ON_ERROR=0`, OTP is email-only and the server fails closed instead of exposing the code.
If your hosted mail provider is flaky and you accept demo-mode fallback, `OTP_FALLBACK_TO_DEMO_ON_ERROR=1` allows a fallback response.

### 2) Start backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`.

### 3) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on the port Vite chooses (example: `http://localhost:3002`).

## Production deploy

For production, the backend now serves the built frontend from `frontend/dist`, so the app can run as a single web service with Socket.IO and Atlas on the same domain.

Recommended production env:
- `OTP_PROVIDER=resend` on Railway Free/Trial/Hobby because Railway disables outbound SMTP on those plans
- `OTP_PROVIDER=gmail` only when your host supports outbound SMTP and your Gmail app-password flow is verified
- `ALLOW_DEMO_OTP_IN_PRODUCTION=0`
- `OTP_FALLBACK_TO_DEMO_ON_ERROR=0`
- `CLIENT_ORIGIN=https://YOUR_WEB_DOMAIN,http://localhost,capacitor://localhost,ionic://localhost`

### Render deploy like the Spotify clone

This repo now also includes:
- [render.yaml](./render.yaml)
- [RENDER_DEPLOY.md](./RENDER_DEPLOY.md)
- [backend/.env.render.example](./backend/.env.render.example)

Render is the better choice if you want the same Gmail app-password backend flow that worked in the Spotify clone.

### Local production check

```bash
cd frontend
npm install
npm run build

cd ../backend
npm install
npm start
```

Then open `http://localhost:5000`.

### Docker deploy

This repo includes a root `Dockerfile` that:
- installs frontend dependencies
- builds the Vite app
- installs backend production dependencies
- serves everything from the Express server on port `5000`

Build and run:

```bash
docker build -t real-chat-time .
docker run --env-file backend/.env -p 5000:5000 real-chat-time
```

## Android + iOS (App)

This project is configured with **Capacitor** in `frontend/`.

### Important: backend URL for mobile

On Android/iOS, `localhost` means the phone/emulator itself.
So update `frontend/.env` before building or running on mobile:

- **Android emulator**:
  - `VITE_API_URL=http://10.0.2.2:5000/api`
  - `VITE_SOCKET_URL=http://10.0.2.2:5000`
- **Real device** (replace with your PC LAN IP):
  - `VITE_API_URL=http://YOUR_PC_IP:5000/api`
  - `VITE_SOCKET_URL=http://YOUR_PC_IP:5000`

Then rebuild + sync:

```bash
cd frontend
npm run build
npx cap sync
```

This repo also includes Android-friendly defaults:
- Android emulator fallback automatically uses `http://10.0.2.2:5000` if no frontend env is set
- Android manifest includes internet, microphone, network-state, and notification permissions
- Cleartext HTTP is enabled for local development
- Hardware back handling is wired for the installed Android app
- Chat composer is keyboard-aware for Android devices
- Local message notifications are supported through Capacitor
- Camera/gallery shortcuts are enabled for chat attachments and status uploads

For production APK release, move your backend to HTTPS before shipping.

### Android run

```bash
cd frontend
npx cap open android
```

Build or run from Android Studio with USB debugging enabled.

### Faster Android commands

```bash
cd frontend
npm run build
npm run android:sync
```

Syncs fresh web assets into the Android project.

```bash
cd frontend
npm run build
npm run android:debug
```

Syncs web assets and builds a debug APK from the local Android project.

### Release outputs

```bash
cd frontend
npm run build
npm run android:release
```

Builds the Android release APK output.

```bash
cd frontend
npm run build
npm run android:aab
```

Builds the Android App Bundle for Play Store style delivery.

### Optional signing setup

If you want a custom release keystore:

1. Copy `frontend/android/keystore.properties.example` to `frontend/android/keystore.properties`
2. Put your keystore file in `frontend/android/app/`
3. Fill `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`

If no keystore file is configured, release artifacts can still be built for verification, but production publishing should use your own signing credentials.

This workspace can also generate a local release keystore automatically for direct install testing, but you should back it up safely because future app updates must use the same signing key.

### iOS run (macOS required)

```bash
cd frontend
npx cap open ios
```

Run from Xcode.

## Features

- Signup / Login
- Email + OTP auth
- Chat list (users)
- 1:1 real-time messaging (Socket.IO)
- Typing indicator
- Online / offline status (with last seen)
- Delete for me / delete for everyone
- 24-hour status updates
- Android-ready shell with splash, app icon, notifications, and media shortcuts
