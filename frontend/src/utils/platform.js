import { Capacitor } from "@capacitor/core";

const RESOLVED_API_BASE_URL_KEY = "rtc_api_base_url";
const RESOLVED_SOCKET_BASE_URL_KEY = "rtc_socket_base_url";
const PRODUCTION_API_FALLBACK_URL = "https://real-chat-time-web-production.up.railway.app/api";

export function getPlatform() {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}

export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isAndroidApp() {
  return getPlatform() === "android";
}

function getWebHost() {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname;
  }
  return "localhost";
}

function getWebOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return `http://${getWebHost()}`;
}

function normalizeUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.replace(/\/+$/, "");
}

function uniqueUrls(values) {
  return [...new Set(values.map(normalizeUrl).filter(Boolean))];
}

function readStoredUrl(key) {
  if (typeof window === "undefined") return "";
  return normalizeUrl(localStorage.getItem(key) || "");
}

export function deriveSocketBaseUrl(apiBaseUrl) {
  const normalized = normalizeUrl(apiBaseUrl);
  if (!normalized) return "";
  return normalized.replace(/\/api$/i, "");
}

export function rememberResolvedApiBaseUrl(apiBaseUrl) {
  if (typeof window === "undefined") return;

  const normalizedApiBaseUrl = normalizeUrl(apiBaseUrl);
  if (!normalizedApiBaseUrl) return;

  localStorage.setItem(RESOLVED_API_BASE_URL_KEY, normalizedApiBaseUrl);
  localStorage.setItem(RESOLVED_SOCKET_BASE_URL_KEY, deriveSocketBaseUrl(normalizedApiBaseUrl));
}

export function clearResolvedApiBaseUrl() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RESOLVED_API_BASE_URL_KEY);
  localStorage.removeItem(RESOLVED_SOCKET_BASE_URL_KEY);
}

export function getApiBaseUrlCandidates() {
  const configuredApiUrl = normalizeUrl(import.meta.env.VITE_API_URL);
  const configuredFallbackApiUrl = normalizeUrl(import.meta.env.VITE_API_FALLBACK_URL);
  const storedApiUrl = readStoredUrl(RESOLVED_API_BASE_URL_KEY);
  const candidates = [storedApiUrl, configuredApiUrl, configuredFallbackApiUrl];

  if (import.meta.env.DEV) {
    candidates.push("/api");
  }

  if (!isNativeApp()) {
    candidates.push(`${getWebOrigin()}/api`);
  }

  if (isAndroidApp()) {
    candidates.push("http://10.0.2.2:5000/api");
  }

  candidates.push(PRODUCTION_API_FALLBACK_URL);

  return uniqueUrls(candidates);
}

export function getApiBaseUrl() {
  return getApiBaseUrlCandidates()[0] || `${getWebOrigin()}/api`;
}

export function getSocketBaseUrl() {
  const storedSocketUrl = readStoredUrl(RESOLVED_SOCKET_BASE_URL_KEY);
  const configuredSocketUrl = normalizeUrl(import.meta.env.VITE_SOCKET_URL);
  const configuredFallbackSocketUrl = normalizeUrl(import.meta.env.VITE_SOCKET_FALLBACK_URL);

  if (storedSocketUrl) return storedSocketUrl;
  if (configuredSocketUrl) return configuredSocketUrl;
  if (configuredFallbackSocketUrl) return configuredFallbackSocketUrl;
  if (isAndroidApp()) return "http://10.0.2.2:5000";
  return deriveSocketBaseUrl(getApiBaseUrl()) || getWebOrigin();
}

export function applyPlatformClasses() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const native = isNativeApp();
  const android = isAndroidApp();

  root.classList.toggle("native-shell", native);
  root.classList.toggle("android-shell", android);
  root.dataset.platform = getPlatform();
}
