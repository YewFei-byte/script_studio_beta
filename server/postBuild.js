// Social post copy (Claude, structured output). Two small calls:
//   angles  -> 3 different ideas for the post, the user picks one
//   copy    -> the words on the image + 3 caption versions per platform +
//              hashtags + a text-free photo description for the background
// The image itself is generated in the browser (ChatGPT image), and the
// layout comes from the composer's templates, so the AI only writes words.

import { ConfigError, claudeJSON, resolveAiConfig } from './ai.js';
import { normalizeBrandKit, TONES } from '../shared/brand.js';

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items) => ({ type: 'array', items });

export const POST_GOALS = {
  awareness: 'Get noticed: introduce the business or product to new people.',
  product: 'Show off a product: what it is and why it is worth buying.',
  promo: 'Promote an offer or sale (only offers stated in the documents or the owner note).',
  event: 'Announce an event: what, when, where.',
  tips: 'Share a useful tip that relates to the business, to build trust.',
  festive: 'A festive greeting (e.g. Hari Raya, Chinese New Year, Deepavali, Christmas) that fits the brand.',
};

const LANGUAGE = {
  en: 'English',
  zh: 'Simplified Chinese, natural for Malaysian Chinese readers',
  ms: 'Bahasa Malaysia (natural, everyday Malaysian Malay)',
};

const PLATFORM = {
  ig: 'Instagram: hook in the first line, short paragraphs, a few emojis are fine, hashtags at the end.',
  fb: 'Facebook: conversational, a clear call to message or comment, 1-3 hashtags at most.',
  xhs: 'RedNote (Xiaohongshu): note-style with a catchy title line, personal and helpful tone, emojis as bullets, topic tags.',
  yt: 'YouTube video description: what the video shows, then the call to action.',
};

const SYSTEM = `You write social media posts for small businesses in Malaysia.

Rules:
- Facts only from the business's documents and the owner's note. Never invent prices, discounts, dates, awards, numbers or reviews.
- Plain, specific, friendly language. No filler words: elevate, seamless, unleash, revolutionize, game-changer, next-level.
- No em dashes or en dashes.
- Text that goes ON the image must be very short: it is read in one second on a phone.
- The call to action is always to message the business on WhatsApp (or comment / DM), never a link click.`;

async function aiConfig(pool) {
  const { anthropicKey, model } = await resolveAiConfig(pool);
  if (!anthropicKey) throw new ConfigError('No Claude API key is set. Add one under Settings → API (or set ANTHROPIC_API_KEY on the server).');
  return { apiKey: anthropicKey, model };
}

function brief({ brand, goal, language, context, notes }) {
  const kit = normalizeBrandKit(brand);
  const voice = TONES.find((t) => t.id === kit.tone)?.label || 'Friendly';
  return [
    `BUSINESS: ${kit.companyName || '(use the name from the documents)'}${kit.tagline ? `. Tagline: ${kit.tagline}` : ''}. VOICE: ${voice}.`,
    `GOAL: ${POST_GOALS[goal] || POST_GOALS.awareness}`,
    `LANGUAGE for all text: ${LANGUAGE[language] || LANGUAGE.en}.`,
    notes ? `THE OWNER SAYS: ${String(notes).slice(0, 600)}` : '',
    context?.trim() ? `<documents>\n${context.trim()}\n</documents>` : 'There are no documents; keep claims general.',
  ]
    .filter(Boolean)
    .join('\n');
}

// -> { angles: [{ title, hook }] }  (3, or more when several posts are made at once)
export async function postAngles(pool, { count = 1, ...args }) {
  const n = Math.max(3, Math.min(Number(count) || 1, 6));
  return claudeJSON({
    ...(await aiConfig(pool)),
    effort: 'low',
    maxTokens: 3000,
    system: SYSTEM,
    user: `${brief(args)}\n\nPropose ${n} clearly different angles, each for its own post. title: max 6 words naming the idea. hook: one sentence saying what the post will say. Write them in the chosen language.`,
    schema: obj({ angles: list(obj({ title: str, hook: str })) }),
  });
}

const CAPTIONS_AND_PHOTO = (plats, extra = '') => [
  `- captions: for each platform (${plats.join(', ')}), 3 different caption options following its style${extra}:\n${plats.map((p) => `  ${p}: ${PLATFORM[p]}`).join('\n')}`,
  '- hashtags: 5-8 relevant hashtags without the # sign, mixing broad and local (e.g. Malaysian city) tags.',
  '- imagePrompt: in English, describe a photo for the background: subject, setting, light, mood, composition with clear empty space for text. Photographic, realistic. NO text, words, letters, logos or watermarks in the image.',
];
const SLIDE = { headline: str, subline: str, cta: str, badge: str };

// Single post -> { headline, subline, cta, badge, captions: [{ platform, options[3] }], hashtags[], imagePrompt }
// Carousel    -> { slides: [{ headline, subline, cta, badge }], captions, hashtags, imagePrompt }
export async function postCopy(pool, { angle, platforms = ['ig'], format, slides, ...args }) {
  const plats = (platforms.length ? platforms : ['ig']).filter((p) => PLATFORM[p]);
  const captions = list(obj({ platform: { type: 'string', enum: plats }, options: list(str) }));
  const shared = { captions, hashtags: list(str), imagePrompt: str };
  const head = [brief(args), `ANGLE: ${angle?.title || ''}. ${angle?.hook || ''}`, 'Write:'];

  if (format === 'carousel') {
    const n = Math.max(2, Math.min(Number(slides) || 5, 10));
    return claudeJSON({
      ...(await aiConfig(pool)),
      effort: 'medium',
      maxTokens: 8000,
      system: SYSTEM,
      user: [
        ...head,
        `- slides: exactly ${n} carousel slides that tell one story in order, people swipe through them. Each slide has headline (max 6 words), subline (max 12 words, or empty), cta (max 3 words, or empty), badge (max 3 words, or empty).`,
        '  Slide 1 is the cover: a hook that makes people swipe; cta empty.',
        `  Slides 2 to ${n - 1}: one clear point each (a step, a benefit, a detail from the documents); cta and badge empty.`,
        `  Slide ${n}: the wrap-up with the call to action in cta (e.g. "WhatsApp us").`,
        '  badge only if the documents or note state an offer, and only on one slide.',
        ...CAPTIONS_AND_PHOTO(plats, ' (it is a carousel, so invite people to swipe)'),
      ].join('\n'),
      schema: obj({ slides: list(obj(SLIDE)), ...shared }),
    });
  }

  return claudeJSON({
    ...(await aiConfig(pool)),
    effort: 'medium',
    maxTokens: 6000,
    system: SYSTEM,
    user: [
      ...head,
      '- headline: the big text on the image, max 6 words.',
      '- subline: smaller text on the image, max 12 words, or empty.',
      '- cta: button text on the image, max 3 words (e.g. "WhatsApp us").',
      '- badge: max 3 words for a promo badge (e.g. "20% OFF") ONLY if the documents or note state such an offer, else empty.',
      ...CAPTIONS_AND_PHOTO(plats),
    ].join('\n'),
    schema: obj({ ...SLIDE, ...shared }),
  });
}

export function registerPostRoutes(app, { pool, sendError }) {
  app.post('/api/posts/angles', async (req, res) => {
    try {
      res.json(await postAngles(pool, req.body || {}));
    } catch (err) {
      sendError(res, 'POST /api/posts/angles', err);
    }
  });
  app.post('/api/posts/copy', async (req, res) => {
    try {
      res.json(await postCopy(pool, req.body || {}));
    } catch (err) {
      sendError(res, 'POST /api/posts/copy', err);
    }
  });
}

// --- caption rewrite + chat --------------------------------------------------------

const CAPTION_ACTIONS = {
  shorter: 'Make it much shorter (about half). Keep the call to action.',
  longer: 'Make it a bit longer with one more concrete detail from the documents.',
  friendlier: 'Make it warmer and friendlier.',
  professional: 'Make it more professional and polished.',
  emoji: 'Add a few fitting emojis (not too many).',
  noemoji: 'Remove all emojis.',
};

// -> { caption }  (without hashtags; the client re-adds them)
export async function rewriteCaption(pool, { caption, action, platform, language, brand }) {
  const how = CAPTION_ACTIONS[action];
  if (!how) throw new ConfigError('Unknown rewrite.');
  if (!String(caption || '').trim()) throw new ConfigError('Write or pick a caption first.');
  const kit = normalizeBrandKit(brand);
  return claudeJSON({
    ...(await aiConfig(pool)),
    effort: 'low',
    maxTokens: 3000,
    system: SYSTEM,
    user: [
      `BUSINESS: ${kit.companyName || '(unnamed)'}. PLATFORM: ${PLATFORM[platform] || PLATFORM.ig}`,
      `LANGUAGE: keep the caption's language (${LANGUAGE[language] || 'same as the caption'}).`,
      `CAPTION:\n${caption}`,
      `TASK: ${how} Do not add hashtags. Keep every fact; add none that are not already there.`,
    ].join('\n'),
    schema: obj({ caption: str }),
  });
}

// Template ids must match src/editor/post/design.js.
const TEMPLATE_IDS = ['bold-top', 'bottom-band', 'center-card', 'promo-badge', 'split', 'quote', 'minimal'];

// Plans a chat request for the composer; the client applies the plan.
// -> { reply, text_changes[{layer_id,text}], caption, template, overlay, new_background, background_prompt }
export async function postChat(pool, { request, history = [], design, caption, platform, language, brand, context, slideIndex, slideCount, otherSlides = [] }) {
  if (!String(request || '').trim()) throw new ConfigError('Type what you would like to change.');
  const kit = normalizeBrandKit(brand);
  const page = design?.pages?.[0] || { layers: [] };
  const texts = page.layers.filter((l) => l.type === 'text').map((l) => ({ layer_id: l.id, role: l.role, text: l.text }));
  const layerIds = texts.map((t) => t.layer_id);
  return claudeJSON({
    ...(await aiConfig(pool)),
    effort: 'medium',
    maxTokens: 6000,
    system: `${SYSTEM}

You are the assistant inside a post editor. The owner asks for changes in their own words; you decide the concrete edits and reply briefly (1-2 sentences, in the owner's language) saying what you changed. Only change what the request needs. If the request is unclear or impossible, change nothing and ask a short question in "reply".`,
    user: [
      `BUSINESS: ${kit.companyName || '(unnamed)'}. PLATFORM: ${platform || 'ig'}. POST LANGUAGE: ${LANGUAGE[language] || 'English'}.`,
      slideCount > 1 ? `This is slide ${slideIndex + 1} of a ${slideCount}-slide carousel; you only edit this slide. Other slides' headlines, in order: ${JSON.stringify(otherSlides)}` : '',
      `TEXT ON THE IMAGE: ${JSON.stringify(texts)}`,
      `CURRENT LAYOUT: ${design?.templateId || 'unknown'}. Layout options: ${TEMPLATE_IDS.join(', ')}.`,
      `CAPTION:\n${caption || '(empty)'}`,
      history.length ? `EARLIER IN THIS CHAT:\n${history.slice(-8).map((m) => `${m.role === 'user' ? 'Owner' : 'You'}: ${m.text}`).join('\n')}` : '',
      `OWNER'S REQUEST: ${String(request).slice(0, 800)}`,
      'Fields: text_changes = only the image texts to change (by layer_id; keep them very short). caption = the full new caption, or "" to leave it. template = a layout id, or "". overlay = "none" | "fade" | "even" to change photo darkening, or "". new_background = true only if the owner wants a different photo; then background_prompt describes it (English, photographic, no text in the image), else "".',
      context?.trim() ? `<documents>\n${context.trim()}\n</documents>` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    schema: obj({
      reply: str,
      text_changes: list(obj({ layer_id: layerIds.length ? { type: 'string', enum: layerIds } : str, text: str })),
      caption: str,
      template: { type: 'string', enum: ['', ...TEMPLATE_IDS] },
      overlay: { type: 'string', enum: ['', 'none', 'fade', 'even'] },
      new_background: { type: 'boolean' },
      background_prompt: str,
    }),
  });
}

export function registerPostChatRoutes(app, { pool, sendError }) {
  app.post('/api/posts/caption', async (req, res) => {
    try {
      res.json(await rewriteCaption(pool, req.body || {}));
    } catch (err) {
      sendError(res, 'POST /api/posts/caption', err);
    }
  });
  app.post('/api/posts/chat', async (req, res) => {
    try {
      res.json(await postChat(pool, req.body || {}));
    } catch (err) {
      sendError(res, 'POST /api/posts/chat', err);
    }
  });
}
