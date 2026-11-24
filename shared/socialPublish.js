// Graph API posting shared by the browser (Publish now) and the server's
// auto-publish tick. Plain fetch only, so it runs in both. Image URLs must
// already be public http(s) URLs; callers host data: URLs first.
// One image -> a normal photo post; several -> a carousel (Instagram) or a
// multi-photo post (Facebook), in the given order.

export const GRAPH_VERSION = 'v21.0';
export const MAX_CAROUSEL = 10;
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function graph(path, params, fallback) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error || !body?.id) throw new Error(body?.error?.message || `${fallback} (HTTP ${res.status}).`);
  return body;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Instagram processes a carousel container before it can be published.
async function waitUntilReady(id, token) {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${GRAPH}/${id}?fields=status_code&access_token=${encodeURIComponent(token)}`).then((r) => r.json()).catch(() => null);
    if (res?.status_code === 'FINISHED') return;
    if (res?.status_code === 'ERROR') throw new Error('Instagram could not process the carousel images.');
    await wait(1500);
  }
}

// -> { id, permalink }
export async function publishInstagram({ businessId, token, caption = '', imageUrls }) {
  const urls = (imageUrls || []).filter(Boolean).slice(0, MAX_CAROUSEL);
  if (!urls.length) throw new Error('This post has no image to publish.');
  let containerId;
  if (urls.length === 1) {
    containerId = (await graph(`/${businessId}/media`, { image_url: urls[0], caption, access_token: token }, 'Instagram rejected the media upload')).id;
  } else {
    const children = [];
    for (const url of urls) {
      children.push((await graph(`/${businessId}/media`, { image_url: url, is_carousel_item: true, access_token: token }, 'Instagram rejected a carousel image')).id);
    }
    containerId = (await graph(`/${businessId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption, access_token: token }, 'Instagram rejected the carousel')).id;
    await waitUntilReady(containerId, token);
  }
  const { id } = await graph(`/${businessId}/media_publish`, { creation_id: containerId, access_token: token }, 'Instagram rejected publishing the post');
  // The media id isn't the /p/<code> in Instagram's web address; ask for the real link.
  const meta = await fetch(`${GRAPH}/${id}?fields=permalink&access_token=${encodeURIComponent(token)}`).then((r) => r.json()).catch(() => null);
  return { id, permalink: meta?.permalink || '' };
}

// -> the Graph response ({ id, post_id? })
export async function publishFacebook({ pageId, token, message = '', imageUrls }) {
  const urls = (imageUrls || []).filter(Boolean);
  if (!urls.length) return graph(`/${pageId}/feed`, { message, access_token: token }, 'Facebook rejected the post');
  if (urls.length === 1) return graph(`/${pageId}/photos`, { url: urls[0], caption: message, access_token: token }, 'Facebook rejected the post');
  const ids = [];
  for (const url of urls) {
    ids.push((await graph(`/${pageId}/photos`, { url, published: false, access_token: token }, 'Facebook rejected a photo')).id);
  }
  return graph(`/${pageId}/feed`, { message, attached_media: ids.map((media_fbid) => ({ media_fbid })), access_token: token }, 'Facebook rejected the post');
}
