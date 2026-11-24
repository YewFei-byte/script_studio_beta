import React, { useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, MessageCircle, Palette, Save, Sparkles, Wand2 } from 'lucide-react';
import { GlassButton, GlassCard, GlassPill } from '../components/Glass';
import { uploadPosterImage } from '../utils/posterImages';
import { paletteFromLogo } from '../utils/logoColors';
import {
  FONT_PAIRS,
  PALETTES,
  TONES,
  fontPairById,
  googleFontsHref,
  normalizeBrandKit,
  whatsappLink,
} from '../../shared/brand.js';

// Settings → Brand. Set once per company; every new landing page and post
// starts from it, so nobody re-types the company name, re-uploads the logo
// or re-picks colours each time.

const COLOR_FIELDS = [
  { key: 'primary', label: 'Main' },
  { key: 'accent', label: 'Accent' },
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Cards' },
  { key: 'text', label: 'Text' },
];

// Load every font pair once so the picker cards render in their own fonts.
function useAllBrandFonts() {
  useEffect(() => {
    const links = FONT_PAIRS.map((p) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = googleFontsHref(p.id);
      document.head.appendChild(link);
      return link;
    });
    return () => links.forEach((l) => l.remove());
  }, []);
}

// onDraftChange(draft | null): the unsaved edits (null when there are none),
// so leaving the page can offer to save them.
export default function BrandKitPage({ brandKit, onSave, onDraftChange, documents = [], canEdit = true }) {
  useAllBrandFonts();
  const saved = useMemo(() => normalizeBrandKit(brandKit), [brandKit]);
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(''); // 'logo' | 'colors' | 'ai'
  const [notice, setNotice] = useState(null); // { kind: 'error'|'ok', text }
  const [savedPulse, setSavedPulse] = useState(false);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  // Adopt a server update (another admin, or the initial load) unless there
  // are unsaved local edits it would clobber.
  useEffect(() => {
    if (!isDirty) setDraft(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);
  useEffect(() => {
    onDraftChange?.(isDirty ? draft : null);
  }, [draft, isDirty, onDraftChange]);
  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setColor = (key, value) => setDraft((d) => ({ ...d, colors: { ...d.colors, [key]: value } }));
  const setWhatsapp = (patch) => setDraft((d) => ({ ...d, whatsapp: { ...d.whatsapp, ...patch } }));

  const docsContext = documents
    .filter((d) => d.content && d.type !== 'guidance')
    .map((d) => `--- ${d.name} ---\n${d.content}`)
    .join('\n\n');

  const handleLogo = (file) => {
    if (!file) return;
    setBusy('logo');
    setNotice(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const url = await uploadPosterImage(reader.result);
      set({ logoUrl: url });
      setBusy('');
      // New logo → offer matching colours straight away.
      try {
        set({ colors: await paletteFromLogo(url) });
        setNotice({ kind: 'ok', text: 'Colours picked from your logo — change them below if you like.' });
      } catch {
        // Not fatal: keep the current colours.
      }
    };
    reader.onerror = () => setBusy('');
    reader.readAsDataURL(file);
  };

  const colorsFromLogo = async () => {
    setBusy('colors');
    setNotice(null);
    try {
      set({ colors: await paletteFromLogo(draft.logoUrl) });
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBusy('');
    }
  };

  const fillFromDocs = async () => {
    setBusy('ai');
    setNotice(null);
    try {
      const res = await fetch('/api/brand/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: docsContext }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `Couldn't read your documents (${res.status}).`);
      setDraft((d) => ({
        ...d,
        companyName: d.companyName || body.companyName,
        tagline: body.tagline || d.tagline,
        tone: body.tone || d.tone,
        whatsapp: { ...d.whatsapp, message: d.whatsapp.message || body.whatsappMessage },
      }));
      setNotice({ kind: 'ok', text: 'Filled in from your documents — check it over, then Save.' });
    } catch (err) {
      setNotice({ kind: 'error', text: err.message });
    } finally {
      setBusy('');
    }
  };

  const save = () => {
    onSave(draft);
    setSavedPulse(true);
    setTimeout(() => setSavedPulse(false), 2000);
  };

  const font = fontPairById(draft.fontPair);
  const waLink = whatsappLink(draft.whatsapp.number, draft.whatsapp.message);

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '10px 24px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 30, marginBottom: 4 }}>Brand</h1>
          <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>
            Set this up once — every new landing page and post starts with your logo, colours and fonts.
          </p>
        </div>
        {canEdit && (
          <GlassButton variant="ghost" icon={Sparkles} onClick={fillFromDocs} disabled={busy === 'ai' || !docsContext}
            title={docsContext ? undefined : 'Upload a Marketing SOP or product document on the Requirement page first'}
            style={{ padding: '10px 18px', fontSize: 13.5 }}>
            {busy === 'ai' ? 'Reading your documents…' : 'Fill from my documents'}
          </GlassButton>
        )}
      </div>

      {notice && (
        <p style={{ fontSize: 13, marginBottom: 16, color: notice.kind === 'error' ? 'var(--accent-coral)' : 'var(--ink-500)' }}>
          {notice.kind === 'error' ? '⚠ ' : '✓ '}{notice.text}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)', gap: 24, alignItems: 'start' }} className="brand-grid">
        <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <GlassCard style={{ padding: 22 }}>
            <SectionTitle>Basics</SectionTitle>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <label style={{ width: 120, height: 120, borderRadius: 18, border: '1.5px dashed rgba(183,169,154,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canEdit ? 'pointer' : 'default', background: 'rgba(255,255,255,0.5)', overflow: 'hidden', flexShrink: 0 }}>
                {draft.logoUrl ? (
                  <img src={draft.logoUrl} alt="Logo" style={{ maxWidth: '86%', maxHeight: '86%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-500)' }}>
                    <ImagePlus size={22} />
                    {busy === 'logo' ? 'Uploading…' : 'Upload logo'}
                  </span>
                )}
                <input type="file" accept="image/*" hidden onChange={(e) => handleLogo(e.target.files?.[0])} />
              </label>
              <div style={{ flex: 1, minWidth: 220 }}>
                <Field label="Company / brand name">
                  <input value={draft.companyName} onChange={(e) => set({ companyName: e.target.value })} placeholder="e.g. Presoft" style={inputStyle} />
                </Field>
                <Field label="Tagline (optional)">
                  <input value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="e.g. Innovating beyond boundaries" style={inputStyle} />
                </Field>
              </div>
            </div>
          </GlassCard>

          <GlassCard style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <SectionTitle style={{ marginBottom: 0 }}>Colours</SectionTitle>
              {draft.logoUrl && (
                <GlassButton variant="subtle" icon={Wand2} onClick={colorsFromLogo} disabled={busy === 'colors'} style={{ padding: '6px 14px', fontSize: 12.5 }}>
                  {busy === 'colors' ? 'Reading logo…' : 'Match my logo'}
                </GlassButton>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
              {PALETTES.map((p) => {
                const active = JSON.stringify(p.colors) === JSON.stringify(draft.colors);
                return (
                  <button key={p.id} type="button" onClick={() => set({ colors: { ...p.colors } })} style={{ ...presetCardStyle, borderColor: active ? 'var(--accent-violet)' : 'var(--glass-border)' }}>
                    <span style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden' }}>
                      {['primary', 'accent', 'bg', 'text'].map((k) => (
                        <span key={k} style={{ flex: 1, background: p.colors[k] }} />
                      ))}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {active && <Check size={12} />} {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-500)', fontWeight: 600 }}>
                  <span style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%', background: draft.colors[key], border: '2px solid white', boxShadow: '0 0 0 1px rgba(80,69,56,0.2)', overflow: 'hidden' }}>
                    <input type="color" value={draft.colors[key]} onChange={(e) => setColor(key, e.target.value.toUpperCase())} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                  </span>
                  {label}
                </label>
              ))}
            </div>
          </GlassCard>

          <GlassCard style={{ padding: 22 }}>
            <SectionTitle>Fonts</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              {FONT_PAIRS.map((p) => {
                const active = draft.fontPair === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => set({ fontPair: p.id })} style={{ ...presetCardStyle, padding: '14px 14px 12px', borderColor: active ? 'var(--accent-violet)' : 'var(--glass-border)' }}>
                    <span style={{ fontFamily: `'${p.display}', serif`, fontSize: 22, fontWeight: 700, color: 'var(--ink-900)', lineHeight: 1.1 }}>Aa Headline</span>
                    <span style={{ fontFamily: `'${p.body}', sans-serif`, fontSize: 12.5, color: 'var(--ink-500)' }}>Body text looks like this.</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'var(--accent-violet)' : 'var(--ink-300)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {active && <Check size={11} />} {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard style={{ padding: 22 }}>
            <SectionTitle>Voice</SectionTitle>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TONES.map((t) => (
                <GlassPill key={t.id} active={draft.tone === t.id} onClick={() => canEdit && set({ tone: t.id })}>{t.label}</GlassPill>
              ))}
            </div>
          </GlassCard>

          <GlassCard style={{ padding: 22 }}>
            <SectionTitle>WhatsApp button</SectionTitle>
            <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginTop: -4, marginBottom: 14 }}>
              Landing page buttons open a WhatsApp chat with this number, with the message already typed for the customer.
            </p>
            <Field label="WhatsApp number">
              <input value={draft.whatsapp.number} onChange={(e) => setWhatsapp({ number: e.target.value })} placeholder="e.g. 012-345 6789" inputMode="tel" style={inputStyle} />
            </Field>
            <Field label="Message the customer sends">
              <input value={draft.whatsapp.message} onChange={(e) => setWhatsapp({ message: e.target.value })} placeholder="e.g. Hi! I'd like to know more about your products." style={inputStyle} />
            </Field>
            {waLink && (
              <a href={waLink} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--accent-violet)', fontWeight: 600 }}>
                Test this link ↗
              </a>
            )}
          </GlassCard>
        </fieldset>

        <div style={{ position: 'sticky', top: 90, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <BrandPreview kit={draft} font={font} />
          {canEdit ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <GlassButton variant="primary" icon={savedPulse ? Check : Save} disabled={!isDirty && !savedPulse} onClick={save} style={{ flex: 1 }}>
                {savedPulse ? 'Saved' : 'Save brand'}
              </GlassButton>
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>Only Admins can change the brand.</p>
          )}
          {isDirty && !savedPulse && <span style={{ fontSize: 11.5, color: 'var(--ink-300)' }}>You have unsaved changes</span>}
        </div>
      </div>
    </div>
  );
}

// A tiny mock landing page hero so people see what their choices produce.
function BrandPreview({ kit, font }) {
  const c = kit.colors;
  return (
    <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--glass-border)' }}>
        <Palette size={12} /> Preview
      </div>
      <div style={{ background: c.bg, color: c.text, padding: 20, fontFamily: `'${font.body}', sans-serif` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          {kit.logoUrl ? (
            <img src={kit.logoUrl} alt="" style={{ height: 26, maxWidth: 110, objectFit: 'contain' }} />
          ) : (
            <span style={{ fontFamily: `'${font.display}', serif`, fontWeight: 700, fontSize: 15, color: c.accent }}>{kit.companyName || 'Your brand'}</span>
          )}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: c.primary, marginBottom: 6 }}>
          {kit.tagline || 'Your tagline here'}
        </div>
        <div style={{ fontFamily: `'${font.display}', serif`, fontSize: 28, fontWeight: 700, lineHeight: 1.05, color: c.accent, marginBottom: 10 }}>
          The headline of your next page
        </div>
        <p style={{ fontSize: 12.5, opacity: 0.8, marginBottom: 16, lineHeight: 1.5 }}>A short line about what you offer and why it matters to your customers.</p>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: c.primary, color: '#fff', padding: '9px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 700 }}>
          <MessageCircle size={14} /> Chat on WhatsApp
        </span>
        <div style={{ marginTop: 18, background: c.surface, borderRadius: 12, padding: 12, fontSize: 12, boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
          <strong style={{ fontFamily: `'${font.display}', serif`, color: c.accent }}>Feature card</strong>
          <div style={{ opacity: 0.75, marginTop: 4 }}>Cards and sections use these colours.</div>
        </div>
      </div>
    </GlassCard>
  );
}

function SectionTitle({ children, style }) {
  return (
    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, ...style }}>
      {children}
    </p>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(183,169,154,0.35)',
  background: 'rgba(255,255,255,0.6)',
  fontSize: 13.8,
  outline: 'none',
};

const presetCardStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 10,
  borderRadius: 14,
  border: '1.5px solid var(--glass-border)',
  background: 'rgba(255,255,255,0.55)',
  cursor: 'pointer',
  textAlign: 'left',
};
