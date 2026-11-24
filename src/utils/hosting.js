// Presoft hosting for landing pages (server/sites.js): each page lives at
// https://<address>.pages.presoft.my.

async function call(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

const post = (url, data) => call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

// A starting address from the page's name: "Kopi Kita Roastery" -> "kopi-kita-roastery".
export function suggestSlug(item) {
  const base = String(item?.landing?.page?.brand?.name || item?.landing?.productName || item?.title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return base.length >= 3 ? base : 'my-page';
}

// -> { available, slug?, url?, reason? }
export function checkSiteSlug(slug, itemId) {
  return call(`/api/sites/check?slug=${encodeURIComponent(slug)}&itemId=${encodeURIComponent(itemId || '')}`);
}

// Publishes (or republishes) the page at `slug`. -> { link, siteSlug }
export async function publishLandingPage(item, slug) {
  const { url, slug: finalSlug } = await post('/api/sites/publish', { item, slug: slug || item.siteSlug || suggestSlug(item) });
  return { link: url, siteSlug: finalSlug };
}

export function unpublishLandingPage(itemId) {
  return post('/api/sites/unpublish', { itemId });
}

// -> { [itemId]: { slug, url, views, whatsappClicks } }
export function fetchSiteStats() {
  return call('/api/sites/stats').catch(() => ({}));
}
