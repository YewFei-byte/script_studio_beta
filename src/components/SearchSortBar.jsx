import React from 'react';
import { Search } from 'lucide-react';

export default function SearchSortBar({ search, onSearchChange, searchPlaceholder = 'Search…', sortBy, onSortChange, sortOptions, style, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, ...style }}>
      <div style={{ position: 'relative', flex: '1 1 220px' }}>
        <Search size={14} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--ink-300)' }} />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            width: '100%',
            padding: '9px 14px 9px 36px',
            borderRadius: 999,
            border: '1px solid rgba(183,169,154,0.35)',
            background: 'rgba(255,255,255,0.6)',
            fontSize: 12.8,
            outline: 'none',
          }}
        />
      </div>

      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        style={{
          padding: '9px 14px',
          borderRadius: 999,
          border: '1px solid rgba(183,169,154,0.35)',
          background: 'rgba(255,255,255,0.6)',
          fontSize: 12.8,
          color: 'var(--ink-700)',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {sortOptions.map((o) => (
          <option key={o.id} value={o.id}>
            Sort: {o.label}
          </option>
        ))}
      </select>

      {children}
    </div>
  );
}
