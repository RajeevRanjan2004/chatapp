import React, { useState } from 'react';

export default function SearchBar({ onSearch, placeholder = "Search chats..." }) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch(value);
  };

  const handleClear = () => {
    setSearchTerm('');
    onSearch('');
  };

  return (
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-full px-3 py-2">
        <span className="text-gray-400">🔍</span>
        <input
          type="text"
          value={searchTerm}
          onChange={handleChange}
          placeholder={placeholder}
          className="flex-1 outline-none bg-transparent text-sm"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 text-lg"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
