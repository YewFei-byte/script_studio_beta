import React, { useRef, useState } from 'react';
import { Bot, FileText, Lightbulb, Loader2, Plus, Search, ShieldCheck, Trash2, UploadCloud, X } from 'lucide-react';
import { GlassButton, GlassCard } from '../components/Glass';
import Modal from '../components/Modal';
import { AppIcon, Group, Row, Segmented, SettingsPage, SmallButton } from '../components/settings/SettingsUI';
import { TYPE_LABEL, DEFAULT_TYPE_LABEL, KIND_FILTERS, DOC_SORT_OPTIONS, sortDocs, matchesDocFilter } from '../utils/documents';
import { extractDocumentText } from '../utils/extractText';

// Requirement: the documents the AI reads when it writes posts and landing
// pages. Drop files anywhere on the page (several at once). The Marketing
// SOP is applied to every generation automatically; other docs are picked
// per generation.

const ACCEPT = '.pdf,.doc,.docx,.txt,.md';

// Never fabricate what's in a document — just say nothing could be read.
function previewText(doc) {
  if (doc.content) return doc.content;
  return `Nothing could be read from "${doc.name}". Word files (.doc/.docx) and scanned PDFs aren't readable yet — save it as a PDF with real text, or as .txt.`;
}

// A file whose name says SOP/brand/guideline is probably the Marketing SOP.
function guessDocType(name) {
  const lower = name.toLowerCase();
  return lower.includes('sop') || lower.includes('brand') || lower.includes('guideline') ? 'sop' : 'other';
}

function fileTile(doc) {
  if (doc.type === 'guidance') return { icon: Bot, color: 'linear-gradient(135deg,#8E7CF0,#6650D8)' };
  if (doc.type === 'sop') return { icon: ShieldCheck, color: 'linear-gradient(135deg,#F2AA24,#D9822B)' };
  const ext = doc.name.split('.').pop().toLowerCase();
  if (ext === 'pdf') return { icon: FileText, color: 'linear-gradient(135deg,#F0605B,#D63B36)' };
  if (ext === 'doc' || ext === 'docx') return { icon: FileText, color: 'linear-gradient(135deg,#4A8FF0,#2A68D0)' };
  return { icon: FileText, color: 'linear-gradient(135deg,#8E8E93,#636366)' };
}

const FILTER_OPTIONS = KIND_FILTERS.map((f) => ({ ...f, label: f.id === 'sop' ? 'SOP' : f.label }));

export default function DocumentsPage({ documents, onAddDocument, onRemoveDocument }) {
  const [previewDoc, setPreviewDoc] = useState(null);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [sortBy, setSortBy] = useState('modified-desc');
  const [tipsOpen, setTipsOpen] = useState(false);
  const [reading, setReading] = useState([]); // file names being read right now
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const sopInput = useRef(null);
  const dragDepth = useRef(0);

  // Reads each file's real text (PDF/TXT) so the AI can use it, not just
  // the file name.
  const addFiles = async (fileList, forcedType) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setReading((r) => [...r, ...files.map((f) => f.name)]);
    for (const [i, file] of files.entries()) {
      // A file that can't be read still gets added — its row shows a
      // "Can't read" badge and the preview explains why.
      const { content } = await extractDocumentText(file);
      onAddDocument({
        id: `d${Date.now()}${i}`,
        name: file.name,
        type: forcedType || guessDocType(file.name),
        uploadedAt: new Date().toISOString().slice(0, 10),
        content: content || undefined,
      });
      setReading((r) => r.filter((n) => n !== file.name));
    }
  };

  const sopDocs = documents.filter((d) => d.type === 'sop');
  const q = search.trim().toLowerCase();
  const sorted = sortDocs(documents.filter((d) => matchesDocFilter(d, kindFilter) && d.name.toLowerCase().includes(q)), sortBy);

  const docRow = (d, last) => {
    const tile = fileTile(d);
    return (
      <Row key={d.id} icon={tile.icon} color={tile.color} title={d.name}
        subtitle={`${TYPE_LABEL[d.type] || DEFAULT_TYPE_LABEL} · ${d.uploadedAt}`}
        right={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!d.content && <span style={{ fontSize: 11.5, fontWeight: 650, color: '#B7791F', background: 'rgba(242,170,36,0.16)', padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>Can't read</span>}
            <span role="button" tabIndex={0} title="Remove" aria-label={`Remove ${d.name}`}
              onClick={(e) => { e.stopPropagation(); onRemoveDocument(d.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemoveDocument(d.id); } }}
              style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300)', cursor: 'pointer' }}
              className="row-delete">
              <Trash2 size={15} />
            </span>
          </span>
        }
        onClick={() => setPreviewDoc(d)} last={last} />
    );
  };

  const readingRows = reading.map((name, i) => (
    <Row key={`reading-${name}-${i}`} title={name} subtitle="Reading…"
      iconNode={<span style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Loader2 size={20} className="spin" color="var(--accent-violet)" /></span>} />
  ));

  return (
    <div
      onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { dragDepth.current += 1; setDragging(true); } }}
      onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
      onDragLeave={() => { dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
      onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setDragging(false); addFiles(e.dataTransfer.files); }}
      style={{ minHeight: '80vh', position: 'relative' }}
    >
      <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={sopInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files, 'sop'); e.target.value = ''; }} />

      <SettingsPage title="Requirement" subtitle="What the AI reads when it writes your posts and pages." width={720}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <SmallButton icon={Lightbulb} onClick={() => setTipsOpen((o) => !o)}>Tips</SmallButton>
            <SmallButton primary icon={Plus} onClick={() => fileInput.current?.click()}>Add files</SmallButton>
          </div>
        }>
        {tipsOpen && (
          <GlassCard strong style={{ padding: '14px 18px', borderRadius: 18, marginBottom: 22, position: 'relative' }}>
            <button type="button" onClick={() => setTipsOpen(false)} aria-label="Close tips" style={{ position: 'absolute', top: 10, right: 10, border: 'none', background: 'transparent', color: 'var(--ink-300)', cursor: 'pointer' }}><X size={16} /></button>
            <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>A great doc covers</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.8, color: 'var(--ink-700)', lineHeight: 1.75 }}>
              <li><b>Basics</b> — name, one-line pitch, who it's for</li>
              <li><b>2–4 key benefits</b> — not a full spec sheet</li>
              <li><b>Voice</b> — words to use or avoid</li>
              <li><b>Proof</b> — prices, reviews, numbers, guarantees</li>
              <li><b>Rules</b> — must-say / never-say lines</li>
            </ul>
          </GlassCard>
        )}

        <Group title="Marketing SOP" footer="Used in every post and page you generate. Only you can see it."
          right={<SmallButton icon={Plus} onClick={() => sopInput.current?.click()} style={{ padding: '5px 10px', fontSize: 12 }}>Add SOP</SmallButton>}>
          {sopDocs.length === 0 ? (
            <Row icon={UploadCloud} color="linear-gradient(135deg,#F2AA24,#D9822B)" title="Add your Marketing SOP" subtitle="Brand voice, rules, do's and don'ts"
              onClick={() => sopInput.current?.click()} last />
          ) : (
            sopDocs.map((d, i) => docRow(d, i === sopDocs.length - 1))
          )}
        </Group>

        <Group title={`Documents · ${documents.length}`}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid rgba(80,69,56,0.08)' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--ink-300)' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search documents"
                style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 10, border: 'none', background: 'rgba(80,69,56,0.07)', fontSize: 13.5, outline: 'none' }} />
            </div>
            <Segmented options={FILTER_OPTIONS} value={kindFilter} onChange={setKindFilter} />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort"
              style={{ padding: '7px 8px', borderRadius: 10, border: 'none', background: 'rgba(80,69,56,0.07)', fontSize: 12.5, color: 'var(--ink-700)', outline: 'none' }}>
              {DOC_SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label.replace('Modified date', 'Date')}</option>)}
            </select>
          </div>
          {readingRows}
          {sorted.map((d) => docRow(d, false))}
          {documents.length > 0 && sorted.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--ink-300)', padding: '14px 16px', borderBottom: '1px solid rgba(80,69,56,0.08)' }}>No matches.</p>
          )}
          <button type="button" onClick={() => fileInput.current?.click()}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 16px', border: 'none', background: 'transparent', color: 'var(--ink-500)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <UploadCloud size={17} color="var(--accent-violet)" /> Drop files here or click to add · PDF, TXT
          </button>
        </Group>
      </SettingsPage>

      {dragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(242,170,36,0.10)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <GlassCard strong style={{ padding: '26px 34px', borderRadius: 22, display: 'flex', alignItems: 'center', gap: 12, border: '2px dashed var(--accent-violet)' }}>
            <UploadCloud size={26} color="var(--accent-violet)" />
            <span style={{ fontSize: 16, fontWeight: 700 }}>Drop to add</span>
          </GlassCard>
        </div>
      )}

      <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)} width={520} showClose={false}>
        {previewDoc && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <AppIcon {...fileTile(previewDoc)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewDoc.name}</p>
                <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>{TYPE_LABEL[previewDoc.type] || DEFAULT_TYPE_LABEL} · {previewDoc.uploadedAt}</p>
              </div>
              <button type="button" onClick={() => setPreviewDoc(null)} aria-label="Close" style={{ border: 'none', background: 'transparent', color: 'var(--ink-500)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <GlassCard style={{ padding: 16, marginBottom: 18, background: 'var(--glass-fill-soft)', maxHeight: '50vh', overflowY: 'auto' }}>
              <p style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{previewText(previewDoc)}</p>
            </GlassCard>
            <GlassButton variant="danger" icon={Trash2} style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { onRemoveDocument(previewDoc.id); setPreviewDoc(null); }}>
              Remove document
            </GlassButton>
          </>
        )}
      </Modal>
    </div>
  );
}
