import React from "react";

export default function Avatar({ user, size = "md", showStatus = true }) {
  const sizeClasses = {
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-16 w-16 text-xl",
    xl: "h-24 w-24 text-3xl",
  };

  const dotClasses = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-4 w-4",
    xl: "h-4 w-4",
  };

  const palettes = [
    "from-sky-500 via-cyan-400 to-emerald-400",
    "from-emerald-500 via-teal-400 to-cyan-400",
    "from-indigo-500 via-sky-500 to-cyan-400",
    "from-orange-500 via-amber-400 to-yellow-300",
    "from-fuchsia-500 via-rose-400 to-orange-300",
    "from-violet-500 via-indigo-400 to-sky-300",
  ];

  const getInitials = (name) =>
    name
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "RT";

  const getPalette = (name = "") => {
    let hash = 0;
    for (let index = 0; index < name.length; index += 1) {
      hash = name.charCodeAt(index) + ((hash << 5) - hash);
      hash |= 0;
    }
    return palettes[Math.abs(hash) % palettes.length];
  };

  return (
    <div
      className={`relative ${sizeClasses[size]} shrink-0 overflow-hidden rounded-[22px] bg-gradient-to-br ${getPalette(
        user?.name
      )} flex items-center justify-center font-semibold text-white shadow-[0_12px_30px_rgba(14,165,233,0.22)] ring-1 ring-white/25`}
    >
      {user?.profilePic ? (
        <img src={user.profilePic} alt={user?.name || "Avatar"} className="h-full w-full object-cover" />
      ) : (
        <span>{getInitials(user?.name)}</span>
      )}

      {showStatus && user?.isOnline ? (
        <span
          className={`absolute bottom-0 right-0 ${dotClasses[size]} rounded-full border-2 border-white bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]`}
        />
      ) : null}
    </div>
  );
}
