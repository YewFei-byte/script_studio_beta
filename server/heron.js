// Heron License: Presoft's central sign-in and licensing service.
//
// When HERON_URL is set, Heron checks every password and every licence, and
// Script Studio keeps only what people may DO here (role, branch, project
// permissions). Without HERON_URL nothing changes: logins are checked against
// app_users as before.
//
// Heron's API contract lives in Heron-License/referMD/HANDOFF-PRODUCT-A.md.
// The product key and secret authenticate this server to Heron and must never
// reach a browser -- they are only read here.
//
// Each login's Heron session (refresh + access token) is kept server-side in
// heron_links. The browser only ever holds Script Studio's own session token.
// At least every CHECK_MINUTES the session is refreshed with Heron, which
// re-runs Heron's full licence check: an expired or suspended licence, a
// deactivated login or a revoked grant signs people out within that window.

export const HERON_URL = (process.env.HERON_URL || '').trim().replace(/\/+$/, '');
export const heronEnabled = !!HERON_URL;

const PRODUCT_KEY = (process.env.HERON_PRODUCT_KEY || '').trim();
const PRODUCT_SECRET = (process.env.HERON_PRODUCT_SECRET || '').trim();
// Who owns everything created before Heron was switched on (see tenant.js).
export const LEGACY_OWNER = (process.env.HERON_LEGACY_COMPANY_ID || '').trim();

const CHECK_MS = Number(process.env.HERON_CHECK_MINUTES || 10) * 60 * 1000;
// How long people already signed in may carry on while Heron can't be reached.
const GRACE_MS = Number(process.env.HERON_GRACE_HOURS || 24) * 60 * 60 * 1000;
const TIMEOUT_MS = 10 * 1000;

if (heronEnabled) {
  if (!PRODUCT_KEY || !PRODUCT_SECRET) {
    console.error('[heron] HERON_URL is set but HERON_PRODUCT_KEY / HERON_PRODUCT_SECRET are missing -- every sign-in will fail.');
  }
  if (!LEGACY_OWNER) {
    console.warn('[heron] HERON_LEGACY_COMPANY_ID is not set -- data created before Heron stays unassigned and nobody will see it.');
  }
  console.log(`[heron] Sign-in and licensing by Heron License at ${HERON_URL}.`);
}

export class HeronError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// What a person sees for each code (HANDOFF-PRODUCT-A.md §4).
const MESSAGES = {
  INVALID_CREDENTIALS: 'Incorrect username or password.',
  ACCOUNT_LOCKED: 'Too many failed attempts. Try again shortly, or ask your administrator.',
  USER_INACTIVE: 'This account has been deactivated. Contact your administrator.',
  COMPANY_INACTIVE: "Your organisation's account is inactive. Contact support.",
  LICENSE_NOT_FOUND: "Your organisation isn't licensed for Script Studio.",
  LICENSE_SUSPENDED: "Your organisation's Script Studio licence is suspended. Contact support.",
  LICENSE_EXPIRED: "Your organisation's Script Studio licence has expired. Contact support to renew.",
  LICENSE_NOT_STARTED: "Your organisation's Script Studio licence hasn't started yet.",
  PRODUCT_ACCESS_DENIED: "Your account doesn't have access to Script Studio.",
  RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
  TOKEN_INVALID: 'Your session has ended. Please sign in again.',
  TOKEN_EXPIRED: 'Your session has ended. Please sign in again.',
  NOT_COMPANY_ADMIN: 'Only an administrator of your organisation in Heron License can manage logins.',
  MUST_CHANGE_PASSWORD: 'Change your own password first, then try again.',
  HERON_UNREACHABLE: "Sign-in service isn't reachable right now. Try again in a moment.",
};

// Codes whose own message from Heron is safe and useful to show as-is.
const SHOW_HERON_MESSAGE = new Set(['CONFLICT', 'SEAT_LIMIT_REACHED', 'WEAK_PASSWORD', 'INSUFFICIENT_COMPANY_ROLE', 'VALIDATION_ERROR', 'NOT_FOUND']);

const GENERIC = "Couldn't reach the sign-in service. Try again, or contact support.";

export function heronMessage(err) {
  if (!(err instanceof HeronError)) return GENERIC;
  if (MESSAGES[err.code]) return MESSAGES[err.code];
  if (err.code === 'WEAK_PASSWORD' && Array.isArray(err.details?.problems) && err.details.problems.length) {
    return `Password isn't strong enough: ${err.details.problems.join(' ')}`;
  }
  if (SHOW_HERON_MESSAGE.has(err.code) && err.message) return err.message;
  return GENERIC;
}

// HTTP status to answer the browser with for a Heron failure.
export function heronStatus(err) {
  if (!(err instanceof HeronError)) return 502;
  if (err.code === 'PRODUCT_CREDENTIALS_INVALID' || err.code === 'PRODUCT_INACTIVE' || err.status >= 500) return 502;
  return err.status;
}

async function call(method, path, { body, accessToken } = {}) {
  const headers = {
    'X-Heron-Product-Key': PRODUCT_KEY,
    'X-Heron-Product-Secret': PRODUCT_SECRET,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res;
  try {
    res = await fetch(`${HERON_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new HeronError(503, 'HERON_UNREACHABLE', `Heron unreachable: ${err.message}`);
  }
  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error || {};
    const err = new HeronError(res.status, e.code || 'HERON_ERROR', e.message, e.details);
    if (err.code === 'PRODUCT_CREDENTIALS_INVALID') {
      console.error('[heron] Heron rejected this product\'s credentials -- check HERON_PRODUCT_KEY / HERON_PRODUCT_SECRET (the secret may have been rotated in Heron\'s console).');
    } else if (err.code === 'PRODUCT_INACTIVE') {
      console.error('[heron] Script Studio is switched off in Heron\'s console (Products).');
    }
    throw err;
  }
  return json;
}

export const heron = {
  login: (username, password) => call('POST', '/api/v1/auth/login', { body: { username, password } }),
  refresh: (refreshToken) => call('POST', '/api/v1/auth/refresh', { body: { refreshToken } }),
  logout: (refreshToken) => call('POST', '/api/v1/auth/logout', { body: { refreshToken } }),
  changePassword: (accessToken, currentPassword, newPassword) =>
    call('POST', '/api/v1/auth/change-password', { accessToken, body: { currentPassword, newPassword } }),
  createUser: (accessToken, body) => call('POST', '/api/v1/users', { accessToken, body }),
  updateUser: (accessToken, id, body) => call('PATCH', `/api/v1/users/${encodeURIComponent(id)}`, { accessToken, body }),
  setPassword: (accessToken, id, body) => call('POST', `/api/v1/users/${encodeURIComponent(id)}/set-password`, { accessToken, body }),
  deactivateUser: (accessToken, id) => call('DELETE', `/api/v1/users/${encodeURIComponent(id)}`, { accessToken }),
};

// The access token's claims. It came straight from Heron over TLS, so it is
// only read here, not verified; it is never trusted from a browser.
export function tokenClaims(accessToken) {
  try {
    return JSON.parse(Buffer.from(String(accessToken).split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

// Heron's company rank → the role a login starts with in Script Studio.
// After the first sign-in the role is Script Studio's to change.
export function startingRole(companyRole) {
  if (companyRole === 'superadmin') return 'Superadmin';
  if (companyRole === 'admin') return 'Admin';
  return 'Member';
}

export function licenseSummary(license) {
  if (!license) return null;
  return {
    expiresAt: license.expiresAt ?? license.expires_at ?? null,
    daysRemaining: license.daysRemaining ?? license.days_remaining ?? null,
    settings: license.settings || {},
  };
}

// --- server-side Heron sessions ------------------------------------------------

export async function saveLink(pool, appUserId, payload) {
  const expires = payload.accessTokenExpiresAt || new Date(Date.now() + (payload.expiresIn || 900) * 1000).toISOString();
  await pool.query(
    `INSERT INTO heron_links (app_user_id, heron_user_id, company_id, refresh_token, access_token, access_expires_at, checked_at, must_change_password, license)
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8)
     ON CONFLICT (app_user_id) DO UPDATE SET
       heron_user_id = $2, company_id = $3, refresh_token = $4, access_token = $5, access_expires_at = $6,
       checked_at = now(), must_change_password = $7, license = $8`,
    [
      appUserId,
      payload.user.id,
      payload.user.companyId,
      payload.refreshToken,
      payload.accessToken,
      expires,
      !!payload.user.mustChangePassword,
      JSON.stringify(licenseSummary(payload.license)),
    ]
  );

  await pool.query(
    `INSERT INTO companies (company_id, name, license_expires_at, blocked_code, last_seen_at) VALUES ($1, $2, $3, NULL, now())
     ON CONFLICT (company_id) DO UPDATE SET
       name = COALESCE($2, companies.name), license_expires_at = $3, blocked_code = NULL, last_seen_at = now()`,
    [payload.user.companyId, payload.user.companyName || null, licenseSummary(payload.license)?.expiresAt || null]
  );
}

// Heron refused a company outright (not one person): remembered so the
// scheduler stops publishing for it until someone signs in successfully again.
const COMPANY_BLOCKS = new Set(['COMPANY_INACTIVE', 'LICENSE_NOT_FOUND', 'LICENSE_SUSPENDED', 'LICENSE_EXPIRED', 'LICENSE_NOT_STARTED', 'PRODUCT_INACTIVE']);

async function blockCompany(pool, company, code) {
  if (!COMPANY_BLOCKS.has(code)) return;
  await pool.query('UPDATE companies SET blocked_code = $2, last_seen_at = now() WHERE company_id = $1', [company, code]);
}

// Whether the scheduler may publish for this company right now.
export async function companyLicensed(pool, company) {
  const { rows } = await pool.query('SELECT license_expires_at, blocked_code FROM companies WHERE company_id = $1', [company]);
  const row = rows[0];
  if (!row) return false; // nobody from it has signed in through Heron yet
  if (row.blocked_code) return false;
  return !row.license_expires_at || new Date(row.license_expires_at).getTime() > Date.now();
}

export async function dropLink(pool, appUserId) {
  await pool.query('DELETE FROM heron_links WHERE app_user_id = $1', [appUserId]);
}

// The session is over: the person must sign in again (and why).
export class SessionEnded extends Error {
  constructor(code) {
    super(MESSAGES[code] || MESSAGES.TOKEN_INVALID);
    this.code = code || 'TOKEN_INVALID';
  }
}

// Heron rotates refresh tokens and treats a reused one as theft, so two
// refreshes for the same login must never overlap: they queue here.
const queues = new Map();
function serialised(key, fn) {
  const prev = queues.get(key) || Promise.resolve();
  const run = prev.then(fn);
  // The queue's own copy never rejects (the caller handles `run`'s outcome);
  // a rejected promise left in the queue would crash the process as unhandled.
  const cleanup = () => {
    if (queues.get(key) === tail) queues.delete(key);
  };
  const tail = run.then(cleanup, cleanup);
  queues.set(key, tail);
  return run;
}

// Returns the login's current Heron session, refreshing it with Heron when
// the last licence check is older than CHECK_MS, or (needAccess) when an
// access token for a Heron call is about to expire.
//
// Throws SessionEnded when Heron says no (licence, deactivation, revoked
// session). If Heron can't be reached the session carries on, for up to
// GRACE_MS since the last successful check -- except needAccess, which has
// nothing to carry on with.
export function heronSession(pool, appUserId, { needAccess = false } = {}) {
  return serialised(String(appUserId), async () => {
    const { rows } = await pool.query('SELECT * FROM heron_links WHERE app_user_id = $1', [appUserId]);
    const link = rows[0];
    if (!link) throw new SessionEnded('TOKEN_INVALID');

    const now = Date.now();
    const stale = now - new Date(link.checked_at).getTime() > CHECK_MS;
    const accessDue = new Date(link.access_expires_at).getTime() - now < 60 * 1000;
    if (!stale && !(needAccess && accessDue)) return link;

    try {
      const payload = await heron.refresh(link.refresh_token);
      await saveLink(pool, appUserId, payload);
      const again = await pool.query('SELECT * FROM heron_links WHERE app_user_id = $1', [appUserId]);
      return again.rows[0];
    } catch (err) {
      const outage =
        !(err instanceof HeronError) ||
        err.code === 'HERON_UNREACHABLE' ||
        err.code === 'RATE_LIMITED' ||
        err.code === 'PRODUCT_CREDENTIALS_INVALID' ||
        err.status >= 500;
      if (outage) {
        console.warn(`[heron] Could not refresh login ${appUserId}'s session: ${err.message}`);
        if (needAccess) throw err;
        if (now - new Date(link.checked_at).getTime() > GRACE_MS) throw new SessionEnded('HERON_UNREACHABLE');
        return link;
      }
      // Heron's answer is no: licence expired/suspended, login deactivated,
      // session revoked. That ends the session here too.
      await blockCompany(pool, link.company_id, err.code);
      await dropLink(pool, appUserId);
      throw new SessionEnded(err.code);
    }
  });
}
