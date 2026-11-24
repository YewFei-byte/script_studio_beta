// "Create landing page": one structured Claude call that writes the copy for
// a chosen layout, in English and Simplified Chinese, as page JSON (see
// shared/landing/schema.js). Design comes from the renderer + Brand Kit, so
// the AI only writes words: far fewer tokens than HTML/CSS/JS, and the
// result is always valid and editable.

import { ConfigError, claudeJSON, resolveAiConfig } from './ai.js';
import { normalizeBrandKit, TONES } from '../shared/brand.js';
import { FEATURE_ICONS, newSectionId } from '../shared/landing/schema.js';
import { goalById, layoutById } from '../shared/landing/layouts.js';

const str = { type: 'string' };
const L = { type: 'object', properties: { en: str, zh: str }, required: ['en', 'zh'], additionalProperties: false };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items) => ({ type: 'array', items });

// What the AI writes for each section type. Images, ids, layout variants
// and the theme are added by the server, never by the AI.
const CONTENT_SCHEMA = {
  hero: obj({ eyebrow: L, title: L, subtitle: L }),
  features: obj({ title: L, intro: L, items: list(obj({ icon: { type: 'string', enum: FEATURE_ICONS }, title: L, text: L })) }),
  steps: obj({ title: L, items: list(obj({ title: L, text: L })) }),
  pricing: obj({ title: L, intro: L, plans: list(obj({ name: L, price: str, period: L, features: list(L), highlighted: { type: 'boolean' } })) }),
  testimonials: obj({ title: L, items: list(obj({ quote: L, name: str, role: L })) }),
  gallery: obj({ title: L }),
  video: obj({ title: L, text: L }),
  faq: obj({ title: L, items: list(obj({ q: L, a: L })) }),
  cta: obj({ title: L, text: L }),
  contact: obj({ title: L, text: L, address: L, hours: L, phone: str, email: str }),
};

// Per-section guidance, only included for sections in the chosen layout.
const SECTION_RULES = {
  hero: 'hero: title max 7 words, says the main benefit plainly. subtitle max 20 words. eyebrow: 1-3 words naming the category, or empty.',
  features: 'features: exactly 3 items (4 only if the documents clearly have 4 strong points). Item title max 5 words, text max 16 words. intro max 14 words or empty. Pick the icon that best fits each item.',
  steps: 'steps: 3 items (4 max), each a short action the customer takes or experiences, title max 4 words, text max 12 words. For events, the steps are the agenda.',
  pricing: 'pricing: ONLY prices stated in the documents, copied exactly (e.g. "RM 119"). 1-3 plans, mark the best value highlighted. 2-4 features per plan, max 6 words each. If the documents have no prices, return an empty plans array.',
  testimonials: 'testimonials: ONLY real reviews quoted in the documents, with the real name. Max 25 words per quote. If the documents contain no real reviews, return an empty items array. Never invent reviews or names.',
  gallery: 'gallery: a short title for the photo section.',
  video: 'video: a short title and one line, or empty text.',
  faq: 'faq: 3-6 questions customers really ask before buying (price, delivery, minimum order, payment, location, how to book). Answers max 30 words, only facts from the documents; if unknown, suggest messaging on WhatsApp.',
  cta: 'cta: a last push to message on WhatsApp. title max 7 words, text max 18 words.',
  contact: 'contact: address, opening hours, phone and email ONLY if in the documents, otherwise empty strings. title max 5 words.',
};

const SYSTEM = `You write the words for small-business landing pages in Malaysia. The design is already done; you only fill in the copy, as JSON.

Rules for every piece of text:
- Plain, concrete, friendly language a busy customer understands in one read. Short sentences.
- Facts only from the business's documents. Never invent prices, numbers, statistics, awards, certifications, reviews or names. If a fact is missing, write around it.
- No filler words: elevate, seamless, unleash, revolutionize, next-gen, cutting-edge, world-class, one-stop.
- No em dashes or en dashes. Use commas, full stops or a normal hyphen.
- No emojis. No exclamation marks in headlines.
- "en" is natural English. "zh" is natural Simplified Chinese written for Malaysian Chinese readers (not a word-for-word translation). Keep brand and product names as written in the documents.
- brand_name: the business or brand name exactly as the documents write it.
- The page has ONE call to action: messaging the business on WhatsApp. cta_label is max 3 English words (e.g. "Chat on WhatsApp", "WhatsApp us"). whatsapp_message is what the CUSTOMER sends, written as the customer, max 15 words.`;

// Strict structured output compiles the schema into a grammar with a size
// limit; a whole 8-section bilingual page is over it. So the sections are
// split into groups (by rough schema weight) written by parallel calls, and
// only the first group also writes the page-wide button label/message.
const WEIGHT = { hero: 1, features: 2, steps: 1, pricing: 3, testimonials: 2, gallery: 1, video: 1, faq: 2, cta: 1, contact: 1 };
const MAX_GROUP_WEIGHT = 7;

function groupSections(types) {
  const groups = [];
  let cur = [];
  let w = 0;
  for (const t of types) {
    if (cur.length && w + WEIGHT[t] > MAX_GROUP_WEIGHT) {
      groups.push(cur);
      cur = [];
      w = 0;
    }
    cur.push(t);
    w += WEIGHT[t];
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function buildSchema(types, { withPageFields = true } = {}) {
  const sections = obj(Object.fromEntries(types.map((t) => [t, CONTENT_SCHEMA[t]])));
  return withPageFields ? obj({ brand_name: str, cta_label: L, whatsapp_message: L, sections }) : obj({ sections });
}

function buildUserMessage({ goal, layout, brand, context, notes, types }) {
  const kit = normalizeBrandKit(brand);
  const tone = TONES.find((t) => t.id === kit.tone)?.label || 'Friendly';
  const all = layout.sections.map(([t]) => t);
  return [
    `GOAL: ${goal.brief}`,
    `BUSINESS: ${kit.companyName || '(use the name from the documents)'}${kit.tagline ? `. Tagline: ${kit.tagline}` : ''}`,
    `VOICE: ${tone}`,
    notes ? `THE OWNER ASKS: ${notes}` : '',
    `WHOLE PAGE, in order: ${all.join(', ')}`,
    `YOU WRITE ONLY THESE SECTIONS NOW: ${types.join(', ')} (other sections are written separately; do not repeat the same points across sections).`,
    'Section rules:',
    ...types.map((t) => `- ${SECTION_RULES[t]}`),
    context?.trim()
      ? `<documents>\n${context.trim()}\n</documents>`
      : 'There are no documents. Keep claims general, and leave pricing, testimonials and contact details empty.',
  ]
    .filter(Boolean)
    .join('\n');
}

// Turns the AI's answer + the user's photos into a page (schema.js shape).
function assemblePage({ ai, layout, brand, photos }) {
  const kit = normalizeBrandKit(brand);
  const pics = (photos || []).filter((u) => typeof u === 'string' && u).map((url) => ({ url, alt: { en: kit.companyName || '', zh: '' } }));
  const heroPic = pics[0] || null;
  const otherPics = pics.slice(1);

  const sections = [];
  for (const [type, variant] of layout.sections) {
    const content = structuredClone(ai.sections?.[type] || {});
    if (type === 'testimonials' && !content.items?.length) continue;
    if (type === 'pricing' && !content.plans?.length) continue;
    if (type === 'gallery') {
      if (!pics.length) continue;
      content.images = pics;
    }
    if (type === 'hero') content.image = heroPic;
    if (type === 'cta') content.image = otherPics[0] || heroPic;
    if (type === 'contact') {
      content.phone = content.phone || '';
      content.email = content.email || '';
      content.mapUrl = '';
    }
    if (type === 'video') content.url = '';
    sections.push({ id: newSectionId(type), type, variant, content });
  }

  return {
    version: 1,
    theme: { colors: kit.colors, fontPair: kit.fontPair, radius: 'soft' },
    brand: { name: kit.companyName || ai.brand_name || '', logoUrl: kit.logoUrl },
    cta: { label: ai.cta_label },
    whatsapp: { number: kit.whatsapp.number, message: kit.whatsapp.message ? { en: kit.whatsapp.message, zh: ai.whatsapp_message?.zh || '' } : ai.whatsapp_message },
    sections,
  };
}

export async function buildLandingPage(pool, { goal: goalId, layout: layoutId, brand, context, notes, photos }) {
  const goal = goalById(goalId);
  const layout = layoutById(layoutId);
  const { anthropicKey, model } = await resolveAiConfig(pool);
  if (!anthropicKey) {
    throw new ConfigError('No Claude API key is set for landing pages. Add one under Settings → API (or set ANTHROPIC_API_KEY on the server).');
  }
  const cleanNotes = typeof notes === 'string' ? notes.slice(0, 600) : '';
  const groups = groupSections(layout.sections.map(([t]) => t));
  const parts = await Promise.all(
    groups.map((types, i) =>
      claudeJSON({
        apiKey: anthropicKey,
        model,
        effort: 'medium',
        maxTokens: 10000,
        system: SYSTEM,
        user: buildUserMessage({ goal, layout, brand, context, notes: cleanNotes, types }),
        schema: buildSchema(types, { withPageFields: i === 0 }),
      })
    )
  );
  const ai = { ...parts[0], sections: Object.assign({}, ...parts.map((p) => p.sections)) };
  return assemblePage({ ai, layout, brand, photos });
}

export { buildSchema as _buildSchema, groupSections as _groupSections };

// --- Editor AI actions ----------------------------------------------------------
// Small, targeted calls from the editor's ✨ buttons. Each sends only what it
// needs (one text, or one section), so they cost a fraction of a full page.

async function aiConfig(pool) {
  const { anthropicKey, model } = await resolveAiConfig(pool);
  if (!anthropicKey) {
    throw new ConfigError('No Claude API key is set. Add one under Settings → API (or set ANTHROPIC_API_KEY on the server).');
  }
  return { apiKey: anthropicKey, model };
}

// What kind of text a path points at, so length limits fit the slot.
function fieldRole(path, sectionType) {
  const key = String(path || '').split('.').pop();
  if (sectionType === 'hero' && key === 'title') return 'the main headline of the page (max 7 words)';
  return (
    {
      title: 'a heading (max 7 words)',
      subtitle: 'a short supporting line (max 20 words)',
      eyebrow: 'a tiny label above the headline (1-3 words)',
      intro: 'a one-line section intro (max 14 words)',
      text: 'a short description (max 18 words)',
      q: 'a customer question (max 12 words)',
      a: 'an answer (max 30 words)',
      quote: 'a customer quote (keep the meaning; never invent new claims)',
      name: 'a name or plan name (1-4 words)',
      period: 'a price note such as "per month" (1-4 words)',
      label: 'a button label (max 3 words)',
      message: 'the WhatsApp message the customer sends, written as the customer (max 15 words)',
    }[key] || 'a short piece of website copy'
  );
}

const REWRITES = {
  shorter: 'Make it noticeably shorter and punchier. Keep the meaning.',
  friendlier: 'Make it warmer and friendlier, like talking to a neighbour. Keep it professional.',
  persuasive: 'Make it more persuasive: lead with the customer benefit, be concrete. No hype words.',
  formal: 'Make it more formal and polished.',
  fix: 'Fix grammar, spelling and awkward phrasing only. Change as little as possible.',
  'to-zh': 'Write the Chinese version from the English. Keep "en" exactly as given.',
  'to-en': 'Write the English version from the Chinese. Keep "zh" exactly as given.',
};

const TEXT_SCHEMA = obj({ en: str, zh: str });

// POST /api/landing/rewrite -> { en, zh }
export async function rewriteText(pool, { text, path, sectionType, action, brand, pageTitle }) {
  const how = REWRITES[action];
  if (!how) throw new ConfigError('Unknown rewrite.');
  const current = { en: String(text?.en || ''), zh: String(text?.zh || '') };
  if (!current.en.trim() && !current.zh.trim()) throw new ConfigError('There is no text to rewrite yet. Type something first.');
  const kit = normalizeBrandKit(brand);
  const voice = TONES.find((t) => t.id === kit.tone)?.label || 'Friendly';
  return claudeJSON({
    ...(await aiConfig(pool)),
    effort: 'low',
    maxTokens: 2000,
    system: SYSTEM,
    user: [
      `BUSINESS: ${kit.companyName || '(unnamed)'}. VOICE: ${voice}.`,
      pageTitle ? `PAGE HEADLINE: ${pageTitle}` : '',
      `THIS TEXT IS: ${fieldRole(path, sectionType)}`,
      `CURRENT TEXT: ${JSON.stringify(current)}`,
      `TASK: ${how} Return both languages; unless the task says otherwise, rewrite "en" and "zh" together so they say the same thing. If one language is empty, write it from the other.`,
    ]
      .filter(Boolean)
      .join('\n'),
    schema: TEXT_SCHEMA,
  });
}

// POST /api/landing/section -> { content }
// Writes one section from the documents (a newly added, empty section), or
// changes an existing one following the owner's request.
export async function writeSection(pool, { type, goal: goalId, brand, context, pageSummary, current, request }) {
  const schema = CONTENT_SCHEMA[type];
  if (!schema) throw new ConfigError('This section type cannot be written by AI.');
  const goal = goalById(goalId);
  const kit = normalizeBrandKit(brand);
  const voice = TONES.find((t) => t.id === kit.tone)?.label || 'Friendly';
  const ai = await claudeJSON({
    ...(await aiConfig(pool)),
    effort: 'medium',
    maxTokens: 5000,
    system: SYSTEM,
    user: [
      `GOAL: ${goal.brief}`,
      `BUSINESS: ${kit.companyName || '(use the name from the documents)'}. VOICE: ${voice}.`,
      pageSummary ? `THE REST OF THE PAGE (do not repeat its points): ${pageSummary}` : '',
      `SECTION: ${type}. ${SECTION_RULES[type]}`,
      current ? `CURRENT CONTENT: ${JSON.stringify(current)}` : '',
      request ? `THE OWNER ASKS: ${String(request).slice(0, 500)}\nChange only what the request needs; keep everything else as it is.` : 'Write this section from scratch.',
      context?.trim() ? `<documents>\n${context.trim()}\n</documents>` : 'There are no documents; keep claims general and leave unknown facts out.',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: obj({ content: schema }),
  });
  return { content: ai.content };
}

export function registerLandingAiRoutes(app, { pool, sendError }) {
  app.post('/api/landing/rewrite', async (req, res) => {
    try {
      res.json(await rewriteText(pool, req.body || {}));
    } catch (err) {
      sendError(res, 'POST /api/landing/rewrite', err);
    }
  });
  app.post('/api/landing/section', async (req, res) => {
    try {
      res.json(await writeSection(pool, req.body || {}));
    } catch (err) {
      sendError(res, 'POST /api/landing/section', err);
    }
  });
}

// --- chat ----------------------------------------------------------------------------
// The landing editor's "Ask AI" chat. One small call PLANS the change (which
// sections to edit / add / remove, theme); then the section writes run in
// parallel through writeSection, so the chat only ever produces the same
// valid, undoable edits as the buttons.

const PALETTE_IDS = ['', 'presoft', 'forest', 'ocean', 'berry', 'terracotta', 'midnight'];
const FONT_IDS = ['', 'spacegrotesk-manrope', 'bricolage-dmsans', 'syne-worksans', 'outfit-outfit', 'playfair-outfit', 'newsreader-jakarta', 'notoserif-notosans'];
const TYPES = Object.keys(CONTENT_SCHEMA);

function summarizePage(page) {
  const t = (v) => (typeof v === 'string' ? v : v?.en || '');
  return (page?.sections || []).map((s) => {
    const c = s.content || {};
    const items = (c.items || c.plans || []).slice(0, 4).map((i) => t(i.title || i.q || i.name || i.quote)).filter(Boolean);
    const textFields = Object.keys(c).filter((k) => typeof c[k] === 'string' || (c[k] && typeof c[k] === 'object' && 'en' in c[k]));
    return { section_id: s.id, type: s.type, layout: s.variant, hidden: !!s.hidden, title: t(c.title), text_fields: textFields, ...(items.length ? { items } : {}) };
  });
}

// -> { reply, edits[{section_id, content}], added[{type, after_section_id, content}], removed[], palette, font,
//      colors{primary,accent,bg,text}, button{bg,text}, text_styles[{section_id, field, color, size, bold, align}] }
export async function landingChat(pool, { page, request, history = [], brand, goal, context }) {
  if (!String(request || '').trim()) throw new ConfigError('Type what you would like to change.');
  const summary = summarizePage(page);
  const ids = summary.map((s) => s.section_id);
  const idSchema = ids.length ? { type: 'string', enum: ids } : str;
  const plan = await claudeJSON({
    ...(await aiConfig(pool)),
    effort: 'medium',
    maxTokens: 4000,
    system: `${SYSTEM}

You are the assistant inside a landing page editor. The owner asks for changes in their own words; you plan concrete edits. Only change what the request needs. Reply briefly (1-2 sentences, in the owner's language) saying what you changed. If the request is unclear, plan nothing and ask a short question in "reply".`,
    user: [
      `PAGE SECTIONS (in order): ${JSON.stringify(summary)}`,
      `Section types you can add: ${TYPES.join(', ')}.`,
      history.length ? `EARLIER IN THIS CHAT:\n${history.slice(-8).map((m) => `${m.role === 'user' ? 'Owner' : 'You'}: ${m.text}`).join('\n')}` : '',
      `OWNER'S REQUEST: ${String(request).slice(0, 800)}`,
      'Fields: section_edits = existing sections whose words should change, each with a precise instruction. new_sections = sections to add (after_section_id = where), each with what it should say. remove_section_ids = sections to delete. palette / font = a theme change, or "".',
      'Looks: colors = new page colours as #RRGGBB (primary = buttons and highlights, accent = headings and dark blocks, bg = page background, text = body text), "" to keep. button_color / button_text_color = colour of every WhatsApp button and of its text. text_styles = the look of single texts: section_id + field (one of that section\'s text_fields; section_id "page" with field "cta.label" is the WhatsApp button text), with color, size (s, m, l, xl), bold (bold, regular) and align (left, center, right), "" to keep. A colour is #RRGGBB, a page colour name (primary, accent, text, muted) or white / black. You can change all of these; never say you cannot change colours.',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: obj({
      reply: str,
      section_edits: list(obj({ section_id: idSchema, instruction: str })),
      new_sections: list(obj({ type: { type: 'string', enum: TYPES }, after_section_id: idSchema, instruction: str })),
      remove_section_ids: list(idSchema),
      palette: { type: 'string', enum: PALETTE_IDS },
      font: { type: 'string', enum: FONT_IDS },
      colors: obj({ primary: str, accent: str, bg: str, text: str }),
      button_color: str,
      button_text_color: str,
      text_styles: list(obj({
        section_id: str,
        field: str,
        color: str,
        size: { type: 'string', enum: ['', 's', 'm', 'l', 'xl'] },
        bold: { type: 'string', enum: ['', 'bold', 'regular'] },
        align: { type: 'string', enum: ['', 'left', 'center', 'right'] },
      })),
    }),
  });

  const byId = new Map((page?.sections || []).map((s) => [s.id, s]));
  const pageSummary = `${page?.brand?.name || ''}. ${summary.map((s) => `${s.type}: ${s.title}`).join('; ')}`;
  const [edits, added] = await Promise.all([
    Promise.all(
      plan.section_edits
        .filter((e) => byId.has(e.section_id))
        .slice(0, 6)
        .map(async (e) => {
          const s = byId.get(e.section_id);
          const { content } = await writeSection(pool, { type: s.type, goal, brand, context, pageSummary, current: s.content, request: e.instruction });
          return { section_id: s.id, content };
        })
    ),
    Promise.all(
      plan.new_sections.slice(0, 3).map(async (n) => {
        const { content } = await writeSection(pool, { type: n.type, goal, brand, context, pageSummary, request: `New section: ${n.instruction}` });
        return { type: n.type, after_section_id: n.after_section_id, content };
      })
    ),
  ]);

  // Only well-formed colours reach the page (see shared/landing/textStyle.js).
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '').trim()) ? String(v).trim().toUpperCase() : '');
  const colorValue = (v) => {
    const c = String(v || '').trim().toLowerCase();
    return hex(c) || (['primary', 'accent', 'text', 'muted', 'white', 'black'].includes(c) ? c : '');
  };
  const colors = Object.fromEntries(Object.entries(plan.colors || {}).map(([k, v]) => [k, hex(v)]).filter(([, v]) => v));
  const textStyles = (plan.text_styles || [])
    .filter((x) => (x.section_id === 'page' && x.field === 'cta.label') || byId.get(x.section_id)?.content?.[x.field] !== undefined)
    .slice(0, 12)
    .map((x) => ({ section_id: x.section_id, field: x.field, color: colorValue(x.color), size: x.size, bold: x.bold, align: x.align }));
  return {
    reply: plan.reply,
    edits,
    added,
    removed: plan.remove_section_ids.filter((id) => byId.has(id)),
    palette: plan.palette,
    font: plan.font,
    colors,
    button: { bg: colorValue(plan.button_color), text: colorValue(plan.button_text_color) },
    text_styles: textStyles,
  };
}

export function registerLandingChatRoutes(app, { pool, sendError }) {
  app.post('/api/landing/chat', async (req, res) => {
    try {
      res.json(await landingChat(pool, req.body || {}));
    } catch (err) {
      sendError(res, 'POST /api/landing/chat', err);
    }
  });
}
