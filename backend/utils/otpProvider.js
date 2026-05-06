const https = require("https");
const nodemailer = require("nodemailer");
const { maskEmail, normalizeEmail } = require("./identity");

const DEFAULT_OTP_TTL_MS = 5 * 60 * 1000;
const otpStore = new Map();

class OtpError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "OtpError";
    this.statusCode = statusCode;
  }
}

function getOtpTtlMs() {
  const parsed = Number(process.env.OTP_TTL_MS);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_OTP_TTL_MS;
}

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function getOtpMode() {
  const requestedProvider = String(process.env.OTP_PROVIDER || "demo").trim().toLowerCase();
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const emailFrom = String(process.env.OTP_EMAIL_FROM || process.env.SMTP_FROM || "").trim();
  const gmailUser = String(process.env.GMAIL_USER || "").trim();
  const gmailPassword = String(process.env.GMAIL_PASSWORD || "").trim();
  const smtpHost = String(process.env.SMTP_HOST || "").trim();
  const smtpPort = Number(process.env.SMTP_PORT || "");
  const smtpSecure = String(process.env.SMTP_SECURE || "").trim().toLowerCase();
  const smtpUser = String(process.env.SMTP_USER || "").trim();
  const smtpPassword = String(process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "").trim();

  if (requestedProvider === "resend" && resendApiKey && emailFrom) {
    return {
      provider: "resend",
      delivery: "email",
      resendApiKey,
      emailFrom,
    };
  }

  if (requestedProvider === "gmail" && gmailUser && gmailPassword) {
    return {
      provider: "gmail",
      delivery: "email",
      emailFrom: emailFrom || gmailUser,
      transport: {
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPassword,
        },
      },
    };
  }

  if (requestedProvider === "smtp" && smtpHost && smtpPort && smtpUser && smtpPassword) {
    return {
      provider: "smtp",
      delivery: "email",
      emailFrom: emailFrom || smtpUser,
      transport: {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure === "1" || smtpSecure === "true" || smtpSecure === "yes" || smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      },
    };
  }

  return {
    provider: "demo",
    delivery: "email",
  };
}

function shouldExposeDemoOtp(forceExposeOtp = false) {
  if (forceExposeOtp) return true;
  if (isProductionEnvironment()) return false;
  const flag = String(process.env.EXPOSE_DEMO_OTP || process.env.ALLOW_DEMO_OTP_IN_PRODUCTION || "")
    .trim()
    .toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function shouldFallbackToDemoOnError() {
  if (isProductionEnvironment()) return false;
  const flag = String(process.env.OTP_FALLBACK_TO_DEMO_ON_ERROR || "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

function buildOtpResponse({ message, provider, delivery, otpCode, email, forceExposeOtp = false }) {
  const response = {
    msg: message,
    provider,
    delivery,
    expiresInSec: Math.round(getOtpTtlMs() / 1000),
    destinationHint: maskEmail(email),
  };

  if (provider === "demo" && shouldExposeDemoOtp(forceExposeOtp)) {
    response.devOtp = otpCode;
  }

  return response;
}

function cleanupOtp(email) {
  const key = normalizeEmail(email);
  const existing = otpStore.get(key);
  if (existing?.timeout) {
    clearTimeout(existing.timeout);
  }
  otpStore.delete(key);
}

function createOtpSession({ email, mode, name = "" }) {
  const key = normalizeEmail(email);
  cleanupOtp(key);

  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const ttlMs = getOtpTtlMs();
  const expiresAt = Date.now() + ttlMs;
  const timeout = setTimeout(() => cleanupOtp(key), ttlMs);

  otpStore.set(key, {
    otpCode,
    expiresAt,
    mode,
    name,
    timeout,
  });

  return otpCode;
}

function postJsonRequest({ hostname, path, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const serializedBody = JSON.stringify(body);
    const request = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(serializedBody),
          ...headers,
        },
      },
      (response) => {
        let responseBody = "";

        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          let parsed = {};
          try {
            parsed = responseBody ? JSON.parse(responseBody) : {};
          } catch {
            parsed = { raw: responseBody };
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }

          reject(new OtpError(parsed.message || "Email OTP request failed", response.statusCode || 502));
        });
      }
    );

    request.setTimeout(15000, () => {
      request.destroy(new OtpError("Email OTP request timed out", 504));
    });

    request.on("error", (error) => {
      reject(error instanceof OtpError ? error : new OtpError(error.message || "Email OTP failed", 502));
    });

    request.write(serializedBody);
    request.end();
  });
}

async function sendResendEmail({ email, otpCode, mode }) {
  const config = getOtpMode();
  const actionLabel = mode === "signup" ? "account verification" : "login";

  await postJsonRequest({
    hostname: "api.resend.com",
    path: "/emails",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
    },
    body: {
      from: config.emailFrom,
      to: [email],
      subject: "Your Real Chat Time OTP",
      text: `Your Real Chat Time ${actionLabel} code is ${otpCode}. It expires in ${Math.round(getOtpTtlMs() / 60000)} minutes.`,
    },
  });
}

async function sendNodemailerEmail({ email, otpCode, mode }) {
  const config = getOtpMode();
  const actionLabel = mode === "signup" ? "account verification" : "login";
  const transporter = nodemailer.createTransport(config.transport);

  await transporter.sendMail({
    from: config.emailFrom,
    to: email,
    subject: "Your Chatify OTP",
    text: `Your Chatify ${actionLabel} code is ${otpCode}. It expires in ${Math.round(getOtpTtlMs() / 60000)} minutes.`,
  });
}

async function requestOtpCode({ email, mode, name = "" }) {
  const normalizedEmail = normalizeEmail(email);
  const otpCode = createOtpSession({ email: normalizedEmail, mode, name });
  const config = getOtpMode();
  const canExposeDemoOtp = shouldExposeDemoOtp();

  try {
    if (config.provider === "resend") {
      await sendResendEmail({ email: normalizedEmail, otpCode, mode });
      return buildOtpResponse({
        message: "OTP sent successfully",
        provider: config.provider,
        delivery: config.delivery,
        email: normalizedEmail,
      });
    }

    if (config.provider === "gmail" || config.provider === "smtp") {
      await sendNodemailerEmail({ email: normalizedEmail, otpCode, mode });
      return buildOtpResponse({
        message: "OTP sent successfully",
        provider: config.provider,
        delivery: config.delivery,
        email: normalizedEmail,
      });
    }

    if (!canExposeDemoOtp) {
      cleanupOtp(normalizedEmail);
      throw new OtpError("Email OTP service is unavailable right now. Please try again later.", 503);
    }

    return buildOtpResponse({
      message: "Demo OTP generated successfully",
      provider: config.provider,
      delivery: config.delivery,
      otpCode,
      email: normalizedEmail,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error || "Unknown error");
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[otp] delivery failed", {
      provider: config.provider,
      delivery: config.delivery,
      destinationHint: maskEmail(normalizedEmail),
      message: errorMessage,
      stack: errorStack,
    });

    if (config.provider !== "demo" && shouldFallbackToDemoOnError() && canExposeDemoOtp) {
      return buildOtpResponse({
        message: "Email provider unavailable right now. Demo OTP generated successfully.",
        provider: "demo",
        delivery: "email",
        otpCode,
        email: normalizedEmail,
      });
    }

    cleanupOtp(normalizedEmail);
    if (error instanceof OtpError || error?.statusCode) {
      throw error;
    }
    throw new OtpError("Email OTP service is unavailable right now. Please try again later.", 503);
  }
}

async function verifyOtpCode({ email, otp, mode }) {
  const normalizedEmail = normalizeEmail(email);
  const session = otpStore.get(normalizedEmail);

  if (!session || session.mode !== mode) {
    throw new OtpError("OTP session expired. Request a new OTP.");
  }

  if (session.expiresAt < Date.now()) {
    cleanupOtp(normalizedEmail);
    throw new OtpError("OTP expired. Request a new OTP.");
  }

  if (session.otpCode !== String(otp || "").trim()) {
    throw new OtpError("Incorrect OTP");
  }

  cleanupOtp(normalizedEmail);
}

module.exports = {
  OtpError,
  getOtpMode,
  getOtpTtlMs,
  requestOtpCode,
  verifyOtpCode,
};
