// Post design format for the composer. A design is a size plus one or more
// pages (carousel slides); each page is a background photo with layers on
// top. Positions and sizes are FRACTIONS of the canvas (0..1, font sizes as a
// fraction of the width), so the same design adapts to every platform size.
// Colours are brand tokens ('primary', 'accent', ...) or hex, so switching
// brand colours restyles the whole post.

export const SIZES = {
  square: { id: 'square', label: 'Square 1:1', w: 1080, h: 1080 },
  portrait: { id: 'portrait', label: 'Portrait 4:5', w: 1080, h: 1350 },
  tall: { id: 'tall', label: 'RedNote 3:4', w: 1080, h: 1440 },
  landscape: { id: 'landscape', label: 'Wide 16:9', w: 1280, h: 720 },
};

export const PLATFORM_SIZE = { ig: 'portrait', fb: 'square', xhs: 'tall', yt: 'landscape' };

// OpenAI's gpt-image models only make these three shapes; the nearest one is used and
// cover-cropped onto the canvas.
export function imageGenSize(sizeId) {
  const { w, h } = SIZES[sizeId] || SIZES.square;
  const r = w / h;
  if (r > 1.2) return '1536x1024';
  if (r < 0.85) return '1024x1536';
  return '1024x1024';
}

export const COLOR_TOKENS = ['primary', 'accent', 'bg', 'text', 'white', 'black'];

export function resolveColor(token, colors = {}) {
  if (!token) return 'transparent';
  if (token.startsWith?.('#') || token.startsWith?.('rgb')) return token;
  return { white: '#FFFFFF', black: '#111111', ...colors }[token] || token;
}

let n = 0;
export const layerId = () => `l${Date.now().toString(36)}${(n += 1)}`;

const text = (role, props) => ({ id: layerId(), type: 'text', role, font: 'display', weight: 700, align: 'left', lineHeight: 1.08, rotation: 0, ...props });

// Starting layouts. `overlay` darkens/tints the photo so text stays readable.
export const TEMPLATES = [
  {
    id: 'bold-top',
    label: 'Bold headline',
    overlay: { color: 'black', opacity: 0.38, gradient: 'top' },
    layers: () => [
      text('headline', { x: 0.07, y: 0.08, w: 0.8, size: 0.095, color: 'white' }),
      text('subline', { x: 0.07, y: 0.36, w: 0.7, size: 0.04, color: 'white', font: 'body', weight: 500, lineHeight: 1.3 }),
      text('cta', { x: 0.07, y: 0.84, w: 0.38, size: 0.036, color: 'black', bg: 'primary', font: 'body', weight: 700, pad: 0.025, radius: 99, align: 'center' }),
      { id: layerId(), type: 'logo', x: 0.78, y: 0.85, w: 0.15 },
    ],
  },
  {
    id: 'bottom-band',
    label: 'Colour band',
    overlay: null,
    layers: () => [
      { id: layerId(), type: 'shape', shape: 'rect', x: 0, y: 0.64, w: 1, h: 0.36, fill: 'accent', opacity: 1, rotation: 0 },
      text('headline', { x: 0.07, y: 0.69, w: 0.86, size: 0.07, color: 'white' }),
      text('subline', { x: 0.07, y: 0.85, w: 0.52, size: 0.032, color: 'white', font: 'body', weight: 500, lineHeight: 1.3 }),
      text('cta', { x: 0.65, y: 0.86, w: 0.28, size: 0.03, color: 'black', bg: 'primary', font: 'body', weight: 700, pad: 0.02, radius: 99, align: 'center' }),
      { id: layerId(), type: 'logo', x: 0.06, y: 0.05, w: 0.16 },
    ],
  },
  {
    id: 'center-card',
    label: 'Centre card',
    overlay: { color: 'black', opacity: 0.18 },
    layers: () => [
      { id: layerId(), type: 'shape', shape: 'rect', x: 0.1, y: 0.28, w: 0.8, h: 0.44, fill: 'white', opacity: 0.94, radius: 0.03, rotation: 0 },
      text('headline', { x: 0.16, y: 0.33, w: 0.68, size: 0.068, color: 'accent', align: 'center' }),
      text('subline', { x: 0.16, y: 0.5, w: 0.68, size: 0.034, color: 'text', font: 'body', weight: 500, align: 'center', lineHeight: 1.3 }),
      text('cta', { x: 0.3, y: 0.62, w: 0.4, size: 0.032, color: 'white', bg: 'primary', font: 'body', weight: 700, pad: 0.02, radius: 99, align: 'center' }),
      { id: layerId(), type: 'logo', x: 0.42, y: 0.08, w: 0.16 },
    ],
  },
  {
    id: 'promo-badge',
    label: 'Promo badge',
    overlay: { color: 'black', opacity: 0.32, gradient: 'bottom' },
    layers: () => [
      { id: layerId(), type: 'shape', shape: 'circle', x: 0.66, y: 0.06, w: 0.28, h: 0.28, fill: 'primary', opacity: 1, rotation: 0 },
      text('badge', { x: 0.67, y: 0.14, w: 0.26, size: 0.05, color: 'black', align: 'center', rotation: -8 }),
      text('headline', { x: 0.07, y: 0.62, w: 0.86, size: 0.085, color: 'white' }),
      text('subline', { x: 0.07, y: 0.82, w: 0.7, size: 0.036, color: 'white', font: 'body', weight: 500, lineHeight: 1.3 }),
      { id: layerId(), type: 'logo', x: 0.07, y: 0.07, w: 0.15 },
    ],
  },
  {
    id: 'split',
    label: 'Split panel',
    overlay: null,
    layers: () => [
      { id: layerId(), type: 'shape', shape: 'rect', x: 0, y: 0, w: 0.48, h: 1, fill: 'bg', opacity: 1, rotation: 0 },
      { id: layerId(), type: 'logo', x: 0.06, y: 0.06, w: 0.16 },
      text('headline', { x: 0.06, y: 0.3, w: 0.38, size: 0.062, color: 'accent' }),
      text('subline', { x: 0.06, y: 0.56, w: 0.38, size: 0.03, color: 'text', font: 'body', weight: 500, lineHeight: 1.35 }),
      text('cta', { x: 0.06, y: 0.82, w: 0.36, size: 0.03, color: 'white', bg: 'primary', font: 'body', weight: 700, pad: 0.02, radius: 99, align: 'center' }),
    ],
  },
  {
    id: 'quote',
    label: 'Quote',
    overlay: { color: 'accent', opacity: 0.62 },
    layers: () => [
      text('headline', { x: 0.1, y: 0.3, w: 0.8, size: 0.066, color: 'white', align: 'center', lineHeight: 1.2 }),
      text('subline', { x: 0.1, y: 0.62, w: 0.8, size: 0.032, color: 'white', font: 'body', weight: 600, align: 'center' }),
      { id: layerId(), type: 'logo', x: 0.42, y: 0.82, w: 0.16 },
    ],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    overlay: { color: 'black', opacity: 0.3, gradient: 'bottom' },
    layers: () => [
      text('headline', { x: 0.07, y: 0.74, w: 0.75, size: 0.058, color: 'white' }),
      text('subline', { x: 0.07, y: 0.88, w: 0.7, size: 0.03, color: 'white', font: 'body', weight: 500 }),
      { id: layerId(), type: 'logo', x: 0.8, y: 0.06, w: 0.14 },
    ],
  },
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

// copy: { headline, subline, cta, badge }
function fillLayers(layers, copy) {
  return layers
    .map((l) => (l.type === 'text' && l.role in (copy || {}) ? { ...l, text: copy[l.role] || '' } : l))
    .filter((l) => l.type !== 'text' || (l.text || '').trim() || l.role === 'custom');
}

// Each page remembers its own layout, so carousel slides can differ.
const makePage = (t, copy, url, overlay = t.overlay) => ({ id: layerId(), templateId: t.id, background: { url, overlay }, layers: fillLayers(t.layers(), copy) });

export function createDesign({ sizeId = 'square', templateId, copy, backgroundUrl = '' }) {
  const t = templateById(templateId);
  return { version: 1, size: sizeId, templateId: t.id, pages: [makePage(t, copy, backgroundUrl)] };
}

// A carousel: one page per slide's words, all on the same photo, each slide
// in its own layout (templateIds[i], else the first one). The cover keeps
// its layout's look; the slides after it darken the photo more so the words
// stay readable (layouts with their own text panel are left as is).
export const MAX_SLIDES = 10;

export function createCarouselDesign({ sizeId = 'square', templateIds = [], slides, backgroundUrl = '' }) {
  const pages = slides.slice(0, MAX_SLIDES).map((copy, i) => {
    const t = templateById(templateIds[i] || templateIds[0]);
    const inner = t.overlay && { ...t.overlay, opacity: Math.max(t.overlay.opacity, 0.55) };
    return makePage(t, copy, backgroundUrl, i === 0 ? t.overlay : inner);
  });
  return { version: 1, size: sizeId, templateId: pages[0].templateId, pages };
}

// The layout a page is in (older designs only stored one for the whole post).
export const pageTemplateId = (design, page) => page?.templateId || design?.templateId;

// Switch a page's layout, keeping its words (by role) and photo.
export function applyTemplate(page, templateId) {
  const t = templateById(templateId);
  const copy = {};
  page.layers.forEach((l) => { if (l.type === 'text' && l.role !== 'custom') copy[l.role] = l.text; });
  const custom = page.layers.filter((l) => l.type === 'text' && l.role === 'custom');
  return { ...page, templateId: t.id, background: { ...page.background, overlay: t.overlay }, layers: [...fillLayers(t.layers(), copy), ...custom] };
}

export function newTextLayer() {
  return text('custom', { x: 0.2, y: 0.45, w: 0.6, size: 0.05, color: 'white', text: 'Your text', align: 'center' });
}

// A picture on top of the background (a product shot, a second photo...).
// `aspect` is height / width, used to keep it inside the canvas.
export function newImageLayer(url, aspect = 1, canvasAspect = 1) {
  const w = Math.min(0.5, 0.7 / Math.max(0.2, aspect * canvasAspect));
  return { id: layerId(), type: 'image', url, x: (1 - w) / 2, y: Math.max(0.05, (1 - w * aspect * canvasAspect) / 2), w, opacity: 1, radius: 0, rotation: 0 };
}

export function newShapeLayer(shape = 'rect') {
  return { id: layerId(), type: 'shape', shape, x: 0.3, y: 0.3, w: shape === 'circle' ? 0.25 : 0.4, h: shape === 'circle' ? 0.25 : 0.15, fill: 'primary', opacity: 1, radius: shape === 'pill' ? 99 : 0, rotation: 0 };
}

// Old posts (just finished images + caption) become a design with the old
// image as the background, so they open in the composer too.
export function designFromOldPost(post, sizeId) {
  const imgs = (post?.images || []).map((i) => i?.img).filter(Boolean);
  return {
    version: 1,
    size: sizeId || 'square',
    templateId: 'minimal',
    pages: (imgs.length ? imgs : ['']).map((url) => ({ id: layerId(), background: { url, overlay: null }, layers: [] })),
  };
}
