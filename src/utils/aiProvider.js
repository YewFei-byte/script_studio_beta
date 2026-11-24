// Picks OpenAI or Gemini for post background photos, based on the image
// provider chosen on Settings -> API (apiKeys.postProvider), and the image
// model within it (apiKeys.postModel).
import * as openai from './openai';
import * as gemini from './gemini';

function providerFor(name) {
  return name === 'gemini' ? gemini : openai;
}

// Model lists per provider+key, so generating doesn't re-list every time.
const modelCache = new Map();

// The image models this key can use with `provider`, newest first.
// Throws (with .status) if the provider rejects the key. `fresh` skips the
// cache (Settings → API's key check always asks the provider again).
export function listImageModels(provider, apiKey, { fresh = false } = {}) {
  const cacheKey = `${provider}|${apiKey}`;
  if (fresh || !modelCache.has(cacheKey)) {
    const p = providerFor(provider).listImageModels(apiKey);
    p.catch(() => modelCache.delete(cacheKey));
    modelCache.set(cacheKey, p);
  }
  return modelCache.get(cacheKey);
}

// The model to use when none was chosen (or the chosen one is gone): the
// provider's preferred one if the key has it, else the newest.
export function defaultImageModel(provider, models) {
  for (const pref of providerFor(provider).PREFERRED_IMAGE_MODELS) {
    const hit = models.find((m) => m === pref || m.startsWith(`${pref}-`));
    if (hit) return hit;
  }
  return models[0] || null;
}

async function resolveModel(provider, apiKey, model) {
  const models = await listImageModels(provider, apiKey);
  if (model && models.includes(model)) return model;
  const fallback = defaultImageModel(provider, models);
  if (!fallback) throw new Error('This key has no image models available. Check Settings → API.');
  return fallback;
}

export async function generatePosterImages({ provider, apiKey, model, ...args }) {
  if (!apiKey) return providerFor(provider).generatePosterImages({ apiKey, ...args });
  const resolved = await resolveModel(provider, apiKey, model);
  return providerFor(provider).generatePosterImages({ apiKey, model: resolved, ...args });
}
