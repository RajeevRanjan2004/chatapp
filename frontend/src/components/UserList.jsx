import React from "react";
import Avatar from "./Avatar";
import { formatRelativeTime, getMessagePreview } from "../utils/formatters";

export default function UserList({ users, selectedUser, onSelectUser }) {
  if (!users.length) {
    return (
      <div className="flex min-h-[260px] items-center justify-center px-6 py-10 text-center">
        <div className="max-w-xs">
          <p className="text-base font-semibold text-slate-800">No conversations match this view.</p>
          <p className="mt-2 text-sm text-slate-500">
            Try a different search term or switch the filter to see more people.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((item) => {
        const isSelected = selectedUser?._id === item._id;

        return (
          <button
            key={item._id}
            type="button"
            onClick={() => onSelectUser(item)}
            className={`group w-full rounded-[24px] border px-3 py-3 text-left transition duration-200 ${
              isSelected
                ? "border-sky-200 bg-sky-50/90 shadow-[0_12px_30px_rgba(14,165,233,0.12)]"
                : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <Avatar user={item} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-slate-400">
                      {item.email || item.phoneNumber || (item.isOnline ? "Active now" : "Offline")}
                    </p>
                  </div>

                  <span className="whitespace-nowrap text-xs text-slate-400">
                    {item.lastMessageAt ? formatRelativeTime(item.lastMessageAt) : "New"}
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-slate-500">{getMessagePreview(item)}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
