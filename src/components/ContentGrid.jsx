import React, { useEffect, useState } from 'react';
import { CheckSquare, Copy, Trash2, X } from 'lucide-react';
import ContentCard from './ContentCard';
import Modal from './Modal';
import Pagination from './Pagination';
import { GlassButton } from './Glass';

// The card grid shared by the Post and Landing Page lists: responsive
// columns, pages of PAGE_SIZE, and a "Select" mode for duplicating or
// deleting several items at once.

const PAGE_SIZE = 6;

export default function ContentGrid({ items, emptyText, stats, handlers, onDuplicate, onDeleteMany, resetKey }) {
  const [page, setPage] = useState(1);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A new filter / search starts again from page 1.
  useEffect(() => { setPage(1); }, [resetKey]);
  // Forget picks that are no longer in the list (deleted elsewhere, filtered out).
  const ids = items.map((c) => c.id).join('|');
  useEffect(() => { setPicked((p) => p.filter((id) => items.some((c) => c.id === id))); }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const pickedItems = items.filter((c) => picked.includes(c.id));
  const live = pickedItems.filter((c) => c.status === 'published' || c.status === 'scheduled');

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const stopSelecting = () => { setSelecting(false); setPicked([]); };
  const allOnPage = pageItems.length > 0 && pageItems.every((c) => picked.includes(c.id));
  const togglePage = () => setPicked((p) => (allOnPage ? p.filter((id) => !pageItems.some((c) => c.id === id)) : [...new Set([...p, ...pageItems.map((c) => c.id)])]));

  return (
    <>
      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '-4px 0 10px' }}>
          <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>{items.length} item{items.length === 1 ? '' : 's'}</span>
          <button type="button" onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--accent-violet)', cursor: 'pointer' }}>
            {selecting ? <><X size={14} /> Done</> : <><CheckSquare size={14} /> Select</>}
          </button>
        </div>
      )}

      {pageItems.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {pageItems.map((item) => (
            <ContentCard key={item.id} item={item} stats={stats?.[item.id]} {...handlers} onDuplicate={onDuplicate}
              selectable={selecting} selected={picked.includes(item.id)} onToggleSelect={() => toggle(item.id)} />
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--ink-300)', fontSize: 13 }}>{emptyText}</p>
      )}

      <Pagination page={current} totalPages={totalPages} onChange={setPage} />

      {selecting && (
        <div style={{ position: 'sticky', bottom: 16, zIndex: 20, marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 16, background: 'var(--ink-900)', color: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{picked.length} selected</span>
          <button type="button" onClick={togglePage} style={barBtn}>{allOnPage ? 'Unselect this page' : 'Select this page'}</button>
          <button type="button" disabled={!picked.length} onClick={() => { pickedItems.forEach(onDuplicate); stopSelecting(); }} style={barBtn}><Copy size={14} /> Duplicate</button>
          <button type="button" disabled={!picked.length} onClick={() => setConfirmDelete(true)} style={{ ...barBtn, background: 'rgba(255,90,70,0.9)' }}><Trash2 size={14} /> Delete</button>
        </div>
      )}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} width={460}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Delete {picked.length} item{picked.length === 1 ? '' : 's'}?</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 10 }}>This removes them for everyone on your team.</p>
        {live.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--accent-coral)', marginBottom: 10, lineHeight: 1.45 }}>
            {live.length} of them {live.length === 1 ? 'is' : 'are'} scheduled or published. Scheduled posts won't go out, and hosted landing pages go offline.
            Posts already on Facebook or Instagram stay there.
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <GlassButton variant="ghost" onClick={() => setConfirmDelete(false)} style={{ flex: 1, justifyContent: 'center' }}>Keep them</GlassButton>
          <GlassButton variant="danger" icon={Trash2} onClick={() => { onDeleteMany(pickedItems); setConfirmDelete(false); stopSelecting(); }} style={{ flex: 1, justifyContent: 'center' }}>Delete</GlassButton>
        </div>
      </Modal>
    </>
  );
}

const barBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: 0, background: 'rgba(255,255,255,0.14)', color: 'white', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' };
