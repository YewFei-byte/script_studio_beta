// Real YouTube video uploads. Unlike Facebook/Instagram, this can't be done
// as a plain browser fetch() to Google's API — refreshing an OAuth access
// token requires the Client Secret, which Google's token endpoint won't
// accept from a browser origin anyway (no CORS), and the actual multipart
// video upload is easiest to build once, server-side, in server.js's
// POST /api/youtube/publish. This file just packages the request for it.

// `videoFile` is a real File/Blob object (from <input type="file"
// accept="video/*">, see UploadPostModal.jsx) — never a data: URL. Video
// files are far too large to round-trip through localStorage/base64 the way
// generated poster images do.
export async function postToYoutube({ clientId, clientSecret, refreshToken, title, description, videoFile }) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('YouTube isn’t connected yet — save a Client ID, Client Secret, and Refresh Token first.');
  }
  if (!videoFile) {
    throw new Error('No video file attached — re-open Upload and attach a video before publishing to YouTube.');
  }

  const form = new FormData();
  form.append('clientId', clientId);
  form.append('clientSecret', clientSecret);
  form.append('refreshToken', refreshToken);
  form.append('title', title || 'Untitled');
  form.append('description', description || '');
  form.append('video', videoFile, videoFile.name || 'video.mp4');

  const res = await fetch('/api/youtube/publish', { method: 'POST', body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.id) {
    throw new Error(body?.error || 'YouTube rejected the upload.');
  }
  return body; // { id, link }
}
