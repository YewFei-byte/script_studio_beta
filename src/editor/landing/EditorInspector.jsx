import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, ImagePlus, Loader2, Minus, Plus, Star, Trash2, X } from 'lucide-react';
import { Segmented } from '../../components/settings/SettingsUI';
import { FONT_PAIRS, PALETTES, normalizeBrandKit } from '../../../shared/brand.js';
import { icon as svgIcon } from '../../../shared/landing/icons.js';
import { FEATURE_ICONS, SECTION_TYPES, tx } from '../../../shared/landing/schema.js';
import { videoEmbed } from '../../../shared/landing/sections.js';
import { addListItem, duplicateSection, getAtPath, moveListItem, moveSection, removeListItem, removeSection, setAtPath, setTheme, updateSection, updateSectionContent } from './pageOps';
import { panelLabel } from './EditorOutline';
import { HistoryPanel, SectionAi, TextLook, TextPanel } from './EditorAiPanels';

// Right panel. What it shows follows what's selected in the preview:
// a photo → photo options; a section → its layout, background and items;
// nothing → page-wide settings (theme, fonts, button, WhatsApp).

const L = (en = '', zh = '') => ({ en, zh });

// New list items, with placeholder text the user then clicks to edit.
const NEW_ITEM = {
  features: () => ({ icon: 'star', title: L('New point', '新优点'), text: L('Say why it matters.', '说明它的重要性。') }),
  steps: () => ({ title: L('New step', '新步骤'), text: L('What happens here.', '这一步做什么。') }),
  faq: () => ({ q: L('New question?', '新问题？'), a: L('The answer.', '答案。') }),
  testimonials: () => ({ quote: L('A real quote from a customer.', '一句真实的客户评价。'), name: 'Customer name', role: L('Customer', '客户') }),
  pricing: () => ({ name: L('New plan', '新方案'), price: 'RM 0', period: L('per month', '每月'), features: [L('What is included', '包含内容')], highlighted: false }),
};
const LIST_KEY = { features: 'items', steps: 'items', faq: 'items', testimonials: 'items', pricing: 'plans', gallery: 'images' };
const LIST_MAX = { features: 6, steps: 5, faq: 10, testimonials: 4, pricing: 4, gallery: 10 };
const LIST_NOUN = { features: 'point', steps: 'step', faq: 'question', testimonials: 'review', pricing: 'plan', gallery: 'photo' };

function Block({ title, children, right }) {
  return (
    <div style={{ padding: '0 16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)' }}>{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}

function Btn({ children, onClick, title, danger, primary, disabled, style }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 10px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
        border: primary ? 'none' : '1px solid rgba(80,69,56,0.14)', background: primary ? 'var(--accent-violet)' : 'white', color: primary ? 'white' : danger ? 'var(--accent-coral)' : 'var(--ink-700)', ...style }}>
      {children}
    </button>
  );
}

const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 9, border: '1px solid rgba(183,169,154,0.45)', background: 'white', fontSize: 13, outline: 'none' };

function PhotoUpload({ onFile, busy, label = 'Upload photo', multiple }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" hidden multiple={multiple} onChange={(e) => { onFile(e.target.files); e.target.value = ''; }} />
      <Btn primary onClick={() => ref.current?.click()} disabled={busy}>{busy ? <Loader2 size={13} className="spin" /> : <ImagePlus size={13} />} {busy ? 'Uploading…' : label}</Btn>
    </>
  );
}

// --- photo -----------------------------------------------------------------------

function PhotoPanel({ page, path, commit, upload, onClose }) {
  const [busy, setBusy] = useState(false);
  const image = getAtPath(page, path);
  const set = (value, label) => commit(setAtPath(page, path, value), { label });
  const onFile = async (files) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    const url = await upload(file);
    setBusy(false);
    if (url) set({ url, alt: image?.alt || L() }, 'Changed photo');
  };
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={panelLabel}>Photo</p>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: 'none', marginRight: 10, color: 'var(--ink-500)', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <Block title={image?.url ? 'Current photo' : 'No photo yet'}>
        {image?.url && <img src={image.url} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 10, maxHeight: 180, objectFit: 'cover' }} />}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <PhotoUpload onFile={onFile} busy={busy} label={image?.url ? 'Replace' : 'Upload photo'} />
          {image?.url && <Btn danger onClick={() => set(null, 'Removed photo')}><Trash2 size={13} /> Remove</Btn>}
        </div>
      </Block>
      {image?.url && (
        <Block title="Description (for screen readers and Google)">
          <input value={image.alt?.en || ''} onChange={(e) => commit(setAtPath(page, `${path}.alt`, { ...(image.alt || {}), en: e.target.value }), { label: 'Edited photo description', mergeKey: `${path}.alt` })}
            placeholder="e.g. A bag of Ipoh white coffee beans" style={inputStyle} />
        </Block>
      )}
    </>
  );
}

// --- section -----------------------------------------------------------------------

function SectionPanel({ page, section, lang, commit, upload, onDeleted, onSelect, ai }) {
  const [busy, setBusy] = useState(false);
  const meta = SECTION_TYPES[section.type];
  const c = section.content || {};
  const id = section.id;
  const listKey = LIST_KEY[section.type];
  const list = listKey ? c[listKey] || [] : [];
  const canBg = !['hero', 'cta', 'contact'].includes(section.type);

  const uploadMany = async (files) => {
    const arr = Array.from(files || []).slice(0, LIST_MAX.gallery - list.length);
    if (!arr.length) return;
    setBusy(true);
    const urls = (await Promise.all(arr.map(upload))).filter(Boolean);
    setBusy(false);
    commit(updateSectionContent(page, id, { images: [...list, ...urls.map((url) => ({ url, alt: L() }))] }), { label: 'Added photos' });
  };

  return (
    <>
      <p style={panelLabel}>{meta?.label || section.type}</p>
      {ai && <SectionAi section={section} busy={ai.busy} error={ai.error} onWrite={ai.writeSection} />}
      <Block title="Section">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Btn title="Move up" onClick={() => commit(moveSection(page, id, -1), { label: 'Moved section' })}><ArrowUp size={13} /></Btn>
          <Btn title="Move down" onClick={() => commit(moveSection(page, id, 1), { label: 'Moved section' })}><ArrowDown size={13} /></Btn>
          <Btn onClick={() => { const next = duplicateSection(page, id); commit(next, { label: 'Duplicated section' }); onSelect(next.sections[next.sections.findIndex((s) => s.id === id) + 1]?.id); }}><Copy size={13} /> Duplicate</Btn>
          <Btn onClick={() => commit(updateSection(page, id, { hidden: !section.hidden }), { label: section.hidden ? 'Showed section' : 'Hid section' })}>{section.hidden ? <Eye size={13} /> : <EyeOff size={13} />} {section.hidden ? 'Show' : 'Hide'}</Btn>
          <Btn danger onClick={() => { commit(removeSection(page, id), { label: `Deleted ${meta?.label || 'section'}` }); onDeleted(); }}><Trash2 size={13} /> Delete</Btn>
        </div>
      </Block>

      {meta?.variants?.length > 1 && (
        <Block title="Layout">
          <Segmented options={meta.variants} value={section.variant} onChange={(v) => commit(updateSection(page, id, { variant: v }), { label: 'Changed layout' })} />
        </Block>
      )}

      {canBg && (
        <Block title="Background">
          <Segmented options={[{ id: 'auto', label: 'Auto' }, { id: 'plain', label: 'Plain' }, { id: 'tint', label: 'Tinted' }]} value={section.bg || 'auto'}
            onChange={(v) => commit(updateSection(page, id, { bg: v === 'auto' ? undefined : v }), { label: 'Changed background' })} />
        </Block>
      )}

      {(section.type === 'hero' || section.type === 'cta') && (
        <Block title="Photo">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <PhotoUpload busy={busy} label={c.image?.url ? 'Replace photo' : 'Upload photo'} onFile={async (files) => {
              if (!files?.[0]) return;
              setBusy(true);
              const url = await upload(files[0]);
              setBusy(false);
              if (url) commit(updateSectionContent(page, id, { image: { url, alt: c.image?.alt || L() } }), { label: 'Changed photo' });
            }} />
            {c.image?.url && <Btn danger onClick={() => commit(updateSectionContent(page, id, { image: null }), { label: 'Removed photo' })}><Trash2 size={13} /> Remove</Btn>}
          </div>
        </Block>
      )}

      {section.type === 'video' && (
        <Block title="Video link">
          <input value={c.url || ''} onChange={(e) => commit(updateSectionContent(page, id, { url: e.target.value.trim() }), { label: 'Changed video', mergeKey: `${id}.url` })}
            placeholder="https://www.youtube.com/watch?v=…" style={inputStyle} />
          <p style={{ fontSize: 11.5, marginTop: 6, color: c.url && !videoEmbed(c.url) ? 'var(--accent-coral)' : 'var(--ink-500)' }}>
            {c.url && !videoEmbed(c.url) ? "That link doesn't look right." : 'YouTube, Vimeo or a direct .mp4 link.'}
          </p>
        </Block>
      )}

      {section.type === 'contact' && (
        <Block title="Google Maps link (optional)">
          <input value={c.mapUrl || ''} onChange={(e) => commit(updateSectionContent(page, id, { mapUrl: e.target.value.trim() }), { label: 'Changed map link', mergeKey: `${id}.map` })}
            placeholder="https://maps.app.goo.gl/…" style={inputStyle} />
        </Block>
      )}

      {section.type === 'gallery' && (
        <Block title={`Photos · ${list.length}`} right={list.length < LIST_MAX.gallery && <PhotoUpload multiple busy={busy} label="Add" onFile={uploadMany} />}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {list.map((im, i) => (
              <div key={`${im?.url}-${i}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#eee' }}>
                {im?.url && <img src={im.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                <button type="button" aria-label="Remove photo" onClick={() => commit(removeListItem(page, id, 'images', i), { label: 'Removed photo' })}
                  style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 999, border: 0, background: 'rgba(0,0,0,0.55)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={11} /></button>
              </div>
            ))}
          </div>
          {!list.length && <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>Add up to {LIST_MAX.gallery} photos. The first one shows biggest.</p>}
        </Block>
      )}

      {listKey && section.type !== 'gallery' && (
        <Block title={`${LIST_NOUN[section.type][0].toUpperCase()}${LIST_NOUN[section.type].slice(1)}s · ${list.length}`}
          right={list.length < LIST_MAX[section.type] && (
            <Btn onClick={() => commit(addListItem(page, id, listKey, NEW_ITEM[section.type]()), { label: `Added a ${LIST_NOUN[section.type]}` })}><Plus size={13} /> Add</Btn>
          )}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map((it, i) => (
              <div key={i} style={{ padding: 8, borderRadius: 10, background: 'rgba(80,69,56,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx(it.title || it.q || it.name || it.quote, lang) || `${LIST_NOUN[section.type]} ${i + 1}`}
                  </span>
                  {section.type === 'pricing' && (
                    <button type="button" title={it.highlighted ? 'Highlighted' : 'Highlight this plan'} onClick={() => commit(updateSectionContent(page, id, { plans: list.map((p, k) => ({ ...p, highlighted: k === i ? !p.highlighted : false })) }), { label: 'Changed highlighted plan' })}
                      style={{ border: 0, background: 'none', cursor: 'pointer', color: it.highlighted ? '#E0A100' : 'var(--ink-300)', display: 'flex' }}><Star size={14} fill={it.highlighted ? '#E0A100' : 'none'} /></button>
                  )}
                  <button type="button" title="Move up" onClick={() => commit(moveListItem(page, id, listKey, i, -1), { label: 'Reordered' })} style={miniBtn}><ArrowUp size={12} /></button>
                  <button type="button" title="Move down" onClick={() => commit(moveListItem(page, id, listKey, i, 1), { label: 'Reordered' })} style={miniBtn}><ArrowDown size={12} /></button>
                  <button type="button" title="Remove" onClick={() => commit(removeListItem(page, id, listKey, i), { label: `Removed a ${LIST_NOUN[section.type]}` })} style={{ ...miniBtn, color: 'var(--accent-coral)' }}><Trash2 size={12} /></button>
                </div>
                {section.type === 'features' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                    {FEATURE_ICONS.map((name) => (
                      <button key={name} type="button" title={name} onClick={() => commit(setAtPath(page, `sections.${page.sections.indexOf(section)}.content.items.${i}.icon`, name), { label: 'Changed icon' })}
                        style={{ width: 26, height: 26, borderRadius: 7, border: `1.5px solid ${it.icon === name ? 'var(--accent-violet)' : 'transparent'}`, background: it.icon === name ? 'rgba(242,170,36,0.12)' : 'transparent', color: 'var(--ink-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        dangerouslySetInnerHTML={{ __html: svgIcon(name, { size: 15 }) }} />
                    ))}
                  </div>
                )}
                {section.type === 'pricing' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11.5, color: 'var(--ink-500)' }}>
                    {(it.features || []).length} included items
                    <button type="button" title="Add an included item" onClick={() => commit(setAtPath(page, `sections.${page.sections.indexOf(section)}.content.plans.${i}.features`, [...(it.features || []), L('Included item', '包含项目')]), { label: 'Added an included item' })} style={miniBtn}><Plus size={12} /></button>
                    <button type="button" title="Remove the last included item" disabled={!(it.features || []).length} onClick={() => commit(setAtPath(page, `sections.${page.sections.indexOf(section)}.content.plans.${i}.features`, (it.features || []).slice(0, -1)), { label: 'Removed an included item' })} style={miniBtn}><Minus size={12} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--ink-300)', marginTop: 8 }}>Click any text in the preview to change it.</p>
        </Block>
      )}
    </>
  );
}

const miniBtn = { width: 24, height: 24, borderRadius: 7, border: 0, background: 'white', color: 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };

// --- page ----------------------------------------------------------------------------

function PagePanel({ page, brandKit, commit }) {
  const kit = normalizeBrandKit(brandKit);
  const colors = page.theme?.colors || {};
  const presets = [{ id: 'brand', label: 'My brand', colors: kit.colors }, ...PALETTES];
  const sameColors = (a) => ['primary', 'accent', 'bg', 'text'].every((k) => (a[k] || '').toLowerCase() === (colors[k] || '').toLowerCase());
  const setL = (path, lang, value, label) => commit(setAtPath(page, path, { en: '', zh: '', ...(getAtPath(page, path) || {}), [lang]: value }), { label, mergeKey: `${path}.${lang}` });

  return (
    <>
      <p style={panelLabel}>Page</p>
      <Block title="Colours">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {presets.map((p) => {
            const on = sameColors(p.colors);
            return (
              <button key={p.id} type="button" onClick={() => commit(setTheme(page, { colors: { ...p.colors } }), { label: `Colours: ${p.label}` })}
                style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 7, borderRadius: 10, border: `1.5px solid ${on ? 'var(--accent-violet)' : 'rgba(183,169,154,0.3)'}`, background: 'white', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ display: 'flex', height: 16, borderRadius: 5, overflow: 'hidden' }}>{['primary', 'accent', 'bg', 'text'].map((k) => <span key={k} style={{ flex: 1, background: p.colors[k] }} />)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-700)', display: 'flex', alignItems: 'center', gap: 3 }}>{on && <Check size={11} />}{p.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          {[['primary', 'Main'], ['accent', 'Accent'], ['bg', 'Background'], ['text', 'Text']].map(([k, label]) => (
            <label key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-500)', fontWeight: 600 }}>
              <span style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', background: colors[k], border: '2px solid white', boxShadow: '0 0 0 1px rgba(80,69,56,0.2)', overflow: 'hidden' }}>
                <input type="color" value={colors[k] || '#000000'} onChange={(e) => commit(setTheme(page, { colors: { [k]: e.target.value.toUpperCase() } }), { label: 'Changed a colour', mergeKey: `color.${k}` })} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              </span>
              {label}
            </label>
          ))}
        </div>
      </Block>

      <Block title="Fonts">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {FONT_PAIRS.map((f) => {
            const on = (page.theme?.fontPair || kit.fontPair) === f.id;
            return (
              <button key={f.id} type="button" onClick={() => commit(setTheme(page, { fontPair: f.id }), { label: `Fonts: ${f.label}` })}
                style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 10px', borderRadius: 9, border: `1.5px solid ${on ? 'var(--accent-violet)' : 'rgba(183,169,154,0.3)'}`, background: 'white', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontFamily: `'${f.display}', serif`, fontWeight: 700, fontSize: 16 }}>Aa</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>{f.label}</span>
              </button>
            );
          })}
        </div>
      </Block>

      <Block title="Corners">
        <Segmented options={[{ id: 'sharp', label: 'Sharp' }, { id: 'soft', label: 'Soft' }, { id: 'round', label: 'Round' }]} value={page.theme?.radius || 'soft'}
          onChange={(v) => commit(setTheme(page, { radius: v }), { label: 'Changed corners' })} />
      </Block>

      <Block title="WhatsApp button">
        <label style={fieldLabel}>Button text (EN / 中文)</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input value={page.cta?.label?.en || ''} onChange={(e) => setL('cta.label', 'en', e.target.value, 'Changed button text')} placeholder="Chat on WhatsApp" style={inputStyle} />
          <input value={page.cta?.label?.zh || ''} onChange={(e) => setL('cta.label', 'zh', e.target.value, 'Changed button text')} placeholder="WhatsApp 咨询" style={inputStyle} />
        </div>
        <label style={fieldLabel}>WhatsApp number</label>
        <input value={page.whatsapp?.number || ''} onChange={(e) => commit(setAtPath(page, 'whatsapp.number', e.target.value), { label: 'Changed WhatsApp number', mergeKey: 'wa.number' })} placeholder="012-345 6789" inputMode="tel" style={{ ...inputStyle, marginBottom: 10 }} />
        <label style={fieldLabel}>Message the customer sends (EN / 中文)</label>
        <textarea rows={2} value={page.whatsapp?.message?.en || ''} onChange={(e) => setL('whatsapp.message', 'en', e.target.value, 'Changed WhatsApp message')} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', marginBottom: 6 }} />
        <textarea rows={2} value={page.whatsapp?.message?.zh || ''} onChange={(e) => setL('whatsapp.message', 'zh', e.target.value, 'Changed WhatsApp message')} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </Block>
      <TextLook page={page} path="cta.label" commit={commit} />
      <p style={{ fontSize: 11.5, color: 'var(--ink-300)', padding: '0 16px 20px' }}>Click a section in the preview to change its layout, or any text to edit it.</p>
    </>
  );
}

const fieldLabel = { display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-500)', marginBottom: 5 };

export default function EditorInspector({ page, brandKit, lang, selectedId, imagePath, textPath, commit, upload, onSelect, onCloseImage, onCloseText, ai, history }) {
  const section = page.sections.find((s) => s.id === selectedId);
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {history ? (
        <HistoryPanel {...history} />
      ) : imagePath ? (
        <PhotoPanel page={page} path={imagePath} commit={commit} upload={upload} onClose={onCloseImage} />
      ) : textPath ? (
        <TextPanel page={page} path={textPath} commit={commit} busy={ai?.busy} error={ai?.error} onRewrite={ai?.rewrite} onClose={onCloseText} />
      ) : section ? (
        <SectionPanel key={section.id} page={page} section={section} lang={lang} commit={commit} upload={upload} onDeleted={() => onSelect(null)} onSelect={onSelect} ai={ai} />
      ) : (
        <PagePanel page={page} brandKit={brandKit} commit={commit} />
      )}
    </div>
  );
}
