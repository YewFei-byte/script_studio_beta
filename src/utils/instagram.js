// Real Instagram posting via the Graph API — reuses the same Page Access
// Token you already saved for Facebook, since an Instagram Business/Creator
// account posts through its linked Facebook Page (see the Facebook Page
// requirement noted in SocialMediaPage.jsx). All you need on top of that is
// the numeric Instagram Business Account ID.
//
// Unlike Facebook's /photos endpoint (which accepts raw uploaded bytes),
// Instagram's Content Publishing API can only fetch an image from a real,
// public URL — it can never take base64/data: bytes directly. Since a
// generated poster only exists as a data: URL in the browser, it has to be
// hosted somewhere real first; server.js's /api/media route does exactly
// that (saves the image, hands back a public URL under /media/...).

import { MAX_CAROUSEL, publishInstagram } from '../../shared/socialPublish.js';

// Uploads a data: URL to our own server so Instagram has something it can
// actually fetch. If imageUrl is already a real http(s) URL, this is skipped
// entirely and that URL is used as-is.
async function ensurePublicImageUrl(imageUrl) {
  if (!imageUrl) throw new Error('This post has no image to publish.');
  if (!imageUrl.startsWith('data:')) return imageUrl; // already a real URL

  const blobRes = await fetch(imageUrl);
  const blob = await blobRes.blob();
  const form = new FormData();
  form.append('file', blob, 'poster.png');

  const res = await fetch('/api/media', { method: 'POST', body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.url) {
    throw new Error(body?.error || 'Could not host the image for Instagram to fetch.');
  }
  return body.url;
}

// Publishes to an Instagram Business/Creator account: one image is a normal
// post, several become a carousel (see shared/socialPublish.js).
export async function postToInstagram({ businessId, accessToken, caption, imageUrls }) {
  if (!businessId || !accessToken) {
    throw new Error('Instagram isn’t fully connected — save your Business Account ID and make sure Facebook is connected first.');
  }
  if (!imageUrls?.length) throw new Error('This post has no image to publish.');
  const urls = await Promise.all(imageUrls.slice(0, MAX_CAROUSEL).map(ensurePublicImageUrl));
  return publishInstagram({ businessId, token: accessToken, caption, imageUrls: urls });
}
