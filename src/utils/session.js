// Sends the signed-in session token with every call to our own API
// (server/auth.js), so no other code has to remember to. If the server says
// the session is no longer valid, the app returns to the login screen.

const STORAGE_KEY = 'scriptStudioUser';

export function getToken() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')?.token || '';
  } catch {
    return '';
  }
}

function isOwnApi(input) {
  const url = typeof input === 'string' ? input : input?.url || '';
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin && u.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

let installed = false;
export function installAuthFetch() {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    if (!isOwnApi(input)) return original(input, init);
    const token = getToken();
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    const res = await original(input, { ...init, headers });
    if (token && (res.status === 401 || res.status === 403)) {
      const body = await res.clone().json().catch(() => null);
      if (res.status === 401) {
        // e.g. "Your organisation's Script Studio licence has expired."
        window.dispatchEvent(new CustomEvent('ss-signed-out', { detail: { message: body?.error || '', code: body?.code || '' } }));
      } else if (body?.mustChangePassword) {
        window.dispatchEvent(new Event('ss-must-change-password'));
      }
    }
    return res;
  };
}
