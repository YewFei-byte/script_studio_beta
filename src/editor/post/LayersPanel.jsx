import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Circle as CircleIcon, Eye, EyeOff, GripVertical, Image as ImageIcon, Lock, RectangleHorizontal, Square, Type, Unlock } from 'lucide-react';

// The "Layers" tab of the post composer: every layer on the current slide,
// top-most first. Click to select, drag (or the arrows) to change the
// stacking order, double-click a name to rename it, and hide / lock.

const ICONS = { text: Type, image: ImageIcon, logo: ImageIcon, rect: Square, circle: CircleIcon, pill: RectangleHorizontal };

function layerLabel(l) {
  if (l.name) return l.name;
  if (l.type === 'text') return (l.text || 'Text').replace(/\s+/g, ' ').slice(0, 28);
  if (l.type === 'image') return 'Picture';
  if (l.type === 'logo') return 'Logo';
  return { circle: 'Circle', pill: 'Pill' }[l.shape] || 'Box';
}

export default function LayersPanel({ layers, selectedId, onSelect, onPatch, onMove }) {
  const [renaming, setRenaming] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  // Shown top-most first; `index` below is always the position in `layers`.
  const rows = layers.map((l, index) => ({ l, index })).reverse();
  const last = layers.length - 1;

  const finishRename = (id, value) => {
    setRenaming(null);
    onPatch(id, { name: value.trim() || undefined }, 'Renamed layer');
  };

  return (
    <div style={{ padding: '12px 12px 16px' }}>
      <p style={{ fontSize: 12, color: 'var(--ink-500)', padding: '0 4px 10px' }}>Top of the list is in front. Drag to reorder, double-click to rename.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverIdx(null); }}>
        {rows.map(({ l, index }) => {
          const Icon = ICONS[l.type === 'shape' ? l.shape : l.type] || Square;
          const active = l.id === selectedId;
          return (
            <div key={l.id} draggable={renaming !== l.id}
              onDragStart={(e) => { setDragId(l.id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverIdx(index); } }}
              onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== l.id) onMove(dragId, index); setDragId(null); setOverIdx(null); }}
              onDragEnd={() => { setDragId(null); setOverIdx(null); }}
              onClick={() => onSelect(l.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 4px', borderRadius: 10, cursor: 'pointer',
                background: active ? 'rgba(242,170,36,0.12)' : 'white',
                border: `1.5px solid ${active ? 'var(--accent-violet)' : overIdx === index && dragId !== l.id ? 'rgba(242,170,36,0.6)' : 'rgba(183,169,154,0.25)'}`,
                opacity: l.hidden ? 0.55 : dragId === l.id ? 0.4 : 1,
              }}>
              <GripVertical size={14} color="var(--ink-300)" style={{ cursor: 'grab', flexShrink: 0 }} />
              <Icon size={14} color="var(--ink-500)" style={{ flexShrink: 0 }} />
              {renaming === l.id ? (
                <input autoFocus defaultValue={layerLabel(l)} onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => finishRename(l.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null); }}
                  style={{ flex: 1, minWidth: 0, fontSize: 12.5, padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(183,169,154,0.6)', outline: 'none' }} />
              ) : (
                <span onDoubleClick={(e) => { e.stopPropagation(); setRenaming(l.id); }} title={layerLabel(l)}
                  style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {layerLabel(l)}
                </span>
              )}
              <RowBtn title="Move up" disabled={index === last} onClick={() => onMove(l.id, index + 1)}><ChevronUp size={14} /></RowBtn>
              <RowBtn title="Move down" disabled={index === 0} onClick={() => onMove(l.id, index - 1)}><ChevronDown size={14} /></RowBtn>
              <RowBtn title={l.locked ? 'Unlock' : 'Lock (stops it being moved)'} on={l.locked} onClick={() => onPatch(l.id, { locked: !l.locked || undefined }, l.locked ? 'Unlocked' : 'Locked')}>
                {l.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </RowBtn>
              <RowBtn title={l.hidden ? 'Show' : 'Hide'} on={l.hidden} onClick={() => onPatch(l.id, { hidden: !l.hidden || undefined }, l.hidden ? 'Showed layer' : 'Hid layer')}>
                {l.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </RowBtn>
            </div>
          );
        })}
        {!layers.length && <p style={{ fontSize: 12.5, color: 'var(--ink-300)', padding: '6px 4px' }}>Nothing on this slide yet. Add text or a picture on the left.</p>}
      </div>
    </div>
  );
}

function RowBtn({ title, on, disabled, onClick, children }) {
  return (
    <button type="button" title={title} aria-label={title} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ width: 24, height: 24, borderRadius: 6, border: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: on ? 'rgba(242,170,36,0.18)' : 'transparent', color: on ? '#8A5A00' : 'var(--ink-500)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1 }}>
      {children}
    </button>
  );
}
