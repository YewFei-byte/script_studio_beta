import React, { forwardRef } from 'react';
import { AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignLeft, AlignRight, AlignStartHorizontal, AlignStartVertical, ArrowDownToLine, ArrowUpToLine, Bold, Copy, ImagePlus, Loader2, Maximize, Palette, Trash2 } from 'lucide-react';
import { Segmented } from '../../components/settings/SettingsUI';
import { COLOR_TOKENS, resolveColor } from './design';

// Right-panel "Design" tab of the post composer: properties of the selected
// layer, or of the slide (photo darkening) when nothing is selected.

const TOKEN_LABEL = { primary: 'Main', accent: 'Accent', bg: 'Light', text: 'Text', white: 'White', black: 'Black' };

function Block({ title, children }) {
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', marginBottom: 8 }}>{title}</p>
      {children}
    </div>
  );
}

function Swatches({ value, colors, onChange, allowNone }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {allowNone && (
        <button type="button" title="None" onClick={() => onChange(null)}
          style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${!value ? 'var(--accent-violet)' : 'rgba(80,69,56,0.2)'}`, background: 'linear-gradient(135deg, white 45%, #e33 46%, #e33 54%, white 55%)', cursor: 'pointer' }} />
      )}
      {COLOR_TOKENS.map((t) => (
        <button key={t} type="button" title={TOKEN_LABEL[t]} onClick={() => onChange(t)}
          style={{ width: 28, height: 28, borderRadius: '50%', background: resolveColor(t, colors), border: `2px solid ${value === t ? 'var(--accent-violet)' : 'white'}`, boxShadow: '0 0 0 1px rgba(80,69,56,0.2)', cursor: 'pointer' }} />
      ))}
      <label title="Custom colour" style={{ position: 'relative', width: 28, height: 28, borderRadius: '50%', background: value?.startsWith?.('#') ? value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)', boxShadow: '0 0 0 1px rgba(80,69,56,0.2)', overflow: 'hidden', cursor: 'pointer' }}>
        <input type="color" value={value?.startsWith?.('#') ? value : '#ffffff'} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
      </label>
    </div>
  );
}

function Slider({ value, min, max, step, onChange, format }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, accentColor: '#F2AA24' }} />
      <span style={{ fontSize: 12, color: 'var(--ink-500)', width: 40, textAlign: 'right' }}>{format ? format(value) : value}</span>
    </div>
  );
}

const iconBtn = (on) => ({ width: 34, height: 32, borderRadius: 9, border: `1px solid ${on ? 'var(--accent-violet)' : 'rgba(80,69,56,0.14)'}`, background: on ? 'rgba(242,170,36,0.12)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ink-700)' });

// Line the layer up with the edges or centre of the post.
const ALIGNS = [
  ['left', 'Move to the left edge', AlignStartVertical], ['center', 'Centre left to right', AlignCenterVertical], ['right', 'Move to the right edge', AlignEndVertical],
  ['top', 'Move to the top', AlignStartHorizontal], ['middle', 'Centre top to bottom', AlignCenterHorizontal], ['bottom', 'Move to the bottom', AlignEndHorizontal],
];

const LayerActions = ({ onDuplicate, onDelete, onForward, onBackward, onAlign }) => (
  <>
  {onAlign && (
    <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px' }}>
      {ALIGNS.map(([id, title, Icon]) => (
        <button key={id} type="button" title={title} aria-label={title} onClick={() => onAlign(id)} style={iconBtn(false)}><Icon size={15} /></button>
      ))}
    </div>
  )}
  <div style={{ display: 'flex', gap: 6, padding: '0 16px 16px' }}>
    <button type="button" title="Bring to front" onClick={onForward} style={iconBtn(false)}><ArrowUpToLine size={15} /></button>
    <button type="button" title="Send to back" onClick={onBackward} style={iconBtn(false)}><ArrowDownToLine size={15} /></button>
    <button type="button" title="Duplicate" onClick={onDuplicate} style={iconBtn(false)}><Copy size={15} /></button>
    <button type="button" title="Delete" onClick={onDelete} style={{ ...iconBtn(false), color: 'var(--accent-coral)' }}><Trash2 size={15} /></button>
  </div>
  </>
);

const wideBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid rgba(80,69,56,0.14)', background: 'white', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer' };

const PostInspector = forwardRef(function PostInspector({ layer, page, colors, hasLogo, onOpenBrand, picture, onLayer, onPage, actions }, textRef) {
  const title = { fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '14px 16px 10px', margin: 0 };

  if (!layer) {
    const o = page?.background?.overlay;
    const mode = !o ? 'none' : o.gradient ? 'fade' : 'full';
    return (
      <>
        <p style={title}>Slide</p>
        <Block title="Darken the photo (so text is easy to read)">
          <Segmented options={[{ id: 'none', label: 'None' }, { id: 'fade', label: 'Fade' }, { id: 'full', label: 'Even' }]} value={mode}
            onChange={(m) => onPage({ overlay: m === 'none' ? null : { color: o?.color || 'black', opacity: o?.opacity ?? 0.35, gradient: m === 'fade' ? (o?.gradient || 'bottom') : undefined } })} />
          {o && (
            <>
              <div style={{ height: 10 }} />
              <Slider value={o.opacity} min={0.05} max={0.9} step={0.05} onChange={(v) => onPage({ overlay: { ...o, opacity: v } })} format={(v) => `${Math.round(v * 100)}%`} />
              <div style={{ height: 10 }} />
              <Swatches value={o.color} colors={colors} onChange={(c) => onPage({ overlay: { ...o, color: c || 'black' } })} />
            </>
          )}
        </Block>
        <p style={{ fontSize: 12, color: 'var(--ink-300)', padding: '0 16px' }}>Click any text, shape or the logo on the canvas to change it. Double-click text to type.</p>
      </>
    );
  }

  if (layer.type === 'text') {
    return (
      <>
        <p style={title}>Text</p>
        <Block title="Words">
          <textarea ref={textRef} value={layer.text || ''} rows={3} onChange={(e) => onLayer({ text: e.target.value }, 'Edited text')}
            style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid rgba(183,169,154,0.45)', background: 'white', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
        </Block>
        <Block title="Style">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <Segmented options={[{ id: 'display', label: 'Headline font' }, { id: 'body', label: 'Body font' }]} value={layer.font || 'display'} onChange={(v) => onLayer({ font: v }, 'Changed font')} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button type="button" title="Bold" onClick={() => onLayer({ weight: layer.weight >= 600 ? 500 : 700 }, 'Changed weight')} style={iconBtn(layer.weight >= 600)}><Bold size={15} /></button>
            {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, Icon]) => (
              <button key={a} type="button" title={`Align ${a}`} onClick={() => onLayer({ align: a }, 'Changed alignment')} style={iconBtn((layer.align || 'left') === a)}><Icon size={15} /></button>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--ink-500)', marginBottom: 4 }}>Size</p>
          <Slider value={layer.size} min={0.018} max={0.16} step={0.002} onChange={(v) => onLayer({ size: v }, 'Changed size', 'size')} format={(v) => Math.round(v * 1000)} />
        </Block>
        <Block title="Colour"><Swatches value={layer.color} colors={colors} onChange={(c) => onLayer({ color: c || 'white' }, 'Changed colour')} /></Block>
        <Block title="Button background">
          <Swatches value={layer.bg} colors={colors} allowNone onChange={(c) => onLayer(c ? { bg: c, pad: layer.pad || 0.02, radius: layer.radius ?? 99 } : { bg: null }, 'Changed background')} />
        </Block>
        <LayerActions {...actions} />
      </>
    );
  }

  if (layer.type === 'image') {
    return (
      <>
        <p style={title}>Picture</p>
        <Block title="Picture">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ ...wideBtn, opacity: picture?.busy ? 0.5 : 1 }}>
              {picture?.busy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} {picture?.busy ? 'Uploading…' : 'Replace picture'}
              <input type="file" accept="image/*" hidden disabled={picture?.busy} onChange={(e) => { picture?.onReplace(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <button type="button" style={wideBtn} onClick={picture?.onMakeBackground}><Maximize size={14} /> Use as the background</button>
          </div>
        </Block>
        <Block title="Size">
          <Slider value={layer.w} min={0.05} max={1} step={0.01} onChange={(v) => onLayer({ w: v }, 'Resized picture', 'pic-size')} format={(v) => `${Math.round(v * 100)}%`} />
        </Block>
        <Block title="See-through">
          <Slider value={layer.opacity ?? 1} min={0.1} max={1} step={0.05} onChange={(v) => onLayer({ opacity: v }, 'Changed opacity', 'opacity')} format={(v) => `${Math.round(v * 100)}%`} />
        </Block>
        <Block title="Corners">
          <Segmented options={[{ id: 0, label: 'Square' }, { id: 0.03, label: 'Soft' }, { id: 99, label: 'Round' }]} value={layer.radius >= 99 ? 99 : layer.radius ? 0.03 : 0}
            onChange={(v) => onLayer({ radius: v }, 'Changed corners')} />
        </Block>
        <LayerActions {...actions} />
      </>
    );
  }

  if (layer.type === 'shape') {
    return (
      <>
        <p style={title}>Shape</p>
        <Block title="Colour"><Swatches value={layer.fill} colors={colors} onChange={(c) => onLayer({ fill: c || 'primary' }, 'Changed colour')} /></Block>
        <Block title="See-through">
          <Slider value={layer.opacity ?? 1} min={0.1} max={1} step={0.05} onChange={(v) => onLayer({ opacity: v }, 'Changed opacity', 'opacity')} format={(v) => `${Math.round(v * 100)}%`} />
        </Block>
        {layer.shape !== 'circle' && (
          <Block title="Corners">
            <Segmented options={[{ id: 0, label: 'Square' }, { id: 0.02, label: 'Soft' }, { id: 99, label: 'Pill' }]} value={layer.radius >= 99 ? 99 : layer.radius ? 0.02 : 0}
              onChange={(v) => onLayer({ radius: v }, 'Changed corners')} />
          </Block>
        )}
        <LayerActions {...actions} />
      </>
    );
  }

  return (
    <>
      <p style={title}>Logo</p>
      {!hasLogo && (
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 8 }}>No logo yet. Add it once and it shows on every post and page.</p>
          {onOpenBrand && <button type="button" style={{ ...wideBtn, borderColor: 'var(--accent-violet)', color: '#8A5A00', background: 'rgba(242,170,36,0.08)' }} onClick={onOpenBrand}><Palette size={14} /> Add my logo</button>}
        </div>
      )}
      <Block title="Size">
        <Slider value={layer.w} min={0.05} max={0.6} step={0.01} onChange={(v) => onLayer({ w: v }, 'Resized logo', 'logo-size')} format={(v) => `${Math.round(v * 100)}%`} />
      </Block>
      <LayerActions {...actions} />
    </>
  );
});

export default PostInspector;
