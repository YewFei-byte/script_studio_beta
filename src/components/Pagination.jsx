import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 36 }}>
      <button
        onClick={() => onChange(page - 1)}
        style={{ ...arrowStyle, visibility: page === 1 ? 'hidden' : 'visible' }}
      >
        <ChevronLeft size={16} />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 2px 6px',
            fontSize: 14,
            fontWeight: 600,
            color: n === page ? 'var(--ink-900)' : 'var(--ink-300)',
            borderBottom: n === page ? '2px solid var(--ink-900)' : '2px solid transparent',
            cursor: 'pointer',
          }}
        >
          {n}
        </button>
      ))}

      <button
        onClick={() => onChange(page + 1)}
        style={{ ...arrowStyle, visibility: page === totalPages ? 'hidden' : 'visible' }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

const arrowStyle = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: 'none',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-500)',
  cursor: 'pointer',
};
