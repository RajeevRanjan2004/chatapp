import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { userService } from "../services/api";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { formatLastSeen, formatLongDateTime } from "../utils/formatters";
import { isAndroidApp } from "../utils/platform";

export default function ProfileModal({ user, onClose, onUpdate }) {
  const { user: currentUser } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || "");
  const [profilePic, setProfilePic] = useState(user?.profilePic || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const androidApp = isAndroidApp();

  const isOwnProfile = currentUser?._id === user?._id;

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setPhoneNumber(user?.phoneNumber || "");
    setStatusMessage(user?.statusMessage || "");
    setProfilePic(user?.profilePic || "");
    setIsEditing(false);
    setError("");
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = String(email || "").trim().toLowerCase();

    if (!trimmedName) {
      setError("Name cannot be empty.");
      return;
    }

    if (isOwnProfile && !trimmedEmail) {
      setError("Email cannot be empty.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await userService.updateProfile(user._id, {
        name: trimmedName,
        email: trimmedEmail,
        phoneNumber,
        statusMessage,
        profilePic,
      });

      onUpdate(response.data.user);
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.msg || "Could not update the profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePic(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4">
      <div className="soft-panel safe-bottom-pad soft-scrollbar w-full max-w-4xl overflow-y-auto rounded-t-[34px] border border-white/40 p-5 text-slate-900 shadow-[0_35px_120px_rgba(0,0,0,0.35)] sm:max-h-[90dvh] sm:rounded-[34px] lg:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Profile</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {isOwnProfile ? "Your identity card" : `${user.name}'s profile`}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px,1fr]">
          <aside className="rounded-[30px] bg-[linear-gradient(160deg,#0f172a_0%,#13263e_55%,#1f4b5f_100%)] p-6 text-white">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar user={{ ...user, profilePic }} size="xl" />
                {isEditing && isOwnProfile ? (
                  <label className="absolute -bottom-2 -right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/18">
                    <Icon name="camera" className="h-5 w-5" />
                    <input
                      type="file"
                      accept="image/*"
                      capture={androidApp ? "environment" : undefined}
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                ) : null}
              </div>

              <h3 className="mt-5 text-2xl font-semibold">{name || user.name}</h3>
              <p className="mt-2 text-sm text-slate-200">{email || phoneNumber || "No contact info"}</p>
              <span className="mt-4 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-100">
                {user.isOnline ? "Online now" : "Offline"}
              </span>
            </div>

            <div className="mt-8 space-y-4 rounded-[26px] border border-white/10 bg-white/6 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Last activity</p>
                <p className="mt-2 text-sm text-white">{user.isOnline ? "Currently active" : formatLastSeen(user.lastSeen)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Joined</p>
                <p className="mt-2 text-sm text-white">{formatLongDateTime(user.createdAt)}</p>
              </div>
            </div>
          </aside>

          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Display name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={!isEditing || !isOwnProfile}
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={!isEditing || !isOwnProfile}
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Mobile number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  disabled={!isEditing || !isOwnProfile}
                  className="w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Status message</label>
                <textarea
                  value={statusMessage}
                  onChange={(event) => setStatusMessage(event.target.value)}
                  disabled={!isEditing || !isOwnProfile}
                  maxLength={139}
                  rows={5}
                  className="w-full resize-none rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Short, clear profiles feel best in chat previews.</span>
                  <span>{statusMessage.length}/139</span>
                </div>
              </div>

              {error ? (
                <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              {isOwnProfile ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-[20px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Icon name="edit" className="h-4 w-4" />
                        {loading ? "Saving..." : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setName(user?.name || "");
                          setEmail(user?.email || "");
                          setPhoneNumber(user?.phoneNumber || "");
                          setStatusMessage(user?.statusMessage || "");
                          setProfilePic(user?.profilePic || "");
                          setIsEditing(false);
                          setError("");
                        }}
                        className="inline-flex flex-1 items-center justify-center rounded-[20px] border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                      Edit profile
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
                  This profile is view-only for you. You can still open the chat and contact them directly.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
