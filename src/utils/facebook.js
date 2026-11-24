// Thin wrapper around the Facebook JavaScript SDK.
//
// Why the JS SDK instead of a plain fetch() to graph.facebook.com:
// - Login happens in a Facebook-hosted popup, so this app never sees the
//   user's password — Facebook hands back an access token directly.
// - FB.api() proxies calls through the SDK, which sidesteps the CORS
//   restrictions you'd hit calling the Graph API directly from the browser.
//
// Setup required before this works (see the "Connect Facebook" section of the
// README or the chat where this was set up):
//   1. Add VITE_FB_APP_ID to a local .env file (never commit this file).
//   2. In your Meta App dashboard -> Facebook Login -> Settings, add this
//      site's URL (e.g. http://localhost:5173) to "Valid OAuth Redirect URIs"
//      and "Allowed Domains for the JavaScript SDK".
//   3. Make sure your own Facebook account has a role (Admin/Developer/Tester)
//      on the Meta App, and that you're an admin of the Facebook Page you
//      want to post to — otherwise /me/accounts won't return it.

import { publishFacebook } from '../../shared/socialPublish.js';

// Falls back to a build-time env var if you don't have it set in the
// dashboard's API Keys page, but the App ID entered there (apiKeys.fbAppId)
// always wins if present.
const ENV_FB_APP_ID = import.meta.env.VITE_FB_APP_ID;
const GRAPH_VERSION = 'v21.0';

let sdkPromise = null;
let loadedWithAppId = null;

export function loadFacebookSdk(appId) {
  const resolvedAppId = appId || ENV_FB_APP_ID;

  // If the SDK was already loaded with a different App ID (e.g. the user
  // just typed a new one into the API Keys page), reset so it re-initializes
  // with the new one instead of silently keeping the stale one.
  if (sdkPromise && loadedWithAppId !== resolvedAppId) {
    sdkPromise = null;
  }

  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (!resolvedAppId) {
      reject(new Error('Missing Facebook App ID. Enter it under Settings → API Keys, or add VITE_FB_APP_ID to a .env file and restart the dev server.'));
      sdkPromise = null;
      return;
    }

    loadedWithAppId = resolvedAppId;

    if (window.FB) {
      window.FB.init({ appId: resolvedAppId, cookie: true, xfbml: false, version: GRAPH_VERSION });
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({ appId: resolvedAppId, cookie: true, xfbml: false, version: GRAPH_VERSION });
      resolve(window.FB);
    };

    if (document.getElementById('facebook-jssdk')) return; // script tag already added, waiting on fbAsyncInit

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      reject(new Error('Could not load the Facebook SDK — check your internet connection.'));
      sdkPromise = null;
    };
    document.body.appendChild(script);
  });

  return sdkPromise;
}

// Opens the real Facebook login popup. Resolves with { accessToken, userID, expiresIn }.
export async function loginWithFacebook(appId) {
  const FB = await loadFacebookSdk(appId);
  return new Promise((resolve, reject) => {
    FB.login(
      (response) => {
        if (response.authResponse) resolve(response.authResponse);
        else reject(new Error('Facebook login was cancelled or the permissions were denied.'));
      },
      { scope: 'pages_show_list,pages_read_engagement,pages_manage_posts' }
    );
  });
}

// Returns the Facebook Pages the logged-in user administers, each with its own
// Page access token (that's the token actually used to post — not the user token).
export async function getManagedPages(userAccessToken) {
  const FB = await loadFacebookSdk();
  return new Promise((resolve, reject) => {
    FB.api('/me/accounts', { access_token: userAccessToken }, (res) => {
      if (!res || res.error) reject(res?.error ? new Error(res.error.message) : new Error('Could not load your Facebook Pages.'));
      else resolve(res.data || []);
    });
  });
}

// Uploads a data: URL (our generated posters aren't hosted anywhere — they're
// base64 straight out of OpenAI/the mock pool) as an actual Photo on the Page,
// by sending the raw image bytes instead of a fetchable URL. This goes
// directly to the Graph API via fetch/FormData rather than through FB.api,
// because the JS SDK's callback-style api() doesn't reliably support binary
// multipart uploads.
async function postFacebookPhotoFromDataUrl({ pageId, pageAccessToken, message, dataUrl }) {
  const blobRes = await fetch(dataUrl);
  const blob = await blobRes.blob();

  const form = new FormData();
  form.append('source', blob, 'poster.png');
  if (message) form.append('caption', message);
  form.append('access_token', pageAccessToken);

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`, {
    method: 'POST',
    body: form,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    throw new Error(body?.error?.message || `Facebook rejected the photo upload (${res.status}).`);
  }
  return body;
}

// Publishes to a Page's feed. Pass imageUrls for a photo post — each a
// data: URL (uploaded directly as raw bytes) or a real public http(s) URL
// (Facebook fetches it server-side) — or an empty list for a text-only post.
//
// Deliberately a plain fetch to the Graph API, not the FB JS SDK (FB.api) --
// posting with an already-issued Page Access Token never actually needs a
// Facebook App ID, only FB.init()/the SDK's login popup does, and this app's
// real "Connect Facebook" flow (see SocialMediaPage.jsx) is manual paste of
// a Page Access Token from Graph API Explorer, not that popup. This used to
// go through the SDK for the real-URL case (still requiring an App ID for
// no functional reason) purely because generated poster images used to
// always be data: URLs, so this branch was effectively unreachable until
// posterImages.js started hosting them as real URLs instead — at which
// point every real-URL publish started failing on a missing App ID that
// was never actually needed for posting in the first place.
//
// Several images become one multi-photo post (carousel), in order; any data:
// URLs among them are hosted on our server first so Facebook can fetch them.
export async function postToFacebookPage({ pageId, pageAccessToken, message, imageUrls = [] }) {
  if (imageUrls.length === 1 && imageUrls[0].startsWith('data:')) {
    return postFacebookPhotoFromDataUrl({ pageId, pageAccessToken, message, dataUrl: imageUrls[0] });
  }
  const urls = await Promise.all(imageUrls.map(hostDataUrl));
  return publishFacebook({ pageId, token: pageAccessToken, message, imageUrls: urls });
}

async function hostDataUrl(url) {
  if (!url.startsWith('data:')) return url;
  const blob = await (await fetch(url)).blob();
  const form = new FormData();
  form.append('file', blob, 'poster.png');
  const res = await fetch('/api/media', { method: 'POST', body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.url) throw new Error(body?.error || 'Could not host the image for Facebook to fetch.');
  return body.url;
}
