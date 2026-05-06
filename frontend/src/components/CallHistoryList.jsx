import React from "react";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { formatDuration, formatLongDateTime, formatRelativeTime } from "../utils/formatters";

const statusStyles = {
  ended: "bg-slate-100 text-slate-600",
  answered: "bg-emerald-100 text-emerald-700",
  missed: "bg-rose-100 text-rose-700",
};

export default function CallHistoryList({ calls, usersById }) {
  if (!calls.length) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm text-slate-500">
        No calls yet. Once you start voice chats, they will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {calls.map((call) => {
        const otherId = call.callerId === call.currentUserId ? call.receiverId : call.callerId;
        const otherUser = usersById[otherId];
        const isOutgoing = call.callerId === call.currentUserId;

        return (
          <div
            key={call._id}
            className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-start gap-3">
              <Avatar user={otherUser || { name: "Unknown" }} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{otherUser?.name || "Unknown"}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                      {isOutgoing ? "Outgoing call" : "Incoming call"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${
                      statusStyles[call.status] || statusStyles.ended
                    }`}
                  >
                    {call.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                    <Icon name="phone" className="h-4 w-4" />
                    {call.type === "video" ? "Video" : "Voice"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{formatDuration(call.durationSec)}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{formatRelativeTime(call.createdAt)}</span>
                </div>

                <p className="mt-3 text-xs text-slate-400">{formatLongDateTime(call.createdAt)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
