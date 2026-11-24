// Brand Kit helpers. "✨ Fill from my documents" on the Brand page reads the
// company's SOP/product docs once and proposes the text fields, so nobody
// has to write a tagline or pick a tone from scratch. (Colours come from the
// logo, in the browser — no AI needed for that.)

import { ConfigError, claudeJSON, resolveAiConfig } from './ai.js';
import { TONES } from '../shared/brand.js';

const SCHEMA = {
  type: 'object',
  properties: {
    companyName: { type: 'string', description: 'The business or brand name, as customers would see it.' },
    tagline: { type: 'string', description: 'A short brand tagline, max ~8 words.' },
    tone: { type: 'string', enum: TONES.map((t) => t.id) },
    whatsappMessage: {
      type: 'string',
      description: 'The pre-filled first message a customer sends when tapping the WhatsApp button, written as the customer, max ~15 words.',
    },
  },
  required: ['companyName', 'tagline', 'tone', 'whatsappMessage'],
  additionalProperties: false,
};

export async function extractBrandKit(pool, context) {
  if (typeof context !== 'string' || !context.trim()) {
    throw new ConfigError('Upload a Marketing SOP or product document first (Requirement page) so there is something to read.');
  }
  const { anthropicKey, model } = await resolveAiConfig(pool);
  return claudeJSON({
    apiKey: anthropicKey,
    model,
    effort: 'low',
    maxTokens: 4000,
    system:
      "You set up a small business's brand kit from its own documents. Use only what the documents support; " +
      'if the name is unclear, use the most prominent product or company name. Write in the same language the documents mostly use.',
    user: `<documents>\n${context.trim()}\n</documents>\n\nPropose the brand kit fields.`,
    schema: SCHEMA,
  });
}

export function registerBrandRoutes(app, { pool, sendError }) {
  // POST /api/brand/extract  { context } -> { companyName, tagline, tone, whatsappMessage }
  app.post('/api/brand/extract', async (req, res) => {
    try {
      res.json(await extractBrandKit(pool, req.body?.context));
    } catch (err) {
      sendError(res, 'POST /api/brand/extract', err);
    }
  });
}
