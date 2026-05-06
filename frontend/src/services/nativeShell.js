import { isNativeApp } from "../utils/platform";

const EXIT_BACK_INTERVAL_MS = 1800;
const PENDING_CHAT_USER_KEY = "rtc_pending_chat_user";

let appModulePromise = null;
let localNotificationsPromise = null;
let bridgeReady = false;
let appIsActive = typeof document === "undefined" ? true : document.visibilityState === "visible";
let currentBackHandler = null;
let currentNotificationTapHandler = null;
let lastBackPressAt = 0;

function emitShellEvent(name, detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function buildNotificationBody({ messageType, message, mediaName }) {
  if (messageType === "image") {
    return message && message !== mediaName ? `Photo: ${message}` : "Photo received";
  }

  if (messageType === "audio") {
    return mediaName ? `Voice note: ${mediaName}` : "Voice note received";
  }

  if (messageType === "file") {
    return mediaName ? `File: ${mediaName}` : "File received";
  }

  return message || "New message";
}

async function getAppPlugin() {
  if (appModulePromise) return appModulePromise;

  appModulePromise = (async () => {
    try {
      const module = await import("@capacitor/app");
      return module.App || null;
    } catch {
      return null;
    }
  })();

  return appModulePromise;
}

async function getLocalNotificationsPlugin() {
  if (localNotificationsPromise) return localNotificationsPromise;

  localNotificationsPromise = (async () => {
    try {
      const module = await import("@capacitor/local-notifications");
      return module.LocalNotifications || null;
    } catch {
      return null;
    }
  })();

  return localNotificationsPromise;
}

export function isAppForeground() {
  if (typeof document === "undefined") return appIsActive;
  return appIsActive && document.visibilityState === "visible";
}

export function setNativeBackHandler(handler) {
  currentBackHandler = handler;

  return () => {
    if (currentBackHandler === handler) {
      currentBackHandler = null;
    }
  };
}

export function setNotificationTapHandler(handler) {
  currentNotificationTapHandler = handler;

  return () => {
    if (currentNotificationTapHandler === handler) {
      currentNotificationTapHandler = null;
    }
  };
}

export function consumePendingChatUserId() {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(PENDING_CHAT_USER_KEY) || "";
  if (stored) {
    localStorage.removeItem(PENDING_CHAT_USER_KEY);
  }
  return stored;
}

export async function initializeNativeShell() {
  if (bridgeReady) return;
  bridgeReady = true;

  if (typeof document !== "undefined") {
    const handleVisibility = () => {
      appIsActive = document.visibilityState === "visible";
    };

    document.addEventListener("visibilitychange", handleVisibility);
  }

  const App = await getAppPlugin();
  if (App) {
    await App.addListener("appStateChange", ({ isActive }) => {
      appIsActive = Boolean(isActive);
    });

    await App.addListener("backButton", async () => {
      const handled = await currentBackHandler?.();
      if (handled) return;

      const now = Date.now();
      if (now - lastBackPressAt < EXIT_BACK_INTERVAL_MS) {
        await App.exitApp();
        return;
      }

      lastBackPressAt = now;
      emitShellEvent("native-shell:back-hint", {
        message: "Press back again to exit",
      });
    });
  }

  const LocalNotifications = await getLocalNotificationsPlugin();
  if (LocalNotifications) {
    await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const senderId = String(event.notification?.extra?.senderId || "");
      if (senderId && typeof window !== "undefined") {
        localStorage.setItem(PENDING_CHAT_USER_KEY, senderId);
      }

      currentNotificationTapHandler?.(senderId, event.notification?.extra || {});
      emitShellEvent("native-shell:notification-tap", {
        senderId,
        extra: event.notification?.extra || {},
      });
    });
  }
}

export async function requestNativeNotificationPermission() {
  const LocalNotifications = await getLocalNotificationsPlugin();
  if (LocalNotifications) {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return "granted";

    const requested = await LocalNotifications.requestPermissions();
    return requested.display;
  }

  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

export async function showIncomingMessageNotification({
  senderId,
  senderName,
  messageType,
  message,
  mediaName,
}) {
  if (isAppForeground()) return false;

  const title = senderName || "New message";
  const body = buildNotificationBody({ messageType, message, mediaName });

  if (isNativeApp()) {
    const LocalNotifications = await getLocalNotificationsPlugin();
    if (!LocalNotifications) return false;

    const permission = await requestNativeNotificationPermission();
    if (permission !== "granted") return false;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2147483000),
          title,
          body,
          smallIcon: "ic_stat_notify",
          iconColor: "#14b8a6",
          extra: { senderId },
        },
      ],
    });

    return true;
  }

  if (typeof Notification !== "undefined") {
    const permission = await requestNativeNotificationPermission();
    if (permission !== "granted") return false;

    new Notification(title, {
      body,
      tag: senderId ? `chat-${senderId}` : "chat-message",
      data: { senderId },
    });
    return true;
  }

  return false;
}

export function installViewportMetrics() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const root = document.documentElement;
  let stableHeight = window.innerHeight;
  const visualViewport = window.visualViewport;

  const updateMetrics = () => {
    const viewportHeight = visualViewport?.height || window.innerHeight;
    const viewportOffsetTop = visualViewport?.offsetTop || 0;

    if (viewportHeight + viewportOffsetTop >= stableHeight - 32) {
      stableHeight = Math.max(stableHeight, viewportHeight + viewportOffsetTop, window.innerHeight);
    }

    const keyboardOffset = Math.max(0, stableHeight - viewportHeight - viewportOffsetTop);
    root.style.setProperty("--app-height", `${window.innerHeight}px`);
    root.style.setProperty("--keyboard-offset", `${keyboardOffset}px`);
    root.classList.toggle("keyboard-open", keyboardOffset > 120);
  };

  const handleOrientation = () => {
    stableHeight = window.innerHeight;
    updateMetrics();
  };

  updateMetrics();

  window.addEventListener("resize", updateMetrics);
  window.addEventListener("orientationchange", handleOrientation);
  visualViewport?.addEventListener("resize", updateMetrics);
  visualViewport?.addEventListener("scroll", updateMetrics);

  return () => {
    window.removeEventListener("resize", updateMetrics);
    window.removeEventListener("orientationchange", handleOrientation);
    visualViewport?.removeEventListener("resize", updateMetrics);
    visualViewport?.removeEventListener("scroll", updateMetrics);
  };
}
