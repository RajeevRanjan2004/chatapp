export const DEFAULT_CHAT_SETTINGS = {
  notifyMessages: true,
  notifySound: true,
  notifyPreview: true,
  privacyLastSeen: "all",
  privacyTypingIndicators: true,
  autoDownload: true,
  enterToSend: true,
};

export function readChatSettings() {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CHAT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(localStorage.getItem("chatSettings") || "{}");
    return { ...DEFAULT_CHAT_SETTINGS, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_CHAT_SETTINGS };
  }
}

export function writeChatSettings(nextSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem("chatSettings", JSON.stringify({ ...DEFAULT_CHAT_SETTINGS, ...nextSettings }));
}

export function isEnterToSendEnabled() {
  return readChatSettings().enterToSend !== false;
}
