// Starting layouts and goals for "Create landing page". A layout fixes which
// sections the AI writes (and in what order and style); a goal steers the
// copy and suggests a layout. Shared by the create flow (live thumbnails)
// and the server (what to ask the AI for).

import { normalizeBrandKit } from '../brand.js';
import { SAMPLE_PAGE, defaultContent } from './schema.js';

export const LAYOUTS = [
  {
    id: 'complete',
    label: 'Complete',
    hint: 'Answers every question before they message',
    sections: [['hero', 'split'], ['features', 'bento'], ['steps', 'row'], ['pricing', 'tiers'], ['testimonials', 'cards'], ['faq', 'accordion'], ['cta', 'band'], ['contact', 'card']],
  },
  {
    id: 'simple',
    label: 'Simple',
    hint: 'Short and to the point',
    sections: [['hero', 'split'], ['features', 'list'], ['steps', 'row'], ['cta', 'band'], ['contact', 'card']],
  },
  {
    id: 'product',
    label: 'Product showcase',
    hint: 'Photos and prices up front',
    sections: [['hero', 'centered'], ['features', 'bento'], ['gallery', 'mosaic'], ['pricing', 'menu'], ['testimonials', 'spotlight'], ['faq', 'accordion'], ['contact', 'card']],
  },
  {
    id: 'event',
    label: 'Event',
    hint: 'Date, agenda and how to join',
    sections: [['hero', 'cover'], ['features', 'list'], ['steps', 'timeline'], ['faq', 'columns'], ['cta', 'card'], ['contact', 'card']],
  },
  {
    id: 'company',
    label: 'Company profile',
    hint: 'Who you are and why trust you',
    sections: [['hero', 'centered'], ['features', 'bento'], ['testimonials', 'spotlight'], ['gallery', 'strip'], ['cta', 'band'], ['contact', 'card']],
  },
];

export const GOALS = [
  { id: 'enquiries', label: 'Get WhatsApp enquiries', hint: 'People message you to ask or order', icon: 'message-circle', layout: 'complete', brief: 'Turn visitors into WhatsApp enquiries: make it easy to understand the offer and comfortable to message.' },
  { id: 'launch', label: 'Launch a product', hint: 'Introduce something new', icon: 'rocket', layout: 'product', brief: 'Introduce a new product: what it is, why it is better, what it costs, and how to get it.' },
  { id: 'promo', label: 'Promotion or sale', hint: 'Limited-time offer', icon: 'gift', layout: 'simple', brief: 'Promote a time-limited offer: lead with the deal, say clearly what is included and until when (only if the documents say), and push to message now.' },
  { id: 'event', label: 'Event sign-ups', hint: 'Workshop, opening, class', icon: 'calendar', layout: 'event', brief: 'Get people to sign up for an event: what, when, where, who it is for, and the agenda.' },
  { id: 'company', label: 'Company profile', hint: 'Build trust in your business', icon: 'building-store', layout: 'company', brief: 'Introduce the business: what it does, who it serves, why customers trust it.' },
];

export const layoutById = (id) => LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
export const goalById = (id) => GOALS.find((g) => g.id === id) || GOALS[0];

// A demo page in a layout, in the user's own brand colours and fonts, used
// for the layout picker's live thumbnails.
export function layoutPreviewPage(layoutId, brandKit) {
  const kit = normalizeBrandKit(brandKit);
  const sample = Object.fromEntries(SAMPLE_PAGE.sections.map((s) => [s.type, s.content]));
  const photo = (seed) => ({ url: `https://picsum.photos/seed/${seed}/900/700`, alt: { en: '', zh: '' } });
  return {
    ...SAMPLE_PAGE,
    theme: { colors: kit.colors, fontPair: kit.fontPair, radius: 'soft' },
    brand: { name: kit.companyName || SAMPLE_PAGE.brand.name, logoUrl: kit.logoUrl },
    sections: layoutById(layoutId).sections.map(([type, variant], i) => {
      let content = sample[type] || defaultContent(type);
      if (type === 'gallery') content = { ...content, images: [1, 2, 3, 4, 5].map((n) => photo(`ss-layout-${n}`)) };
      if (type === 'cta' && variant === 'card') content = { ...content, image: photo('ss-layout-cta') };
      return { id: `${type}-${i}`, type, variant, content };
    }),
  };
}
