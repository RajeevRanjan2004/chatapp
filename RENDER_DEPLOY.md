# Chatify Render Deploy

This matches the Spotify clone style backend flow: GitHub repo -> Render web service -> Gmail app-password OTP.

## 1. Create the service

1. Open [https://dashboard.render.com](https://dashboard.render.com)
2. Click `New` -> `Blueprint`
3. Select repo: `RajeevRanjan2004/chatapp`
4. Render will detect [render.yaml](./render.yaml)
5. Create the service

## 2. Set environment variables

Use [backend/.env.render.example](./backend/.env.render.example) as the template.

Required values:

```env
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_ORIGIN=https://your-chatify-service.onrender.com,http://localhost,capacitor://localhost,ionic://localhost
OTP_PROVIDER=gmail
OTP_EMAIL_FROM=rajarajeev311@gmail.com
GMAIL_USER=rajarajeev311@gmail.com
GMAIL_PASSWORD=your-16-char-app-password
ALLOW_DEMO_OTP_IN_PRODUCTION=0
OTP_FALLBACK_TO_DEMO_ON_ERROR=0
OTP_TTL_MS=300000
```

## 3. Deploy and test

After saving the variables:

1. Trigger a deploy
2. Open `https://your-chatify-service.onrender.com/health`
3. Expected response:

```json
{"ok":true}
```

4. Test OTP from the app or by calling:

```text
POST https://your-chatify-service.onrender.com/api/auth/request-otp
```

Expected:
- response should not contain `devOtp`
- response should not fall back to `provider: demo`
- OTP should arrive in the inbox or spam folder

## 4. Android app after Render deploy

Once Render gives you the final domain, update [frontend/.env.production](./frontend/.env.production) to:

```env
VITE_API_URL=https://your-chatify-service.onrender.com/api
VITE_SOCKET_URL=https://your-chatify-service.onrender.com
VITE_API_FALLBACK_URL=https://your-chatify-service.onrender.com/api
VITE_SOCKET_FALLBACK_URL=https://your-chatify-service.onrender.com
```

Then rebuild:

```bash
cd frontend
npm run build
npm run android:release
npm run android:aab
```
