import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, HelpCircle, Loader2, Trash2, X } from 'lucide-react';
import { GlassCard } from '../Glass';

// iOS-Settings-style building blocks shared by the settings pages (API,
// Social Media, Requirement, User Setting): grouped lists of rows, each with
// a coloured icon tile, a few words of subtitle and a status badge, which
// expand in place to edit. Keeps every settings page looking and behaving
// the same, with icons and status doing the talking instead of paragraphs.

export function SettingsPage({ title, subtitle, children, width = 640, actions }) {
  return (
    <div style={{ maxWidth: width, margin: '0 auto', padding: '10px 20px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 30, marginBottom: 4 }}>{title}</h1>
          {subtitle && <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function Group({ title, children, footer, right }) {
  return (
    <section style={{ marginBottom: 26 }}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '0 4px 8px 16px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
          {right}
        </div>
      )}
      <GlassCard strong style={{ padding: 0, overflow: 'hidden', borderRadius: 18 }}>{children}</GlassCard>
      {footer && <p style={{ fontSize: 12, color: 'var(--ink-300)', margin: '8px 16px 0' }}>{footer}</p>}
    </section>
  );
}

export function AppIcon({ icon: Icon, color, size = 34 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.27, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.12)' }}>
      <Icon size={size * 0.53} color="white" strokeWidth={2.2} />
    </span>
  );
}

export const STATUS_LOOK = {
  checking: { label: 'Checking', color: 'var(--ink-300)', bg: 'rgba(80,69,56,0.06)' },
  ok: { label: 'Connected', color: '#0E8A5F', bg: 'rgba(0,214,151,0.14)' },
  server: { label: 'Server default', color: '#1F6FD1', bg: 'rgba(31,111,209,0.12)' },
  set: { label: 'Added', color: '#0E8A5F', bg: 'rgba(0,214,151,0.14)' },
  bad: { label: 'Not working', color: 'var(--accent-coral)', bg: 'rgba(217,0,0,0.1)' },
  none: { label: 'Not set', color: 'var(--ink-500)', bg: 'rgba(80,69,56,0.07)' },
  waiting: { label: 'Needs setup', color: '#B7791F', bg: 'rgba(242,170,36,0.16)' },
};

// status: { state: keyof STATUS_LOOK, label?, error? }
export function StatusBadge({ status }) {
  const look = STATUS_LOOK[status.state] || STATUS_LOOK.none;
  const good = ['ok', 'server', 'set'].includes(status.state);
  return (
    <span title={status.error} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: look.bg, color: look.color, fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap' }}>
      {status.state === 'checking' ? (
        <Loader2 size={12} className="spin" />
      ) : status.state === 'bad' ? (
        <X size={12} strokeWidth={3} />
      ) : good ? (
        <Check size={12} strokeWidth={3} />
      ) : (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', opacity: 0.6 }} />
      )}
      {status.label || look.label}
    </span>
  );
}

// One list row. With `children` it expands in place (onToggle/open); with
// `onClick` it's a plain tappable row; `right` replaces the status badge.
export function Row({ icon, color, iconNode, title, subtitle, status, right, open, onToggle, onClick, children, last, danger }) {
  const expandable = !!children;
  const handle = expandable ? onToggle : onClick;
  const content = (
    <>
      {iconNode || (icon && <AppIcon icon={icon} color={color} />)}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: danger ? 'var(--accent-coral)' : 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {subtitle && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>}
      </span>
      {right ?? (status && <StatusBadge status={status} />)}
      {handle && (
        <ChevronRight size={16} color="var(--ink-300)" style={{ flexShrink: 0, transform: expandable && open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      )}
    </>
  );
  const rowStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', minHeight: 58 };
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid rgba(80,69,56,0.08)' }}>
      {handle ? (
        <button type="button" onClick={handle} style={{ ...rowStyle, cursor: 'pointer' }}>{content}</button>
      ) : (
        <div style={rowStyle}>{content}</div>
      )}
      {expandable && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
              <div style={{ padding: '2px 16px 16px 62px', display: 'flex', flexDirection: 'column', gap: 12 }} className="settings-row-body">
                {status?.state === 'bad' && status.error && <Notice kind="error">{status.error}</Notice>}
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

// iOS-style segmented control.
export function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: 3, borderRadius: 11, background: 'rgba(80,69,56,0.08)', gap: 2, flexWrap: 'wrap' }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} title={o.hint}
            style={{ padding: '6px 12px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              background: active ? 'white' : 'transparent', color: active ? 'var(--ink-900)' : 'var(--ink-500)',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none' }}>
            {o.icon && <o.icon size={13} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SmallButton({ children, onClick, primary, danger, disabled, icon: Icon, type = 'button', style }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
        border: primary ? 'none' : '1px solid rgba(80,69,56,0.14)',
        background: primary ? 'var(--accent-violet)' : 'white',
        color: primary ? 'white' : danger ? 'var(--accent-coral)' : 'var(--ink-700)', ...style }}>
      {Icon && <Icon size={13} className={Icon === Loader2 ? 'spin' : undefined} />}
      {children}
    </button>
  );
}

export const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid rgba(183,169,154,0.45)',
  background: 'white',
  fontSize: 13.5,
  outline: 'none',
};

export function TextInput({ style, ...props }) {
  return <input {...props} style={{ ...inputStyle, ...style }} />;
}

// A stack of labelled inputs that read like one iOS form card.
export function FieldStack({ fields }) {
  return (
    <div style={{ borderRadius: 12, border: '1px solid rgba(183,169,154,0.45)', background: 'white', overflow: 'hidden' }}>
      {fields.map((f, i) => (
        <label key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderTop: i ? '1px solid rgba(80,69,56,0.08)' : 'none' }}>
          <span style={{ width: 110, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-500)' }}>{f.label}</span>
          <input
            type={f.type || 'text'}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            placeholder={f.placeholder}
            autoComplete={f.autoComplete || 'off'}
            onKeyDown={f.onEnter ? (e) => e.key === 'Enter' && f.onEnter() : undefined}
            style={{ flex: 1, minWidth: 0, padding: '11px 0', border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5 }}
          />
        </label>
      ))}
    </div>
  );
}

export function Notice({ kind = 'info', children }) {
  const colors = {
    error: { color: 'var(--accent-coral)', bg: 'rgba(217,0,0,0.07)' },
    ok: { color: '#0E8A5F', bg: 'rgba(0,214,151,0.12)' },
    info: { color: 'var(--ink-500)', bg: 'rgba(80,69,56,0.05)' },
  }[kind];
  return <p style={{ fontSize: 12.5, padding: '8px 12px', borderRadius: 10, lineHeight: 1.5, ...colors }}>{children}</p>;
}

// "How do I get this?" — long setup instructions stay one tap away instead
// of filling the page.
export function HelpDisclosure({ title = 'How do I get these?', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: 0, border: 'none', background: 'transparent', color: 'var(--accent-violet)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
        <HelpCircle size={14} /> {title}
      </button>
      {open && (
        <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-700)', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {children}
        </ol>
      )}
    </div>
  );
}

const mask = (key) => (key ? `••••••••  ${key.slice(-4)}` : '');

// One saved secret: shown masked with Replace / Remove, or an input to add one.
export function KeyEditor({ value, placeholder, onSave, secret = true, noun = 'key' }) {
  const [editing, setEditing] = useState(!value);
  const [draft, setDraft] = useState('');
  useEffect(() => { setEditing(!value); setDraft(''); }, [value]);

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code style={{ fontSize: 13, padding: '8px 12px', borderRadius: 10, background: 'rgba(80,69,56,0.06)', color: 'var(--ink-700)', letterSpacing: secret ? '0.05em' : 0 }}>
          {secret ? mask(value) : value}
        </code>
        <SmallButton onClick={() => setEditing(true)}>Replace</SmallButton>
        <SmallButton danger icon={Trash2} onClick={() => onSave('')}>Remove</SmallButton>
      </div>
    );
  }
  // Close the editor here rather than waiting for `value` to change — saving
  // the same key again wouldn't change it, and the box would just sit open.
  const save = () => {
    if (!draft.trim()) return;
    onSave(draft.trim());
    setEditing(false);
    setDraft('');
  };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input
        autoFocus={!!value}
        type={secret ? 'password' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder={placeholder}
        aria-label={`Paste your ${noun}`}
        style={{ ...inputStyle, flex: '1 1 220px', width: 'auto' }}
      />
      <SmallButton primary disabled={!draft.trim()} onClick={save}>Save</SmallButton>
      {value && <SmallButton onClick={() => setEditing(false)}>Cancel</SmallButton>}
    </div>
  );
}
