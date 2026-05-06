import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import SettingItem from "./SettingItem";
import { userService } from "../services/api";
import Icon from "./Icon";
import { DEFAULT_CHAT_SETTINGS, readChatSettings, writeChatSettings } from "../utils/chatSettings";

export default function SettingsModal({ onClose, onOpenProfile, blockedIds = [], onBlockedChange }) {
  const { user, logout, updateUser } = useContext(AuthContext);
  const [settings, setSettings] = useState(DEFAULT_CHAT_SETTINGS);
  const [knownUsers, setKnownUsers] = useState([]);

  useEffect(() => {
    const nextSettings = readChatSettings();
    if (localStorage.getItem("chatSettings")) {
      setSettings(nextSettings);
    } else if (user?.privacyLastSeen) {
      setSettings((prev) => ({ ...prev, privacyLastSeen: user.privacyLastSeen }));
    } else {
      setSettings(nextSettings);
    }
  }, [user?.privacyLastSeen]);

  useEffect(() => {
    const loadKnownUsers = async () => {
      if (!user?._id) return;

      try {
        const response = await userService.getAllUsers(user._id);
        setKnownUsers(response.data || []);
      } catch {
        setKnownUsers([]);
      }
    };

    loadKnownUsers();
  }, [user?._id]);

  const handleSettingChange = async (key, value) => {
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    writeChatSettings(updatedSettings);

    if (key === "privacyLastSeen") {
      try {
        const response = await userService.updateProfile(user._id, { privacyLastSeen: value });
        updateUser(response.data.user);
      } catch {
        // Keep local preference even if the backend update fails.
      }
    }
  };

  const handleClearPreferences = () => {
    localStorage.removeItem("chatSettings");
    setSettings({
      ...DEFAULT_CHAT_SETTINGS,
      privacyLastSeen: user?.privacyLastSeen || DEFAULT_CHAT_SETTINGS.privacyLastSeen,
    });
    alert("Local preferences were reset.");
  };

  const getLocalStorageUsage = () => {
    let bytes = 0;
    for (const key of Object.keys(localStorage)) {
      const value = localStorage.getItem(key) || "";
      bytes += key.length + value.length;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleUnblock = async (id) => {
    const nextBlocked = blockedIds.filter((currentId) => currentId !== id);
    onBlockedChange?.(nextBlocked);

    try {
      await userService.setUnblock(user._id, id);
    } catch {
      // Local state has already been updated so the UI stays responsive.
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm("Delete your account permanently? This cannot be undone.");
    if (!confirmed) return;

    try {
      await userService.deleteAccount(user._id);
      logout();
      onClose();
      alert("Account deleted.");
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to delete account.");
    }
  };

  const blockedUsers = blockedIds.map((id) => knownUsers.find((candidate) => candidate._id === id)).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4">
      <div className="soft-panel safe-bottom-pad soft-scrollbar w-full max-w-5xl overflow-y-auto rounded-t-[34px] border border-white/40 p-5 text-slate-900 shadow-[0_35px_120px_rgba(0,0,0,0.35)] sm:max-h-[90dvh] sm:rounded-[34px] lg:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Preferences</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Tune the chat space to your style</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="rounded-[30px] bg-[linear-gradient(160deg,#0f172a_0%,#13263e_55%,#173d54_100%)] p-6 text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-sky-100">
              <Icon name="settings" className="h-4 w-4" />
              Settings
            </div>
            <h3 className="mt-5 text-3xl font-semibold">Make the app feel like yours.</h3>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              These controls cover alerts, privacy, blocked contacts, and local app behavior.
            </p>

            <div className="mt-8 space-y-3">
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Signed in as</p>
                <p className="mt-2 text-lg font-semibold text-white">{user?.name}</p>
                <p className="mt-1 text-sm text-slate-300">{user?.email || user?.phoneNumber || "No email"}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Blocked contacts</p>
                <p className="mt-2 text-2xl font-semibold text-white">{blockedIds.length}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/6 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Local storage</p>
                <p className="mt-2 text-2xl font-semibold text-white">{getLocalStorageUsage()}</p>
              </div>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="grid gap-4">
              <SettingItem
                icon={<Icon name="user" className="h-5 w-5" />}
                title="Manage profile"
                description="Update your avatar, name, and short bio."
                type="arrow"
                onClick={() => {
                  onOpenProfile?.();
                  onClose();
                }}
              />

              <SettingItem
                icon={<Icon name="lock" className="h-5 w-5" />}
                title="Login method"
                description="This app now uses direct email OTP login instead of password or mobile OTP sign-in."
                type="info"
              />
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Experience</p>
              <div className="mt-4 grid gap-4">
                <SettingItem
                  icon={<Icon name="bell" className="h-5 w-5" />}
                  title="Message notifications"
                  description="Show alerts when new direct messages arrive, including Android local notifications."
                  value={settings.notifyMessages}
                  onChange={(value) => handleSettingChange("notifyMessages", value)}
                />
                <SettingItem
                  icon={<Icon name="audio" className="h-5 w-5" />}
                  title="Notification sound"
                  description="Play a sound whenever a fresh message lands."
                  value={settings.notifySound}
                  onChange={(value) => handleSettingChange("notifySound", value)}
                />
                <SettingItem
                  icon={<Icon name="chat" className="h-5 w-5" />}
                  title="Message preview"
                  description="Display a short preview in local notifications."
                  value={settings.notifyPreview}
                  onChange={(value) => handleSettingChange("notifyPreview", value)}
                />
                <SettingItem
                  icon={<Icon name="file" className="h-5 w-5" />}
                  title="Auto-download media"
                  description="Save shared media locally when supported."
                  value={settings.autoDownload}
                  onChange={(value) => handleSettingChange("autoDownload", value)}
                />
                <SettingItem
                  icon={<Icon name="send" className="h-5 w-5" />}
                  title="Enter to send"
                  description="Use the Enter key as a quick send shortcut."
                  value={settings.enterToSend}
                  onChange={(value) => handleSettingChange("enterToSend", value)}
                />
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Privacy</p>
              <div className="mt-4 grid gap-4">
                <SettingItem
                  icon={<Icon name="shield" className="h-5 w-5" />}
                  title="Last seen visibility"
                  description="Control whether other people can view your recent activity time."
                  type="select"
                  value={settings.privacyLastSeen}
                  onChange={(value) => handleSettingChange("privacyLastSeen", value)}
                  options={[
                    { value: "all", label: "Everyone" },
                    { value: "none", label: "Nobody" },
                  ]}
                />
                <SettingItem
                  icon={<Icon name="edit" className="h-5 w-5" />}
                  title="Typing indicators"
                  description="Share when you are composing a reply."
                  value={settings.privacyTypingIndicators}
                  onChange={(value) => handleSettingChange("privacyTypingIndicators", value)}
                />
              </div>

              <div className="mt-5 rounded-[26px] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Blocked contacts</p>
                    <p className="mt-1 text-sm text-slate-500">
                      People you block disappear from the chat list until you restore them.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {blockedIds.length}
                  </span>
                </div>

                {blockedIds.length === 0 ? (
                  <p className="mt-4 rounded-[20px] bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    No blocked contacts right now.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {blockedIds.map((id) => {
                      const person = blockedUsers.find((candidate) => candidate._id === id);
                      return (
                        <div
                          key={id}
                          className="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {person?.name || "Unknown contact"}
                            </p>
                            <p className="mt-1 truncate text-sm text-slate-500">
                              {person?.email || person?.phoneNumber || id}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnblock(id)}
                            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            Unblock
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4">
              <SettingItem
                icon={<Icon name="storage" className="h-5 w-5" />}
                title="Storage usage"
                description={`Current local storage usage is ${getLocalStorageUsage()}.`}
                type="arrow"
                onClick={() => alert(`Local storage usage: ${getLocalStorageUsage()}`)}
              />
              <SettingItem
                icon={<Icon name="reset" className="h-5 w-5" />}
                title="Reset local preferences"
                description="Clear saved UI settings from this device."
                type="arrow"
                onClick={handleClearPreferences}
              />
            </div>

            <SettingItem
              icon={<Icon name="delete" className="h-5 w-5" />}
              title="Delete account"
              description="Permanently remove your account and chat history from the app."
              type="arrow"
              onClick={handleDeleteAccount}
              danger
            />
          </section>
        </div>
      </div>
    </div>
  );
}
