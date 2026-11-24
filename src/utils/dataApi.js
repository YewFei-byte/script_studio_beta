// Talks to the generic /api/data/:key routes in server.js (backed by the
// app_data table — one JSONB blob per key). This is what makes the
// Post/Landing Page content list and the AI generation API keys shared
// across every browser/device instead of being stuck in whichever one
// localStorage happened to save them on — the same gap Facebook's own
// connection already didn't have (see AdminPanel.jsx's existing
// fetchCredentials('fb') on mount), just generalized to any JSON-shaped
// piece of app state.
//
// saveData used to be silent on ANY failure, including the server actively
// rejecting the request (e.g. a 413 Payload Too Large once generated poster
// images pushed the combined blob past the request-size limit) -- fetch()
// only rejects on a genuine network failure, so an HTTP error response was
// swallowed just as quietly as a dropped connection. That meant a save
// could fail completely while the app carried on as if it had worked, and
// whatever didn't get persisted would simply be gone the next time anyone
// reloaded or another device/login checked in. Now it throws on a non-ok
// response too, so callers (see AdminPanel.jsx's save-failure banner) can
// actually tell the difference and warn instead of losing data silently.
// (Poster images themselves no longer ride along in this blob at all as of
// src/utils/posterImages.js -- each is its own row instead -- so this
// should mostly stay well under the limit going forward regardless.)

export async function fetchData(key) {
  try {
    const res = await fetch(`/api/data/${key}`);
    if (!res.ok) return undefined;
    const data = await res.json();
    // `null` is a real, meaningful answer here (the key exists on the server
    // with no value, or the server isn't configured) — distinct from
    // `undefined`, which means "couldn't even ask". Callers use this to
    // decide whether to adopt the server's value or seed the server with
    // whatever they've got locally.
    return data.configured ? data.value : undefined;
  } catch {
    return undefined;
  }
}

export async function saveData(key, value) {
  const res = await fetch(`/api/data/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Could not save (HTTP ${res.status}).`);
  }
}
