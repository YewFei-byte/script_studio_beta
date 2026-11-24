// Uploads a generated/uploaded poster image (a base64 data: URL) to
// POST /api/poster-image and returns a short, stable /api/poster-image/:id
// URL instead. Every place that produces a data: URL for a post image
// (AI backgrounds and exported posts from the composer, manual
// upload in UploadPostModal.jsx) should route through this before the
// image lands in `content` -- otherwise the raw base64 gets embedded
// straight into the shared 'content' save, which is how a growing image
// history used to silently blow past the browser's localStorage quota and
// this server's request-size limit (see media_images in server.js).
//
// Falls back to keeping the original data: URL if the upload fails (no
// Postgres configured yet, network hiccup, etc.) rather than losing the
// image outright -- the size-quota bug this replaces was strictly worse
// than that, and the caller/AdminPanel's save-failure banner will still
// surface a warning if the resulting item can't actually be persisted.
export async function uploadPosterImage(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  try {
    const res = await fetch('/api/poster-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    });
    if (!res.ok) return dataUrl;
    const data = await res.json();
    return data.url || dataUrl;
  } catch {
    return dataUrl;
  }
}

export function uploadPosterImages(dataUrls) {
  return Promise.all(dataUrls.map(uploadPosterImage));
}
