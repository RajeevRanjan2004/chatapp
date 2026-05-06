import React, { useState } from "react";
import UserList from "./UserList";
import Icon from "./Icon";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "online", label: "Online" },
  { key: "offline", label: "Offline" },
];

export default function SearchAndFilter({ users, selectedUser, onSelectUser, onSearch }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  const handleSearchChange = (event) => {
    const nextValue = event.target.value;
    setSearchTerm(nextValue);
    onSearch(nextValue, filterType);
  };

  const handleFilterChange = (nextFilter) => {
    setFilterType(nextFilter);
    onSearch(searchTerm, nextFilter);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-24 pt-3 lg:pb-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-3 py-3">
          <Icon name="search" className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by name or email"
            className="flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                onSearch("", filterType);
              }}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => handleFilterChange(filter.key)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] transition ${
                filterType === filter.key
                  ? "bg-slate-900 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.3em] text-slate-400">
        <span>{users.length} matches</span>
        <span>{filterType}</span>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="h-full overflow-y-auto p-2 soft-scrollbar">
          <UserList users={users} selectedUser={selectedUser} onSelectUser={onSelectUser} />
        </div>
      </div>
    </div>
  );
}
