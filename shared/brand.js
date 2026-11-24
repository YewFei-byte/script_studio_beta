// Brand Kit presets, shared by the Brand settings page, the landing page
// renderer and (later) the post composer, so a brand looks the same
// everywhere. Plain ESM, no browser/Node APIs.

// Display + body font pairs. All on Google Fonts; `families` is the
// css2?family= query for loading both. Sans pairs come first and are the
// default; the serif pairs are opt-in for brands that genuinely suit them.
export const FONT_PAIRS = [
  { id: 'spacegrotesk-manrope', label: 'Modern', display: 'Space Grotesk', body: 'Manrope', families: 'family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700' },
  { id: 'bricolage-dmsans', label: 'Warm & friendly', display: 'Bricolage Grotesque', body: 'DM Sans', families: 'family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@400;500;700' },
  { id: 'syne-worksans', label: 'Bold & loud', display: 'Syne', body: 'Work Sans', families: 'family=Syne:wght@600;700;800&family=Work+Sans:wght@400;500;600' },
  { id: 'outfit-outfit', label: 'Clean & simple', display: 'Outfit', body: 'Outfit', families: 'family=Outfit:wght@400;500;600;700;800' },
  { id: 'playfair-outfit', label: 'Elegant (serif)', display: 'Playfair Display', body: 'Outfit', families: 'family=Playfair+Display:wght@600;700;800&family=Outfit:wght@400;500;600;700' },
  { id: 'newsreader-jakarta', label: 'Editorial (serif)', display: 'Newsreader', body: 'Plus Jakarta Sans', families: 'family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&family=Plus+Jakarta+Sans:wght@400;500;600;700' },
  { id: 'notoserif-notosans', label: 'Classic (best for 中文)', display: 'Noto Serif SC', body: 'Noto Sans SC', families: 'family=Noto+Serif+SC:wght@600;700&family=Noto+Sans+SC:wght@400;500;700' },
];

export const DEFAULT_FONT_PAIR = 'spacegrotesk-manrope';

export function fontPairById(id) {
  return FONT_PAIRS.find((p) => p.id === id) || FONT_PAIRS[0];
}

// withChinese: also load Noto Sans SC so 中文 text renders consistently.
export function googleFontsHref(fontPairId, { withChinese = false } = {}) {
  const pair = fontPairById(fontPairId);
  const zh = withChinese && !pair.families.includes('Noto+Sans+SC') ? '&family=Noto+Sans+SC:wght@400;500;700' : '';
  return `https://fonts.googleapis.com/css2?${pair.families}${zh}&display=swap`;
}

// primary = buttons/highlights, accent = headings/dark surfaces,
// bg = page background, surface = cards, text = body copy.
export const PALETTES = [
  { id: 'presoft', label: 'Presoft amber', colors: { primary: '#F2AA24', accent: '#504538', bg: '#F2F1EF', surface: '#FFFFFF', text: '#2B241C' } },
  { id: 'forest', label: 'Forest', colors: { primary: '#2F8F5B', accent: '#1F3B2D', bg: '#F4F7F2', surface: '#FFFFFF', text: '#1C2A22' } },
  { id: 'ocean', label: 'Ocean', colors: { primary: '#1F7AE0', accent: '#0F2A4A', bg: '#F3F7FC', surface: '#FFFFFF', text: '#14243A' } },
  { id: 'berry', label: 'Berry', colors: { primary: '#D6336C', accent: '#4A1530', bg: '#FDF4F7', surface: '#FFFFFF', text: '#2E1420' } },
  { id: 'terracotta', label: 'Terracotta', colors: { primary: '#D9663B', accent: '#4A2A1E', bg: '#FBF5F0', surface: '#FFFFFF', text: '#2F1D15' } },
  { id: 'midnight', label: 'Midnight', colors: { primary: '#F5C451', accent: '#F2EEE6', bg: '#14161C', surface: '#1E2129', text: '#E9E6DF' } },
];

export const TONES = [
  { id: 'friendly', label: 'Friendly' },
  { id: 'professional', label: 'Professional' },
  { id: 'playful', label: 'Playful' },
  { id: 'premium', label: 'Premium' },
  { id: 'informative', label: 'Informative' },
];

export const EMPTY_BRAND_KIT = {
  companyName: '',
  tagline: '',
  logoUrl: '',
  colors: { ...PALETTES[0].colors },
  fontPair: DEFAULT_FONT_PAIR,
  tone: 'friendly',
  whatsapp: { number: '', message: '' },
  // Sections that only make sense for some businesses, switched on here
  // before they appear in the landing page section library.
  optionalSections: { video: false },
};

// Fills in any missing fields so older/partial saved kits are always safe
// to read.
export function normalizeBrandKit(kit) {
  const k = kit && typeof kit === 'object' ? kit : {};
  return {
    ...EMPTY_BRAND_KIT,
    ...k,
    colors: { ...EMPTY_BRAND_KIT.colors, ...(k.colors || {}) },
    whatsapp: { ...EMPTY_BRAND_KIT.whatsapp, ...(k.whatsapp || {}) },
    optionalSections: { ...EMPTY_BRAND_KIT.optionalSections, ...(k.optionalSections || {}) },
  };
}

// WhatsApp click-to-chat link. Accepts "+60 12-345 6789", "012-3456789"
// (Malaysian local, leading 0 -> 60), etc.
export function whatsappLink(number, message) {
  let digits = String(number || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = `60${digits.slice(1)}`;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
