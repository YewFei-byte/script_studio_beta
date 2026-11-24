import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, MessageCircle, RotateCcw, Sparkles } from 'lucide-react';

// "Ask AI" chat used by both editors. Each AI reply really changes the
// page / post (the editor applies it), lists what changed, and the latest
// one can be undone. The conversation is saved with the item.

export default function ChatPanel({ messages = [], busy, error, onSend, onUndo, undoableId, suggestions = [], placeholder = 'Ask for a change…' }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, busy]);

  const send = (value = text) => {
    const v = value.trim();
    if (!v || busy) return;
    onSend(v);
    setText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        {!messages.length && (
          <div style={{ textAlign: 'center', padding: '18px 6px 6px', color: 'var(--ink-500)' }}>
            <MessageCircle size={26} color="#C98A00" />
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', margin: '8px 0 4px' }}>Ask for any change</p>
            <p style={{ fontSize: 12.5, lineHeight: 1.5 }}>Describe it in your own words, in any language. The AI makes the change, and you can undo it.</p>
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} disabled={busy}
                    style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid rgba(242,170,36,0.4)', background: 'rgba(242,170,36,0.07)', fontSize: 12.5, color: '#7A5200', cursor: 'pointer', textAlign: 'left' }}>
                    <Sparkles size={12} style={{ marginRight: 6, verticalAlign: -1 }} />{s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
            <div style={{ padding: '9px 12px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', fontSize: 13, lineHeight: 1.5,
              background: m.role === 'user' ? 'var(--accent-violet)' : 'white', color: m.role === 'user' ? 'white' : 'var(--ink-900)',
              border: m.role === 'user' ? 'none' : '1px solid rgba(183,169,154,0.3)', whiteSpace: 'pre-wrap' }}>
              {m.text}
            </div>
            {m.changes?.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.5 }}>
                {m.changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            )}
            {m.undone && <p style={{ fontSize: 11.5, color: 'var(--ink-300)', marginTop: 4 }}>Undone</p>}
            {undoableId === m.id && !m.undone && (
              <button type="button" onClick={() => onUndo(m.id)}
                style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(80,69,56,0.18)', background: 'white', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer' }}>
                <RotateCcw size={12} /> Undo this
              </button>
            )}
          </div>
        ))}
        {busy && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 14, background: 'white', border: '1px solid rgba(183,169,154,0.3)', fontSize: 13, color: 'var(--ink-500)' }}>
            <Loader2 size={14} className="spin" /> Working on it…
          </div>
        )}
        {error && <p style={{ fontSize: 12.5, color: 'var(--accent-coral)' }}>{error}</p>}
        <div ref={endRef} />
      </div>
      <div style={{ padding: 12, borderTop: '1px solid rgba(80,69,56,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: 6, borderRadius: 14, border: '1px solid rgba(183,169,154,0.45)', background: 'white' }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={800} disabled={busy} placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            style={{ flex: 1, border: 0, outline: 'none', resize: 'none', fontSize: 13.5, fontFamily: 'inherit', padding: '4px 6px', background: 'transparent' }} />
          <button type="button" onClick={() => send()} disabled={busy || !text.trim()} aria-label="Send"
            style={{ width: 34, height: 34, borderRadius: 10, border: 0, background: 'var(--accent-violet)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: busy || !text.trim() ? 0.45 : 1, flexShrink: 0 }}>
            <ArrowUp size={17} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--ink-300)', marginTop: 6 }}>Enter to send · Shift+Enter for a new line</p>
      </div>
    </div>
  );
}
