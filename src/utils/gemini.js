// Thin wrapper around Google's Gemini API, called directly from the browser
// — same shape and same trade-off as src/utils/openai.js (see the security
// note there: the key is visible in browser dev tools, fine for your own
// use, move it server-side before opening this app up to other people).
//
// The API key used here is whatever's pasted into Settings -> API -> "Post
// API Key" when the provider pill next to it is set to "Gemini" — get one
// (free tier available) from https://aistudio.google.com/apikey.
//
// Model names: Gemini's image-capable model is a `generateContent` call
// with both TEXT and IMAGE in `responseModalities` (Google calls this
// "Nano Banana" in their docs) rather than a separate images endpoint like
// OpenAI's. Which model is picked on Settings → API from the list this key
// can actually use (listImageModels below), since Google renames/retires
// these often — https://ai.google.dev/gemini-api/docs/image-generation
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Picked first when the user hasn't chosen one, if the key has it.
export const PREFERRED_IMAGE_MODELS = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];

// The image-output Gemini models this key can call, newest first. Imagen
// models use a different endpoint (:predict), so they're filtered out by
// requiring generateContent.
export async function listImageModels(apiKey) {
  const res = await fetch(`${BASE}?pageSize=1000&key=${encodeURIComponent(apiKey)}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Gemini rejected this key (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return (data?.models || [])
    .filter((m) => /-image/.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

async function callGenerateContent(model, apiKey, body) {
  const res = await fetch(`${BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini request failed (HTTP ${res.status}).`);
  }
  return data;
}

// Generates `n` images from a text prompt. Gemini's image model returns one
// image per call (no built-in "n" like OpenAI's), so this fires `n` calls in
// parallel. Returns an array of data: URLs, same shape as
// generatePosterImages in openai.js so callers don't need to care which
// provider is active.
export async function generatePosterImages({ apiKey, model, prompt, n = 1 }) {
  if (!apiKey) {
    throw new Error('Missing Gemini API key — add it under Settings → API → Post API Key.');
  }

  const requestOne = async () => {
    const data = await callGenerateContent(model, apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    });
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart) {
      throw new Error('Gemini did not return an image for this prompt.');
    }
    const mime = imagePart.inlineData.mimeType || 'image/png';
    return `data:${mime};base64,${imagePart.inlineData.data}`;
  };

  return Promise.all(Array.from({ length: n }, requestOne));
}
