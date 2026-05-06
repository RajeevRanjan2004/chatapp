import React, { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { formatMessageTime, isSameDay } from "../utils/formatters";

function renderMessageBody(message, isOwnMessage) {
  if (message.deletedForEveryone) {
    return <p className="text-sm italic opacity-80">This message was deleted</p>;
  }

  if (message.messageType === "image" && message.mediaUrl) {
    return (
      <div className="space-y-3">
        <img
          src={message.mediaUrl}
          alt={message.mediaName || "Shared image"}
          className="max-h-[320px] w-full rounded-[18px] object-cover shadow-[0_14px_28px_rgba(15,23,42,0.18)]"
        />
        {message.message && message.message !== message.mediaName ? (
          <p className="break-words text-sm leading-6">{message.message}</p>
        ) : null}
      </div>
    );
  }

  if (message.messageType === "audio" && message.mediaUrl) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium">{message.mediaName || "Voice note"}</p>
        <audio controls src={message.mediaUrl} className="w-full min-w-[220px]" />
      </div>
    );
  }

  if (message.messageType === "file" && message.mediaUrl) {
    return (
      <a
        href={message.mediaUrl}
        download={message.mediaName || "file"}
        target="_blank"
        rel="noreferrer"
        className={`block rounded-[18px] border px-4 py-3 text-sm transition ${
          isOwnMessage
            ? "border-white/20 bg-white/10 text-white hover:bg-white/14"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {message.mediaName || "Download file"}
      </a>
    );
  }

  return <p className="break-words text-sm leading-6">{message.message}</p>;
}

export default function ChatWindow({
  messages,
  currentUserId,
  loading,
  selectedUser,
  isTyping,
  onDeleteForMe,
  onDeleteForEveryone,
}) {
  const endRef = useRef(null);
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    setOpenMessageMenuId(null);
  }, [selectedUser?._id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 text-center backdrop-blur-xl">
          <p className="text-base font-semibold text-white">Loading conversation</p>
          <p className="mt-2 text-sm text-slate-300">Pulling the latest messages for this chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-surface soft-scrollbar flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="max-w-sm rounded-[32px] border border-white/10 bg-white/6 px-8 py-8 text-center backdrop-blur-xl">
              <p className="text-lg font-semibold text-white">Say hello to {selectedUser?.name}.</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Start with a quick text, a voice note, or share a photo to break the ice.
              </p>
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const isOwnMessage = message.senderId === currentUserId;
          const showDayDivider =
            index === 0 ||
            !isSameDay(
              message.createdAt || message.timestamp,
              messages[index - 1]?.createdAt || messages[index - 1]?.timestamp
            );

          return (
            <React.Fragment key={message._id || `${message.senderId}-${message.createdAt}-${index}`}>
              {showDayDivider ? (
                <div className="my-2 flex justify-center">
                  <span className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-300 backdrop-blur-xl">
                    {new Date(message.createdAt || message.timestamp).toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ) : null}

              <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex max-w-[92%] items-end gap-3 lg:max-w-[78%] ${
                    isOwnMessage ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {!isOwnMessage ? <Avatar user={selectedUser} size="sm" showStatus={false} /> : null}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMessageMenuId((current) => (current === message._id ? null : message._id))
                      }
                      className={`absolute top-2 z-10 rounded-full p-1.5 transition ${
                        isOwnMessage
                          ? "-left-9 text-white/80 hover:bg-white/10 hover:text-white"
                          : "-right-9 text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon name="menu" className="h-4 w-4" />
                    </button>

                    {openMessageMenuId === message._id ? (
                      <div
                        className={`absolute top-10 z-20 w-52 rounded-[20px] border border-white/10 bg-slate-950/95 p-2 text-sm text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${
                          isOwnMessage ? "-left-44" : "-right-44"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMessageMenuId(null);
                            onDeleteForMe?.(message);
                          }}
                          className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left transition hover:bg-white/10"
                        >
                          <Icon name="delete" className="h-4 w-4" />
                          Delete for me
                        </button>

                        {isOwnMessage && !message.deletedForEveryone ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMessageMenuId(null);
                              onDeleteForEveryone?.(message);
                            }}
                            className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left text-rose-300 transition hover:bg-white/10"
                          >
                            <Icon name="block" className="h-4 w-4" />
                            Delete for everyone
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    <div
                      className={`rounded-[24px] px-4 py-3 shadow-[0_18px_38px_rgba(0,0,0,0.14)] ${
                        isOwnMessage
                          ? "rounded-br-[8px] bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-400 text-slate-950"
                          : "rounded-bl-[8px] bg-white text-slate-700"
                      }`}
                    >
                      {renderMessageBody(message, isOwnMessage)}
                      <div
                        className={`mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] ${
                          isOwnMessage ? "text-slate-950/70" : "text-slate-400"
                        }`}
                      >
                        <span>{formatMessageTime(message.createdAt || message.timestamp)}</span>
                        {message.deletedForEveryone ? <span>Deleted</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {isTyping ? (
          <div className="flex justify-start">
            <div className="flex items-end gap-3">
              <Avatar user={selectedUser} size="sm" showStatus={false} />
              <div className="rounded-[24px] rounded-bl-[8px] bg-white px-4 py-3 shadow-[0_18px_38px_rgba(0,0,0,0.14)]">
                <div className="flex gap-1">
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400" />
                  <span
                    className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <span
                    className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>
    </div>
  );
}
