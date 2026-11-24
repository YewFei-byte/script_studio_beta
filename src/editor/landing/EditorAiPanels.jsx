import React, { useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Clock, Eye, Italic, Languages, Loader2, RotateCcw, Sparkles, Wand2, X } from 'lucide-react';
import { getAtPath, setTheme } from './pageOps';
import { getTextStyle, setTextStyle } from '../../../shared/landing/textStyle.js';
import { panelLabel } from './EditorOutline';

// ✨ AI and History panels for the landing editor's right column.

const chip = (busy) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 999, border: '1px solid rgba(242,170,36,0.45)',
  background: 'rgba(242,170,36,0.08)', color: '#8A5A00', fontSize: 12.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
});

const REWRITE_CHIPS = [
  { id: 'shorter', label: 'Shorter' },
  { id: 'friendlier', label: 'Friendlier' },
  { id: 'persuasive', label: 'More persuasive' },
  { id: 'formal', label: 'More formal' },
  { id: 'fix', label: 'Fix language' },
];

function Busy({ text }) {
  return <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-500)', marginTop: 10 }}><Loader2 size={13} className="spin" /> {text}</p>;
}

// --- one text: its look ------------------------------------------------------------------

const SWATCH_LABEL = { primary: 'Main', accent: 'Accent', text: 'Text', muted: 'Soft grey', white: 'White', black: 'Black' };

function swatchColor(token, colors) {
  if (token?.startsWith?.('#')) return token;
  if (token === 'white') return '#FFFFFF';
  if (token === 'black') return '#111111';
  if (token === 'muted') return `color-mix(in srgb, ${colors.text} 68%, ${colors.bg})`;
  return colors[token];
}

// Round colour buttons: "Auto" (no change), the page's colours, then any colour.
function ColorRow({ value, tokens, colors, onChange }) {
  const ring = (on) => `0 0 0 2px white, 0 0 0 ${on ? 4 : 3}px ${on ? 'var(--accent-violet)' : 'rgba(80,69,56,0.18)'}`;
  const custom = value?.startsWith?.('#');
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '4px 4px' }}>
      <button type="button" title="Auto" aria-label="Auto" onClick={() => onChange(null)}
        style={{ width: 26, height: 26, borderRadius: '50%', border: 0, boxShadow: ring(!value), background: 'linear-gradient(135deg, #fff 45%, #e33 46%, #e33 54%, #fff 55%)', cursor: 'pointer' }} />
      {tokens.map((t) => (
        <button key={t} type="button" title={SWATCH_LABEL[t]} aria-label={SWATCH_LABEL[t]} onClick={() => onChange(t)}
          style={{ width: 26, height: 26, borderRadius: '50%', border: 0, boxShadow: ring(value === t), background: swatchColor(t, colors), cursor: 'pointer' }} />
      ))}
      <label title="Any colour" style={{ position: 'relative', width: 26, height: 26, borderRadius: '50%', boxShadow: ring(custom), background: custom ? value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', overflow: 'hidden', cursor: 'pointer' }}>
        <input type="color" value={custom ? value : '#ffffff'} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
      </label>
    </div>
  );
}

const lookBtn = (on) => ({ minWidth: 34, height: 32, padding: '0 9px', borderRadius: 9, border: `1px solid ${on ? 'var(--accent-violet)' : 'rgba(80,69,56,0.14)'}`, background: on ? 'rgba(242,170,36,0.14)' : 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink-700)', fontSize: 12.5, fontWeight: 700 });
const subLabel = { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-500)', margin: '0 0 6px' };

// Colour, size, bold/italic and alignment of one text. The WhatsApp button
// label instead changes the look of every WhatsApp button.
export function TextLook({ page, path, commit }) {
  const colors = page.theme?.colors || {};
  const st = getTextStyle(page, path) || {};
  const set = (patch, label) => commit(setTextStyle(page, path, patch), { label, mergeKey: `${path}.look` });

  if (path === 'cta.label') {
    const button = page.theme?.button || {};
    const setButton = (patch, label) => commit(setTheme(page, { button: { ...button, ...patch } }), { label, mergeKey: 'button.look' });
    return (
      <div style={{ padding: '0 16px 16px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8 }}>Button look <span style={{ fontWeight: 500, color: 'var(--ink-300)' }}>(all WhatsApp buttons)</span></p>
        <p style={subLabel}>Button colour</p>
        <ColorRow value={button.bg} tokens={['primary', 'accent', 'text', 'white', 'black']} colors={colors} onChange={(c) => setButton({ bg: c }, 'Changed button colour')} />
        <p style={{ ...subLabel, marginTop: 12 }}>Text colour</p>
        <ColorRow value={button.text} tokens={['white', 'black', 'primary', 'accent']} colors={colors} onChange={(c) => setButton({ text: c }, 'Changed button text colour')} />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)' }}>Look</p>
        {Object.keys(st).length > 0 && (
          <button type="button" onClick={() => commit(setTextStyle(page, path, { color: null, size: null, bold: null, italic: null, align: null }), { label: 'Reset text look' })}
            style={{ border: 0, background: 'none', color: 'var(--accent-violet)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reset</button>
        )}
      </div>
      <p style={subLabel}>Colour</p>
      <ColorRow value={st.color} tokens={['primary', 'accent', 'text', 'muted', 'white', 'black']} colors={colors} onChange={(c) => set({ color: c }, 'Changed text colour')} />
      <p style={{ ...subLabel, marginTop: 12 }}>Size</p>
      <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
        {[['s', 'S'], [null, 'M'], ['l', 'L'], ['xl', 'XL']].map(([id, label]) => (
          <button key={label} type="button" onClick={() => set({ size: id }, 'Changed text size')} style={lookBtn((st.size || null) === id)}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        <button type="button" title="Bold" aria-label="Bold" onClick={() => set({ bold: st.bold === true ? null : true }, 'Changed bold')} style={lookBtn(st.bold === true)}><Bold size={14} /></button>
        <button type="button" title="Italic" aria-label="Italic" onClick={() => set({ italic: st.italic ? null : true }, 'Changed italic')} style={lookBtn(!!st.italic)}><Italic size={14} /></button>
        <span style={{ width: 8 }} />
        {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, Icon]) => (
          <button key={a} type="button" title={`Align ${a}`} aria-label={`Align ${a}`} onClick={() => set({ align: st.align === a ? null : a }, 'Changed alignment')} style={lookBtn(st.align === a)}><Icon size={14} /></button>
        ))}
      </div>
    </div>
  );
}

// --- one text --------------------------------------------------------------------------

export function TextPanel({ page, path, busy, error, onRewrite, onClose, commit }) {
  const value = getAtPath(page, path) || {};
  const en = typeof value === 'string' ? value : value.en || '';
  const zh = typeof value === 'string' ? '' : value.zh || '';
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={panelLabel}>Text</p>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', marginRight: 10, color: 'var(--ink-500)', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(80,69,56,0.05)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
          <p style={{ color: en ? 'var(--ink-900)' : 'var(--ink-300)' }}><b style={{ fontSize: 11, color: 'var(--ink-500)', marginRight: 6 }}>EN</b>{en || 'empty'}</p>
          <p style={{ color: zh ? 'var(--ink-900)' : 'var(--ink-300)', marginTop: 4 }}><b style={{ fontSize: 11, color: 'var(--ink-500)', marginRight: 6 }}>中文</b>{zh || 'empty'}</p>
        </div>
      </div>
      {commit && <TextLook page={page} path={path} commit={commit} />}
      <div style={{ padding: '0 16px 16px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Sparkles size={13} color="#C98A00" /> Rewrite with AI</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {REWRITE_CHIPS.map((c) => (
            <button key={c.id} type="button" disabled={busy} onClick={() => onRewrite(path, c.id, c.label)} style={chip(busy)}>{c.label}</button>
          ))}
        </div>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', margin: '14px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Languages size={13} /> Translate</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button type="button" disabled={busy || !en} onClick={() => onRewrite(path, 'to-zh', 'Translated to 中文')} style={chip(busy || !en)}>English → 中文</button>
          <button type="button" disabled={busy || !zh} onClick={() => onRewrite(path, 'to-en', 'Translated to English')} style={chip(busy || !zh)}>中文 → English</button>
        </div>
        {busy && <Busy text="Rewriting…" />}
        {error && <p style={{ fontSize: 12.5, color: 'var(--accent-coral)', marginTop: 10 }}>{error}</p>}
        <p style={{ fontSize: 11.5, color: 'var(--ink-300)', marginTop: 14 }}>Rewrites both languages together. Undo brings the old text back.</p>
      </div>
    </>
  );
}

// --- one section ---------------------------------------------------------------------

export function SectionAi({ section, busy, error, onWrite }) {
  const [request, setRequest] = useState('');
  const send = () => {
    if (!request.trim() || busy) return;
    onWrite(section.id, request.trim());
    setRequest('');
  };
  return (
    <div style={{ margin: '0 16px 18px', padding: 12, borderRadius: 12, background: 'rgba(242,170,36,0.07)', border: '1px solid rgba(242,170,36,0.3)' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Sparkles size={13} color="#C98A00" /> AI for this section</p>
      <button type="button" disabled={busy} onClick={() => onWrite(section.id, '')} style={{ ...chip(busy), marginBottom: 10 }}>
        <Wand2 size={13} /> Write it from my documents
      </button>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={request} onChange={(e) => setRequest(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} disabled={busy} maxLength={500}
          placeholder="Ask AI, e.g. mention we deliver to Singapore"
          style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(183,169,154,0.45)', background: 'white', fontSize: 12.5, outline: 'none' }} />
        <button type="button" onClick={send} disabled={busy || !request.trim()} aria-label="Ask AI"
          style={{ padding: '0 12px', borderRadius: 9, border: 0, background: 'var(--accent-violet)', color: 'white', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: busy || !request.trim() ? 0.45 : 1 }}>Go</button>
      </div>
      {busy && <Busy text="Writing…" />}
      {error && <p style={{ fontSize: 12.5, color: 'var(--accent-coral)', marginTop: 8 }}>{error}</p>}
    </div>
  );
}

// --- history -----------------------------------------------------------------------------

const timeLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export function HistoryPanel({ entries, previewId, onPreview, onRestore, onClose, what = 'page' }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={panelLabel}>History</p>
        <button type="button" onClick={onClose} aria-label="Close history" style={{ border: 0, background: 'none', marginRight: 10, color: 'var(--ink-500)', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-500)', padding: '0 16px 12px' }}>Saved versions of this {what}. Click one to look at it, then restore it if you want it back.</p>
      <div style={{ padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map((e, i) => {
          const active = previewId === e.id;
          return (
            <div key={e.id} style={{ padding: '10px 12px', borderRadius: 12, background: active ? 'rgba(242,170,36,0.12)' : 'white', border: `1.5px solid ${active ? 'var(--accent-violet)' : 'rgba(183,169,154,0.25)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={13} color="var(--ink-300)" />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}{i === 0 ? ' · latest' : ''}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-500)' }}>{timeLabel(e.at)}{e.by ? ` · ${e.by}` : ''}</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button type="button" onClick={() => onPreview(active ? null : e)} style={smallBtn}><Eye size={12} /> {active ? 'Stop viewing' : 'View'}</button>
                <button type="button" onClick={() => onRestore(e)} style={smallBtn}><RotateCcw size={12} /> Restore</button>
              </div>
            </div>
          );
        })}
        {!entries.length && <p style={{ fontSize: 12.5, color: 'var(--ink-300)', padding: '6px 4px' }}>No saved versions yet.</p>}
      </div>
    </>
  );
}

const smallBtn = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(80,69,56,0.14)', background: 'white', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer' };
