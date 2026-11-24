import React from 'react';
import { Check, Hash, Loader2, Sparkles } from 'lucide-react';

// Right-panel "Caption" tab: pick one of the AI's 3 versions, edit freely,
// one-click ✨ rewrites, hashtags on/off.

const CHIPS = [
  { id: 'shorter', label: 'Shorter' },
  { id: 'longer', label: 'Longer' },
  { id: 'friendlier', label: 'Friendlier' },
  { id: 'professional', label: 'More professional' },
  { id: 'emoji', label: 'Add emojis' },
  { id: 'noemoji', label: 'No emojis' },
];

const stripTags = (caption) => caption.replace(/(\n\s*)?(#[^\s#]+\s*)+$/u, '').trimEnd();

export default function CaptionPanel({ caption, options = [], hashtags = [], busy, error, onChange, onRewrite }) {
  const body = stripTags(caption || '');
  const tagLine = hashtags.map((h) => `#${String(h).replace(/^#/, '')}`).join(' ');
  const hasTags = !!tagLine && (caption || '').includes(tagLine);
  const withTags = (text, on) => (on && tagLine ? `${text}\n\n${tagLine}` : text);

  return (
    <div style={{ padding: '14px 16px 20px' }}>
      {options.length > 1 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8 }}>Versions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {options.map((o, i) => {
              const on = body.trim() === o.trim();
              return (
                <button key={i} type="button" onClick={() => onChange(withTags(o, hasTags || !caption), 'Picked a caption version')}
                  style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--accent-violet)' : 'rgba(183,169,154,0.3)'}`, background: on ? 'rgba(242,170,36,0.10)' : 'white', fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-700)', display: 'flex', gap: 8 }}>
                  <span style={{ fontWeight: 800, color: on ? '#B7791F' : 'var(--ink-300)' }}>{on ? <Check size={14} /> : i + 1}</span>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8 }}>Caption</p>
      <textarea value={caption || ''} onChange={(e) => onChange(e.target.value, 'Edited caption', 'caption')} rows={9}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(183,169,154,0.45)', background: 'white', fontSize: 13.5, lineHeight: 1.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 14px' }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-300)' }}>{(caption || '').length} characters</span>
        {tagLine && (
          <button type="button" onClick={() => onChange(withTags(body, !hasTags), hasTags ? 'Removed hashtags' : 'Added hashtags')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 999, border: `1px solid ${hasTags ? 'var(--accent-violet)' : 'rgba(80,69,56,0.2)'}`, background: hasTags ? 'rgba(242,170,36,0.12)' : 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-700)' }}>
            <Hash size={12} /> Hashtags {hasTags ? 'on' : 'off'}
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Sparkles size={13} color="#C98A00" /> Rewrite with AI</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CHIPS.map((c) => (
          <button key={c.id} type="button" disabled={busy || !body.trim()} onClick={() => onRewrite(c.id, c.label, hasTags)}
            style={{ padding: '6px 11px', borderRadius: 999, border: '1px solid rgba(242,170,36,0.45)', background: 'rgba(242,170,36,0.08)', color: '#8A5A00', fontSize: 12.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy || !body.trim() ? 0.5 : 1 }}>{c.label}</button>
        ))}
      </div>
      {busy && <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-500)', marginTop: 10 }}><Loader2 size={13} className="spin" /> Rewriting…</p>}
      {error && <p style={{ fontSize: 12.5, color: 'var(--accent-coral)', marginTop: 10 }}>{error}</p>}
    </div>
  );
}

export { stripTags };
