// Shared Claude plumbing for every server-side AI feature (landing pages,
// Brand Kit, rewrites…): one client per key, streaming so long generations
// never hit an HTTP timeout, the server-side refusal fallback, and errors
// turned into messages a non-technical user can act on.

import Anthropic from '@anthropic-ai/sdk';
import { companyId } from './tenant.js';

export const DEFAULT_TEXT_MODEL = 'claude-sonnet-5-5';

// Thrown for problems the user can fix themselves (missing/wrong key, bad
// input) — routes turn these into a 4xx instead of a 500.
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
// Anything else (e.g. Haiku) is sent as a plain request.
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1']);

// Keys typed into Settings → API (this company's `apiKeys` blob in
// app_data) win; server env vars are the fallback.
export async function resolveAiConfig(pool) {
  let saved = {};
  if (pool) {
    try {
      const { rows } = await pool.query("SELECT value FROM app_data WHERE company_id = $1 AND key = 'apiKeys'", [companyId()]);
      if (rows[0]?.value && typeof rows[0].value === 'object') saved = rows[0].value;
    } catch {
      // app_data not there yet (fresh DB) — fall back to env below.
    }
  }
  const clean = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    anthropicKey: clean(saved.landing) || process.env.ANTHROPIC_API_KEY || '',
    model: clean(saved.landingModel) || process.env.ANTHROPIC_MODEL || DEFAULT_TEXT_MODEL,
  };
}

function requireKey(apiKey) {
  if (!apiKey) {
    throw new ConfigError(
      'No Claude API key is set. Add one under Settings → API (or set ANTHROPIC_API_KEY on the server).'
    );
  }
}

// Sends one request and returns the final Message. `params` is a normal
// Messages API body minus `model`.
export async function claudeMessage({ apiKey, model, params }) {
  requireKey(apiKey);
  const client = new Anthropic({ apiKey });
  const body = { model, ...params };
  const plain = () => client.messages.stream(body).finalMessage();

  let message;
  try {
    if (FALLBACK_MODELS.has(model)) {
      try {
        message = await client.beta.messages
          .stream({ ...body, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
          .finalMessage();
      } catch (err) {
        // If this account/model rejects the fallback beta, retry once as a
        // plain request rather than failing outright.
        if (!(err instanceof Anthropic.BadRequestError)) throw err;
        console.warn(`[ai] Refusal fallback rejected for ${model}, retrying without it:`, err.message);
        message = await plain();
      }
    } else {
      message = await plain();
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ConfigError('The Claude API key was rejected. Check it under Settings → API.');
    }
    if (err instanceof Anthropic.NotFoundError) {
      throw new ConfigError(`The model "${model}" isn't available for this Claude API key. Pick another under Settings → API.`);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error('Claude is rate-limiting this API key right now. Wait a moment and try again.');
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Claude API error${err.status ? ` (${err.status})` : ''}: ${err.message}`);
    }
    throw err;
  }

  if (message.stop_reason === 'refusal') {
    throw new Error('Claude declined this request. Try rewording it.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('The answer came out too long and got cut off. Please try again.');
  }
  const u = message.usage || {};
  console.log(`[ai] ${model}: ${u.input_tokens ?? '?'} in / ${u.output_tokens ?? '?'} out tokens`);
  return message;
}

// The final text, ignoring a refused attempt's partial output: if a refusal
// fallback kicked in mid-output, content still holds the declined model's
// partial text before the `fallback` marker.
export function finalText(message) {
  const lastFallback = message.content.map((b) => b.type).lastIndexOf('fallback');
  return message.content.slice(lastFallback + 1).find((b) => b.type === 'text' && typeof b.text === 'string')?.text || '';
}

// Structured output: Claude's reply is guaranteed to match `schema` (JSON
// Schema; every object needs additionalProperties: false). Returns the
// parsed object.
export async function claudeJSON({ apiKey, model, system, user, schema, maxTokens = 8000, effort }) {
  const message = await claudeMessage({
    apiKey,
    model,
    params: {
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema }, ...(effort ? { effort } : {}) },
    },
  });
  try {
    return JSON.parse(finalText(message));
  } catch {
    throw new Error("The AI's answer couldn't be read. Please try again.");
  }
}

// --- Settings → API status / test --------------------------------------------

// Cheap, read-only calls that prove a key works without generating anything.
async function testClaudeKey(apiKey) {
  try {
    await new Anthropic({ apiKey }).models.list({ limit: 1 });
    return { ok: true };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, error: 'Claude rejected this key.' };
    }
    return { ok: false, error: `Couldn't reach Claude (${err.message}).` };
  }
}

export function registerAiRoutes(app, { pool }) {
  // GET /api/ai/status -> which services have a server-side default key (env).
  // Never returns the keys themselves.
  app.get('/api/ai/status', (req, res) => {
    res.json({
      claude: { serverDefault: !!process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || DEFAULT_TEXT_MODEL },
    });
  });

  // POST /api/ai/test { service: 'claude', key? } -> { ok, error? }
  // Without `key`, tests whatever the server would actually use right now
  // (Settings key, else env).
  app.post('/api/ai/test', async (req, res) => {
    const { service, key } = req.body || {};
    const config = await resolveAiConfig(pool);
    if (service === 'claude') {
      const k = (typeof key === 'string' && key.trim()) || config.anthropicKey;
      return res.json(k ? await testClaudeKey(k) : { ok: false, error: 'No key set.' });
    }
    res.status(400).json({ error: 'Unknown service.' });
  });
}
