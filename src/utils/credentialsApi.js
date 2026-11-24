// Talks to the small Postgres-backed API in server.js so social platform
// credentials (currently just Facebook's Page connection) can survive across
// browsers/devices instead of living only in the localStorage of whichever
// machine you saved them on.
//
// Every call here is best-effort and silent on failure: if the API isn't
// reachable (e.g. you're running `npm run dev` without also running
// `node server.js`, or Postgres isn't attached on Railway yet), these just
// resolve to null / no-op instead of throwing -- the rest of the app keeps
// working exactly as it did before this file existed, off localStorage only.

export async function fetchCredentials(platform) {
  try {
    const res = await fetch(`/api/credentials/${platform}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.connected ? data : null;
  } catch {
    return null;
  }
}

// `fields` can include any of: pageId, pageName, accessToken (Facebook, and
// reused by Instagram), businessId (Instagram's own IG Business Account ID),
// clientId/clientSecret/refreshToken (YouTube's OAuth credentials). Whatever
// isn't passed just leaves that field untouched server-side (see the
// COALESCE in server.js's POST /api/credentials/:platform).
export async function saveCredentials(platform, fields) {
  try {
    await fetch(`/api/credentials/${platform}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
  } catch {
    // best-effort only -- localStorage already has the real copy
  }
}

export async function deleteCredentials(platform) {
  try {
    await fetch(`/api/credentials/${platform}`, { method: 'DELETE' });
  } catch {
    // best-effort only
  }
}
