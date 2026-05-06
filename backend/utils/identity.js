function getDefaultCountryCode() {
  const configured = String(process.env.OTP_DEFAULT_COUNTRY_CODE || "+91").trim();
  const digits = configured.replace(/\D/g, "");
  return digits ? `+${digits}` : "+91";
}

function buildInternalEmail(phoneNumber) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) return undefined;
  return `phone.${normalizedPhone}@internal.local`;
}

function buildInternalPhone(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return undefined;
  return `email:${normalizedEmail}`;
}

function normalizePhoneNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

function getPhoneNumberVariants(value) {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return [];

  const variants = new Set([normalized, `+${normalized}`]);
  const defaultCountryDigits = getDefaultCountryCode().replace(/\D/g, "");

  if (normalized.length === 10 && defaultCountryDigits) {
    variants.add(`${defaultCountryDigits}${normalized}`);
    variants.add(`+${defaultCountryDigits}${normalized}`);
  }

  if (defaultCountryDigits && normalized.startsWith(defaultCountryDigits)) {
    const localNumber = normalized.slice(defaultCountryDigits.length);
    if (localNumber.length >= 10) {
      variants.add(localNumber);
      variants.add(`+${localNumber}`);
    }
  }

  return [...variants];
}

function formatPhoneNumberForOtp(value) {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return "";

  const defaultCountryDigits = getDefaultCountryCode().replace(/\D/g, "");
  if (normalized.length === 10 && defaultCountryDigits) {
    return `+${defaultCountryDigits}${normalized}`;
  }

  return `+${normalized}`;
}

function isValidPhoneNumber(value) {
  const normalized = normalizePhoneNumber(value);
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function looksLikeEmail(value) {
  return /\S+@\S+\.\S+/.test(normalizeEmail(value));
}

function maskEmail(value) {
  const normalized = normalizeEmail(value);
  if (!looksLikeEmail(normalized)) return "";

  const [localPart, domain] = normalized.split("@");
  const visibleStart = localPart.slice(0, 2);
  const visibleEnd = localPart.length > 2 ? localPart.slice(-1) : "";
  const hiddenLength = Math.max(1, localPart.length - visibleStart.length - visibleEnd.length);
  return `${visibleStart}${"*".repeat(hiddenLength)}${visibleEnd}@${domain}`;
}

function isInternalEmail(value) {
  return /@internal\.local$/i.test(normalizeEmail(value));
}

function isInternalPhoneNumber(value) {
  return String(value || "").trim().toLowerCase().startsWith("email:");
}

function sanitizeUser(user) {
  if (!user) return user;
  const plain = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete plain.password;
  if (isInternalEmail(plain.email)) {
    delete plain.email;
  }
  if (isInternalPhoneNumber(plain.phoneNumber)) {
    delete plain.phoneNumber;
  }
  return plain;
}

module.exports = {
  buildInternalEmail,
  buildInternalPhone,
  formatPhoneNumberForOtp,
  getDefaultCountryCode,
  getPhoneNumberVariants,
  isInternalEmail,
  isInternalPhoneNumber,
  maskEmail,
  normalizeEmail,
  normalizePhoneNumber,
  isValidPhoneNumber,
  looksLikeEmail,
  sanitizeUser,
};
