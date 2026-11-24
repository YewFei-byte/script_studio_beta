// Sign-in sessions for the API. Logging in returns a signed token; the app
// sends it as "Authorization: Bearer <token>" on every /api call, and the
// middleware below rejects calls without a valid one.
//
// Tokens are HMAC-signed (not encrypted) JSON: { sub, username, role,
// company, branch, companyId, heron, exp }. The signing secret is
// SESSION_SECRET, or one generated once and kept in app_data so sessions
// survive restarts.
//
// companyId is the tenant: every request runs as that company (see
// tenant.js), so one company never reads or writes another's data. With
// Heron License on (server/heron.js) it is the person's Heron company and the
// session is re-checked against Heron's licence regularly; without Heron it
// is always the legacy company ''.
//
// The built-in master login (an emergency way in) is MASTER_USERNAME /
// MASTER_PASSWORD, defaulting to admin123 / admin123. It is switched OFF
// whenever Heron is on: it would get round the licence entirely.

import crypto from 'node:crypto';
import { heronEnabled, heronSession, SessionEnded } from './heron.js';
import { LEGACY_COMPANY, runAsCompany } from './tenant.js';

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (Heron re-checks far more often)

export const MASTER_USERNAME = process.env.MASTER_USERNAME || 'admin123';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'admin123';

export const MASTER_USER = { id: null, username: MASTER_USERNAME, displayName: 'Superadmin', role: 'Superadmin', branch: null, company: null };

export function isMasterLogin(username, password) {
  if (heronEnabled) return false;
  const a = Buffer.from(`${username}\n${password}`);
  const b = Buffer.from(`${MASTER_USERNAME}\n${MASTER_PASSWORD}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

let secretPromise = null;
function getSecret(pool) {
  if (process.env.SESSION_SECRET) return Promise.resolve(process.env.SESSION_SECRET);
  if (!secretPromise) {
    secretPromise = (async () => {
      if (!pool) return crypto.randomBytes(32).toString('hex'); // local dev without a DB: sessions end on restart
      const read = () => pool.query("SELECT value FROM app_data WHERE company_id = '' AND key = 'sessionSecret'");
      const { rows } = await read();
      if (typeof rows[0]?.value === 'string') return rows[0].value;
      const secret = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO app_data (company_id, key, value) VALUES ('', 'sessionSecret', $1) ON CONFLICT DO NOTHING`,
        [JSON.stringify(secret)]
      );
      return (await read()).rows[0].value;
    })().catch((err) => {
      secretPromise = null;
      throw err;
    });
  }
  return secretPromise;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

export async function issueToken(pool, user) {
  const payload = {
    sub: user.id ?? 'master',
    username: user.username,
    role: user.role,
    company: user.company || null,
    branch: user.branch || null,
    companyId: user.companyId ?? LEGACY_COMPANY,
    heron: !!user.heron,
    exp: Date.now() + TTL_MS,
  };
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body, await getSecret(pool))}`;
}

export async function verifyToken(pool, token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = sign(body, await getSecret(pool));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

// API calls that must work without signing in.
function isPublic(req) {
  if (req.method === 'POST' && req.path === '/api/auth/login') return true;
  // Images are fetched by Facebook / Instagram and shown on hosted pages.
  if (req.method === 'GET' && req.path.startsWith('/api/poster-image/')) return true;
  return false;
}

// Reachable while Heron requires a new password before anything else.
const DURING_PASSWORD_CHANGE = new Set(['/api/auth/change-password', '/api/auth/logout', '/api/auth/me']);

const ADMIN_ROLES = new Set(['Superadmin', 'Admin']);

const signedOut = (res, error, code) => res.status(401).json({ error, signedOut: true, ...(code ? { code } : {}) });

// Mounted before all /api routes. Sets req.user for signed-in calls and runs
// the rest of the request as the user's company.
export function authMiddleware(pool, { ensureSchema } = {}) {
  return async (req, res, next) => {
    if (!req.path.startsWith('/api/') || isPublic(req)) return next();
    try {
      if (pool && ensureSchema) await ensureSchema();
      const header = req.get('authorization') || '';
      const user = await verifyToken(pool, header.startsWith('Bearer ') ? header.slice(7) : '');
      if (!user) return signedOut(res, 'Please sign in again.');

      // A session from before Heron was switched on (or off) belongs to the
      // other sign-in system: sign in again.
      if (!!user.heron !== heronEnabled) return signedOut(res, 'Please sign in again.');

      if (heronEnabled) {
        if (!pool) return res.status(503).json({ error: 'Database is not configured on this server yet.' });
        let link;
        try {
          link = await heronSession(pool, user.sub);
        } catch (err) {
          if (err instanceof SessionEnded) return signedOut(res, err.message, err.code);
          throw err;
        }
        if (link.company_id !== user.companyId) return signedOut(res, 'Please sign in again.');
        if (link.must_change_password && !DURING_PASSWORD_CHANGE.has(req.path)) {
          return res.status(403).json({ error: 'Choose a new password to continue.', mustChangePassword: true });
        }
        req.heronLink = link;
      }
      req.user = user;

      // Only Admins change the shared settings and other people's logins.
      const isAdmin = ADMIN_ROLES.has(user.role);
      const writes = req.method !== 'GET';
      if (writes && !isAdmin) {
        if (/^\/api\/data\/apiKeys$/.test(req.path) || /^\/api\/data\/brandKit/.test(req.path) || /^\/api\/credentials\//.test(req.path)) {
          return res.status(403).json({ error: 'Only an Admin can change this.' });
        }
        const userRoute = req.path.match(/^\/api\/users(?:\/(\d+))?$/);
        if (userRoute && !(req.method === 'PUT' && String(user.sub) === userRoute[1])) {
          return res.status(403).json({ error: 'Only an Admin can manage logins.' });
        }
        // Editing your own login: name and password only, never your role.
        if (userRoute && req.body) {
          delete req.body.role;
          delete req.body.branch;
          delete req.body.company;
        }
      }
      return runAsCompany(heronEnabled ? user.companyId : LEGACY_COMPANY, next);
    } catch (err) {
      console.error('[auth] check failed:', err.message);
      return res.status(500).json({ error: 'Could not check your sign-in.' });
    }
  };
}
