const messageTimeFormatter = new Intl.DateTimeFormat([], {
  hour: "numeric",
  minute: "2-digit",
});

const dayStampFormatter = new Intl.DateTimeFormat([], {
  month: "short",
  day: "numeric",
});

const longDateTimeFormatter = new Intl.DateTimeFormat([], {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return messageTimeFormatter.format(date);
}

export function formatLongDateTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return longDateTimeFormatter.format(date);
}

export function formatRelativeTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return dayStampFormatter.format(date);
}

export function formatLastSeen(value) {
  if (!value) return "Last seen hidden";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last seen hidden";

  const today = new Date();
  const sameDay =
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate();

  if (sameDay) {
    return `Last seen today at ${messageTimeFormatter.format(date)}`;
  }

  return `Last seen ${longDateTimeFormatter.format(date)}`;
}

export function formatDuration(totalSeconds = 0) {
  if (!totalSeconds) return "0s";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function isSameDay(a, b) {
  if (!a || !b) return false;
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return false;

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function getMessagePreview(user) {
  if (user.lastMessageType === "image") return "Photo";
  if (user.lastMessageType === "audio") return "Voice note";
  if (user.lastMessageType === "file") return user.lastMediaName || "Shared file";
  if (user.lastMessage) return user.lastMessage;
  return user.statusMessage || "Start a new conversation";
}
