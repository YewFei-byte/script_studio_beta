import React, { useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Copy, Eye, EyeOff, GripVertical, HelpCircle, Images, LayoutTemplate, ListOrdered, MapPin, Megaphone, Plus, Quote, Sparkles, Tag, Trash2, Video, X } from 'lucide-react';
import { SECTION_TYPES, SECTION_ORDER, tx } from '../../../shared/landing/schema.js';

// Left panel: the page's sections in order. Drag the handle to reorder;
// click to select (scrolls the preview there); hide / duplicate / delete per
// row; "Add section" opens the library.

export const SECTION_ICONS = {
  hero: LayoutTemplate, features: Sparkles, steps: ListOrdered, pricing: Tag, testimonials: Quote,
  gallery: Images, video: Video, faq: HelpCircle, cta: Megaphone, contact: MapPin,
};

function Row({ section, selected, onSelect, onToggleHidden, onDuplicate, onRemove }) {
  const controls = useDragControls();
  const Icon = SECTION_ICONS[section.type] || Sparkles;
  const meta = SECTION_TYPES[section.type];
  const subtitle = tx(section.content?.title, 'en') || meta?.hint || '';
  return (
    <Reorder.Item value={section.id} dragListener={false} dragControls={controls} as="div"
      style={{ listStyle: 'none', marginBottom: 6, position: 'relative' }} whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 2 }}>
      <div onClick={() => onSelect(section.id)} className="outline-row"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 8px 9px 4px', borderRadius: 12, cursor: 'pointer', background: selected ? 'rgba(242,170,36,0.14)' : 'rgba(255,255,255,0.6)', border: `1.5px solid ${selected ? 'var(--accent-violet)' : 'rgba(183,169,154,0.25)'}`, opacity: section.hidden ? 0.55 : 1 }}>
        <span onPointerDown={(e) => { e.preventDefault(); controls.start(e); }} title="Drag to move" aria-label="Drag to move"
          style={{ cursor: 'grab', color: 'var(--ink-300)', display: 'flex', touchAction: 'none', padding: '2px 0' }}>
          <GripVertical size={16} />
        </span>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: selected ? 'var(--accent-violet)' : 'rgba(80,69,56,0.07)', color: selected ? 'white' : 'var(--ink-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={15} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink-900)' }}>{meta?.label || section.type}{section.hidden ? ' (hidden)' : ''}</span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>
        </span>
        <span className="outline-actions" style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
          <IconBtn title={section.hidden ? 'Show' : 'Hide'} onClick={() => onToggleHidden(section.id)}>{section.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</IconBtn>
          <IconBtn title="Duplicate" onClick={() => onDuplicate(section.id)}><Copy size={14} /></IconBtn>
          <IconBtn title="Delete" danger onClick={() => onRemove(section.id)}><Trash2 size={14} /></IconBtn>
        </span>
      </div>
    </Reorder.Item>
  );
}

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      style={{ width: 26, height: 26, borderRadius: 7, border: 0, background: 'transparent', color: danger ? 'var(--accent-coral)' : 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      {children}
    </button>
  );
}

export default function EditorOutline({ page, selectedId, onSelect, onReorder, onToggleHidden, onDuplicate, onRemove, onAdd, videoEnabled }) {
  const [library, setLibrary] = useState(false);
  const types = SECTION_ORDER.filter((t) => !SECTION_TYPES[t].optional || (SECTION_TYPES[t].optional === 'video' && videoEnabled));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <p style={panelLabel}>Sections</p>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px', minHeight: 0 }}>
        <Reorder.Group axis="y" values={page.sections.map((s) => s.id)} onReorder={onReorder} as="div">
          {page.sections.map((s) => (
            <Row key={s.id} section={s} selected={s.id === selectedId} onSelect={onSelect} onToggleHidden={onToggleHidden} onDuplicate={onDuplicate} onRemove={onRemove} />
          ))}
        </Reorder.Group>

        {library ? (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 14, background: 'white', border: '1px solid rgba(183,169,154,0.35)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Add a section{selectedId ? ' below the selected one' : ''}</span>
              <IconBtn title="Close" onClick={() => setLibrary(false)}><X size={14} /></IconBtn>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {types.map((t) => {
                const Icon = SECTION_ICONS[t];
                return (
                  <button key={t} type="button" onClick={() => { onAdd(t); setLibrary(false); }} title={SECTION_TYPES[t].hint}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px', borderRadius: 10, border: '1px solid rgba(183,169,154,0.3)', background: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer', textAlign: 'left' }}>
                    <Icon size={14} color="var(--accent-violet)" /> {SECTION_TYPES[t].label}
                  </button>
                );
              })}
            </div>
            {!videoEnabled && <p style={{ fontSize: 11, color: 'var(--ink-300)', marginTop: 8 }}>Video can be switched on in Settings → Brand.</p>}
          </div>
        ) : (
          <button type="button" onClick={() => setLibrary(true)}
            style={{ marginTop: 6, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 12, border: '1.5px dashed rgba(183,169,154,0.6)', background: 'transparent', color: 'var(--ink-500)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15} /> Add section
          </button>
        )}
      </div>
    </div>
  );
}

export const panelLabel = { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '14px 16px 10px', margin: 0 };
