import React from "react";
import Icon from "./Icon";

export default function ChatOptions({ selectedUser, onBlockUser, onDeleteChat, onMuteChat, isMuted }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/6 p-3 backdrop-blur-xl">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Conversation controls</p>
          <p className="mt-1 text-xs text-slate-300">
            Manage alerts and safety settings for {selectedUser?.name || "this chat"}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onMuteChat(!isMuted)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              isMuted
                ? "bg-amber-300 text-amber-950 hover:bg-amber-200"
                : "bg-white/10 text-white hover:bg-white/16"
            }`}
          >
            <Icon name={isMuted ? "unmute" : "mute"} className="h-4 w-4" />
            {isMuted ? "Unmute" : "Mute"}
          </button>

          <button
            type="button"
            onClick={() => onBlockUser(selectedUser._id)}
            className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-200"
          >
            <Icon name="block" className="h-4 w-4" />
            Block
          </button>

          <button
            type="button"
            onClick={() => onDeleteChat(selectedUser._id)}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/16"
          >
            <Icon name="delete" className="h-4 w-4" />
            Delete chat
          </button>
        </div>
      </div>
    </div>
  );
}
