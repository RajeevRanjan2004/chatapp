import React from "react";

const icons = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  menu: (
    <>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.07.07a2 2 0 0 1-2.83 2.83l-.07-.07a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.64V22a2 2 0 0 1-4 0v-.1a1.8 1.8 0 0 0-1.1-1.64 1.8 1.8 0 0 0-1.97.36l-.08.07a2 2 0 0 1-2.82-2.83l.07-.07A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.64-1.1H2.9a2 2 0 0 1 0-4H3a1.8 1.8 0 0 0 1.64-1.1 1.8 1.8 0 0 0-.36-1.97l-.07-.08a2 2 0 0 1 2.83-2.82l.07.07a1.8 1.8 0 0 0 1.98.36H9.2A1.8 1.8 0 0 0 10.3 2.1V2a2 2 0 0 1 4 0v.1a1.8 1.8 0 0 0 1.09 1.64 1.8 1.8 0 0 0 1.98-.36l.07-.07a2 2 0 0 1 2.83 2.83l-.07.07A1.8 1.8 0 0 0 19.4 9c.67.27 1.1.92 1.1 1.64V11a2 2 0 0 1 0 2h-.1A1.8 1.8 0 0 0 19.4 15Z" />
    </>
  ),
  chat: (
    <>
      <path d="M5 18l-1 3 3-1h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7A3 3 0 0 0 4 7v8a3 3 0 0 0 1 2.23Z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </>
  ),
  phone: (
    <>
      <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.3 19.3 0 0 1-6-6A19.8 19.8 0 0 1 2.1 3.18 2 2 0 0 1 4.09 1h2a2 2 0 0 1 2 1.72c.12.9.35 1.79.68 2.63a2 2 0 0 1-.45 2.11L7.1 8.68a16 16 0 0 0 8.22 8.22l1.22-1.22a2 2 0 0 1 2.11-.45c.84.33 1.73.56 2.63.68A2 2 0 0 1 22 16.92Z" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M20 4v16" />
    </>
  ),
  status: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="M21 15l-4.5-4.5L7 20" />
    </>
  ),
  audio: (
    <>
      <path d="M12 3v11" />
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M6 10a6 6 0 0 0 12 0" />
      <path d="M12 20v2" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  send: (
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7Z" />
    </>
  ),
  back: (
    <>
      <path d="M15 18l-6-6 6-6" />
      <path d="M21 12H9" />
    </>
  ),
  block: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l8 8" />
    </>
  ),
  delete: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  mute: (
    <>
      <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M19 6a8 8 0 0 1 0 12" />
    </>
  ),
  unmute: (
    <>
      <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
      <path d="M21 9l-6 6" />
      <path d="M15 9l6 6" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  user: (
    <>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  storage: (
    <>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v6c0 1.66 3.13 3 7 3s7-1.34 7-3V5" />
      <path d="M5 11v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h4l2-2h4l2 2h4v12H4Z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  spark: (
    <>
      <path d="M12 2l1.7 4.3L18 8l-4.3 1.7L12 14l-1.7-4.3L6 8l4.3-1.7Z" />
      <path d="M5 16l.9 2.1L8 19l-2.1.9L5 22l-.9-2.1L2 19l2.1-.9Z" />
      <path d="M19 14l.8 1.7L21.5 16l-1.7.8L19 18.5l-.8-1.7-1.7-.8 1.7-.8Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.5" r=".6" fill="currentColor" stroke="none" />
    </>
  ),
};

export default function Icon({ name, className = "h-5 w-5", strokeWidth = 1.75 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {icons[name] || icons.info}
    </svg>
  );
}
