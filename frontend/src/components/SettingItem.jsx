import React from "react";
import Icon from "./Icon";

const defaultOptions = [
  { value: "all", label: "Everyone" },
  { value: "none", label: "Nobody" },
];

export default function SettingItem({
  icon,
  title,
  description,
  value,
  onChange,
  type = "toggle",
  onClick,
  options = defaultOptions,
  danger = false,
}) {
  const clickable = type === "arrow" && onClick;

  return (
    <div
      className={`rounded-[24px] border px-4 py-4 transition ${
        danger
          ? "border-rose-200 bg-rose-50/80"
          : "border-slate-200 bg-white/85 hover:border-slate-300 hover:bg-white"
      } ${clickable ? "cursor-pointer" : ""}`}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-start gap-4">
        <div
          className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] ${
            danger ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-600"
          }`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-sm font-semibold ${danger ? "text-rose-700" : "text-slate-900"}`}>{title}</p>
              {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
            </div>

            {type === "toggle" ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange?.(!value);
                }}
                className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                  value ? "bg-slate-900" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    value ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            ) : null}

            {type === "select" ? (
              <select
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                className="mt-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-900"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}

            {type === "arrow" ? <Icon name="chevron" className="mt-1 h-5 w-5 shrink-0 text-slate-400" /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
