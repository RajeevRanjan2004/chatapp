# Chatify Railway Deploy

This deploy setup makes the Android app work without the same Wi-Fi by moving the backend to a public HTTPS URL.

## 1. Railway service

Create or open a Railway project and connect this folder.

The project is already prepared with:
- [railway.toml](./railway.toml)
- [Dockerfile](./Dockerfile)

Railway will build the frontend, bundle it into the backend image, and serve everything from port `5000`.

## 2. Railway environment variables

Set these variables in Railway for the backend service:

```env
NODE_ENV=production
PORT=5000
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_ORIGIN=https://real-chat-time-web-production.up.railway.app,http://localhost,capacitor://localhost,ionic://localhost
OTP_PROVIDER=gmail
OTP_EMAIL_FROM=your-email@gmail.com
ALLOW_DEMO_OTP_IN_PRODUCTION=0
OTP_FALLBACK_TO_DEMO_ON_ERROR=0
OTP_TTL_MS=300000
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-16-char-app-password
GMAIL_SMTP_HOST=smtp.gmail.com
```

If Railway gives you a different domain, replace `https://real-chat-time-web-production.up.railway.app` everywhere above and below.

## 3. Deploy

After env vars are added, trigger a deploy in Railway.

Health check to verify:

```text
https://real-chat-time-web-production.up.railway.app/health
```

Expected response:

```json
{"ok":true}
```

## 4. OTP check

Test this API after deploy:

```text
POST https://real-chat-time-web-production.up.railway.app/api/auth/request-otp
```

Expected behavior:
- response should contain `provider`, `delivery`, `destinationHint`
- response should not contain `devOtp`
- OTP should arrive in email inbox/spam

## 5. Android app config

Production Android builds in this workspace now target:

```env
VITE_API_URL=https://real-chat-time-web-production.up.railway.app/api
VITE_SOCKET_URL=https://real-chat-time-web-production.up.railway.app
VITE_API_FALLBACK_URL=https://real-chat-time-web-production.up.railway.app/api
VITE_SOCKET_FALLBACK_URL=https://real-chat-time-web-production.up.railway.app
```

That config lives in [frontend/.env.production](./frontend/.env.production).

## 6. Rebuild Android app

Run:

```bash
cd frontend
npm run build
npm run android:release
npm run android:aab
```

Outputs:
- `frontend/android/app/build/outputs/apk/release/app-release.apk`
- `frontend/android/app/build/outputs/bundle/release/app-release.aab`

## 7. Signed release key

This workspace currently uses:
- [frontend/android/keystore.properties](./frontend/android/keystore.properties)
- [frontend/android/app/chatify-release.keystore](./frontend/android/app/chatify-release.keystore)

Back up the keystore safely. Future app updates must use the same signing key.
