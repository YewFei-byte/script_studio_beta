// Per-item storage for posts and landing pages (see server/content.js).
// Replaces saving the whole list as one app_data 'content' blob.

// -> { items, deletedIds, revs } or undefined when the server can't be
// reached / has no database (local-only mode).
export async function fetchContent() {
  try {
    const res = await fetch('/api/content');
    if (!res.ok) return undefined;
    const data = await res.json();
    if (!data.configured) return undefined;
    return { items: data.items || [], deletedIds: data.deletedIds || [], revs: data.revs || {} };
  } catch {
    return undefined;
  }
}

// -> { ok: true, rev } | { ok: false, conflict: true, current: { item, deleted, rev } }
// Throws on any other failure.
export async function putContentItem(item, baseRev) {
  const res = await fetch(`/api/content/${encodeURIComponent(item.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item, baseRev: baseRev ?? null }),
  });
  const body = await res.json().catch(() => null);
  if (res.status === 409 && body?.conflict) return { ok: false, conflict: true, current: body.current };
  if (!res.ok) throw new Error(body?.error || `Could not save (HTTP ${res.status}).`);
  return { ok: true, rev: body.rev };
}

export async function deleteContentItem(id) {
  const res = await fetch(`/api/content/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Could not delete (HTTP ${res.status}).`);
  }
}
