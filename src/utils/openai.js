// Thin wrapper around OpenAI's REST API, called directly from the browser.
//
// Security note: calling OpenAI directly from client-side code means your API
// key is visible in the browser's network requests (anyone with dev tools
// open on this machine could see it). That's an acceptable trade-off for your
// own local, personal use — but if this app is ever deployed for other people
// to use, this key should move to a small backend instead so it's never sent
// to the browser at all.
//
// Used for post background photos (Settings → API → image key). Text is
// written by Claude on the server (server/postBuild.js, server/landingBuild.js).
//
// Which image model to call is picked on Settings → API from the list this
// key can actually use (listImageModels below) — OpenAI retires models
// (gpt-image-1 was shut down on 2026-10-23), so nothing here is hardcoded
// beyond a preference order for the default.

const IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const MODELS_ENDPOINT = 'https://api.openai.com/v1/models';

// Picked first when the user hasn't chosen one, if the key has it.
export const PREFERRED_IMAGE_MODELS = ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'];

function authHeaders(apiKey) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
}

// The gpt-image-* models this key can call, newest first. Dated snapshots
// (e.g. gpt-image-2.5-flare-2026-09-08) are left out to keep the list short.
export async function listImageModels(apiKey) {
  const res = await fetch(MODELS_ENDPOINT, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `OpenAI rejected this key (HTTP ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return (data?.data || [])
    .map((m) => m.id)
    .filter((id) => id.startsWith('gpt-image') && !/-\d{4}-\d{2}-\d{2}$/.test(id))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

// Generates `n` images from a text prompt. Returns an array of data: URLs
// (gpt-image models return base64-encoded images, not hosted URLs).
export async function generatePosterImages({ apiKey, model, prompt, n = 1, size = '1024x1024' }) {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key — add it under Settings → API → Post API Key.');
  }

  const res = await fetch(IMAGE_ENDPOINT, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ model, prompt, n, size }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI image generation failed (HTTP ${res.status}).`);
  }

  return (data.data || []).map((d) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url));
}
