// "Is this key actually working?" checks for Settings → API. Each one is a
// free, read-only call (list models / whoami) — nothing gets generated.
// OpenAI/Gemini are tested from the browser (that's where post generation
// calls them from); Claude/Netlify keys live server-side, so the server tests
// those (POST /api/ai/test).
import { listImageModels } from './aiProvider';

// provider: 'openai' | 'gemini'. Passes only if the key works AND can use at
// least one image model — a valid key with no image models (or only retired
// ones) is reported as not working. Returns { ok, models, error? }.
export async function testImageKey(provider, key) {
  const name = provider === 'gemini' ? 'Gemini' : 'OpenAI';
  try {
    const models = await listImageModels(provider, key, { fresh: true });
    if (!models.length) return { ok: false, models, error: `This ${name} key has no image models available.` };
    return { ok: true, models };
  } catch (e) {
    if (e.status) return { ok: false, models: [], error: [400, 401, 403].includes(e.status) ? `${name} rejected this key.` : e.message };
    return { ok: false, models: [], error: "Couldn't reach the service — check your internet connection." };
  }
}

// service: 'claude' | 'netlify'. Without `key`, tests what the server would
// use right now (the saved Settings key, else its own default).
export async function testServerKey(service, key) {
  try {
    const res = await fetch('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, key: key || undefined }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) return { ok: false, error: body?.error || "The server didn't answer." };
    return body;
  } catch {
    return { ok: false, error: "The server isn't running." };
  }
}

export async function fetchServerKeyStatus() {
  try {
    const res = await fetch('/api/ai/status');
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
