// Per-text look set in the editor: colour, size, bold, alignment.
//
// A text inside a section is keyed by its path inside that section's
// content ("title", "items.0.text") and stored on the section as
// section.styles, so moving or duplicating a section keeps its look.
// Page-level texts (outside any section) live on page.styles.
//
// Only known values ever reach the CSS, so a page's JSON can't inject styles.

export const TEXT_COLORS = ['primary', 'accent', 'text', 'muted', 'white', 'black'];
export const TEXT_SIZES = { s: 0.85, l: 1.2, xl: 1.45 }; // 'm' (normal) = no override
const ALIGNS = new Set(['left', 'center', 'right']);
const HEX = /^#[0-9a-f]{6}$/i;

// "sections.3.content.items.0.title" -> { index: 3, key: "items.0.title" }
export function styleTarget(path) {
  const m = /^sections\.(\d+)\.content\.(.+)$/.exec(String(path || ''));
  return m ? { index: Number(m[1]), key: m[2] } : { index: null, key: String(path || '') };
}

export function getTextStyle(page, path) {
  const { index, key } = styleTarget(path);
  const holder = index === null ? page : page?.sections?.[index];
  return holder?.styles?.[key] || null;
}

// Returns a new page with the text's style changed. A patch value of null
// removes that property; an empty style is removed altogether.
export function setTextStyle(page, path, patch) {
  const { index, key } = styleTarget(path);
  const apply = (holder) => {
    const current = { ...(holder.styles?.[key] || {}), ...patch };
    Object.keys(current).forEach((k) => current[k] == null && delete current[k]);
    const styles = { ...(holder.styles || {}) };
    if (Object.keys(current).length) styles[key] = current;
    else delete styles[key];
    const next = { ...holder, styles };
    if (!Object.keys(styles).length) delete next.styles;
    return next;
  };
  if (index === null) return apply(page);
  return { ...page, sections: page.sections.map((s, i) => (i === index ? apply(s) : s)) };
}

export function colorCss(token) {
  if (HEX.test(token || '')) return token;
  if (token === 'white') return '#FFFFFF';
  if (token === 'black') return '#111111';
  if (TEXT_COLORS.includes(token)) return `var(--c-${token})`;
  return '';
}

// style -> inline CSS (empty string when nothing is set).
export function textStyleCss(st) {
  if (!st || typeof st !== 'object') return '';
  const out = [];
  const color = colorCss(st.color);
  if (color) out.push(`color:${color}`);
  // zoom, not font-size: each text's own size comes from a responsive
  // clamp() in its class, and zoom scales that instead of replacing it.
  if (TEXT_SIZES[st.size]) out.push(`zoom:${TEXT_SIZES[st.size]}`);
  if (st.bold === true) out.push('font-weight:800');
  if (st.bold === false) out.push('font-weight:400');
  if (st.italic === true) out.push('font-style:italic');
  // Block + auto margins so the text box itself moves too (many have a max-width).
  if (ALIGNS.has(st.align)) {
    out.push(`text-align:${st.align}`, 'display:block');
    if (st.align === 'center') out.push('margin-left:auto', 'margin-right:auto');
    if (st.align === 'right') out.push('margin-left:auto', 'margin-right:0');
    if (st.align === 'left') out.push('margin-left:0', 'margin-right:auto');
  }
  return out.join(';');
}
