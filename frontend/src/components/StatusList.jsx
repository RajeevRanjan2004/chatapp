import React from "react";
import Avatar from "./Avatar";
import { formatLongDateTime, formatRelativeTime } from "../utils/formatters";

function getRemainingLabel(status) {
  const expiresAt = status.expiresAt ? new Date(status.expiresAt) : new Date(new Date(status.createdAt).getTime() + 24 * 60 * 60 * 1000);
  const diffMs = expiresAt.getTime() - Date.now();
  const diffHours = Math.max(0, Math.ceil(diffMs / (60 * 60 * 1000)));
  return `${diffHours}h left`;
}

function StatusCard({ status, owner, highlight }) {
  return (
    <article
      className={`overflow-hidden rounded-[28px] border bg-white shadow-sm transition hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)] ${
        highlight ? "border-emerald-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar user={owner} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{owner.name}</p>
            <p className="text-xs text-slate-400">{formatRelativeTime(status.createdAt)}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {status.mediaType}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-600">
            {getRemainingLabel(status)}
          </span>
        </div>
      </div>

      {status.mediaType === "image" && status.mediaUrl ? (
        <img src={status.mediaUrl} alt={status.text || "Status"} className="max-h-[320px] w-full object-cover" />
      ) : null}

      <div className="space-y-3 px-4 py-4">
        <p className="text-sm leading-6 text-slate-600">{status.text || "No caption added."}</p>
        <p className="text-xs text-slate-400">{formatLongDateTime(status.createdAt)}</p>
      </div>
    </article>
  );
}

export default function StatusList({ statuses, usersById, currentUserId }) {
  const ownStatuses = statuses.filter((status) => status.userId === currentUserId);
  const contactStatuses = statuses.filter((status) => status.userId !== currentUserId);

  if (!statuses.length) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm text-slate-500">
        No status updates yet. Share a quick thought or photo to make this section feel alive.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">My status</h3>
          <span className="text-xs text-slate-400">{ownStatuses.length} updates</span>
        </div>

        {ownStatuses.length ? (
          ownStatuses.map((status) => (
            <StatusCard
              key={status._id}
              status={status}
              owner={usersById[status.userId] || { name: "You" }}
              highlight
            />
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-5 text-sm text-slate-500">
            You have not posted a 24-hour status yet.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Recent updates</h3>
          <span className="text-xs text-slate-400">{contactStatuses.length} updates</span>
        </div>

        {contactStatuses.length ? (
          contactStatuses.map((status) => (
            <StatusCard
              key={status._id}
              status={status}
              owner={usersById[status.userId] || { name: "Unknown" }}
            />
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-5 text-sm text-slate-500">
            Your contacts have not shared any fresh status yet.
          </div>
        )}
      </section>
    </div>
  );
}
