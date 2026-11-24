import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// The dropdown menu below used to be a plain position:absolute child of
// this component's own wrapper div. That broke in two real places: (1) any
// list this sits inside with overflowY: 'auto' + a maxHeight (e.g. the
// Members roster) clips an absolutely-positioned child the instant it
// extends past that container's bounds, and (2) sibling rows that use
// backdrop-filter (GlassCard) each start their own CSS stacking context —
// so a dropdown's z-index, however high, can never paint above the *next*
// row's card; it just renders underneath it, looking cut off/unclickable
// exactly like the Members page's per-member branch picker did. Rendering
// the menu into a portal (document.body) with position: fixed, positioned
// from the trigger's real on-screen coordinates, sidesteps both — it's no
// longer inside any clipping/stacking ancestor at all.
export default function FilterSelect({ value, onChange, options, allLabel = 'All', includeAll = true, style }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState(null);
  const wrapRef = useRef(null);

  const all = [
    ...(includeAll ? [{ value: 'all', label: allLabel }] : []),
    ...options.map((o) => ({ value: o, label: o })),
  ];
  const selected = all.find((o) => o.value === value);
  const filtered = query ? all.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : all;

  const openMenu = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    setOpen(true);
  };

  // Keep the menu glued to its trigger if the page scrolls or resizes while
  // it's open, rather than leaving it floating over the wrong spot.
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (rect) setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const pick = (opt) => {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <div
        onClick={openMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '9px 12px',
          borderRadius: 999,
          border: open ? '1px solid var(--accent-violet)' : '1px solid rgba(183,169,154,0.35)',
          background: 'rgba(255,255,255,0.6)',
        }}
      >
        <input
          value={open ? query : selected?.label || (includeAll ? allLabel : '')}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) openMenu();
          }}
          onFocus={openMenu}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder={allLabel}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 12.8,
            color: 'var(--ink-700)',
            width: 110,
            padding: 0,
          }}
        />
        <ChevronDown
          size={13}
          style={{ flexShrink: 0, color: 'var(--ink-300)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </div>

      {open && menuPos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            minWidth: Math.max(menuPos.width, 140),
            zIndex: 1000,
            background: 'var(--glass-fill-strong)',
            backdropFilter: 'blur(24px) saturate(160%)',
            border: '1px solid var(--glass-border)',
            borderRadius: 12,
            boxShadow: 'var(--glass-shadow)',
            maxHeight: 220,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {filtered.length > 0 ? (
            filtered.map((o) => (
              <div
                key={o.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  color: o.value === value ? 'var(--accent-violet)' : 'var(--ink-700)',
                  fontWeight: o.value === value ? 700 : 500,
                  background: o.value === value ? 'rgba(242,170,36,0.1)' : 'transparent',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.label}
              </div>
            ))
          ) : (
            <div style={{ padding: '8px 10px', fontSize: 12.5, color: 'var(--ink-300)' }}>No matches</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
