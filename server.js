// Small Node server: serves the built frontend (dist/) and a tiny JSON API
// backed by Postgres for storing social-platform credentials (currently just
// Facebook's Page ID/name/access token) so they survive across browsers and
// devices instead of living only in one machine's localStorage.
//
// This is intentionally best-effort and additive:
// - If DATABASE_URL isn't set (e.g. running locally without Postgres
//   attached), the API routes below just report "not configured" instead of
//   crashing, and the frontend silently keeps using localStorage only, same
//   as before this file existed.
// - Nothing here touches or replaces the existing localStorage behavior in
//   the frontend -- it's an additional sync target, not a replacement.
//
// Railway setup (one-time):
//   1. In your Railway project, click "New" -> "Database" -> "Add PostgreSQL".
//   2. Make sure this service has a DATABASE_URL variable pointing at it
//      (Railway usually offers to wire this up automatically; if not, add a
//      variable reference to the Postgres plugin's DATABASE_URL).
//   3. Change this service's Start Command to: npm start
//      (previously: npm run preview -- --host 0.0.0.0 --port $PORT)

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import multer from 'multer';
import { ensureSitesSchema, publishSite, registerSitesRoutes, sitesMiddleware, validateSlug } from './server/sites.js';
import { authMiddleware } from './server/auth.js';
import { LEGACY_OWNER, companyLicensed, heronEnabled } from './server/heron.js';
import { companyId, ensureTenancySchema, runAsCompany } from './server/tenant.js';
import { registerUserRoutes } from './server/users.js';
import { ConfigError, registerAiRoutes } from './server/ai.js';
import { registerBrandRoutes } from './server/brand.js';
import { buildLandingPage, registerLandingAiRoutes, registerLandingChatRoutes } from './server/landingBuild.js';
import { registerPostChatRoutes, registerPostRoutes } from './server/postBuild.js';
import { publishFacebook, publishInstagram } from './shared/socialPublish.js';
import {
  ensureContentSchema,
  listContentItems,
  patchContentItem,
  registerContentRoutes,
} from './server/content.js';

const { Pool } = pg;

// Pick up a local .env when running `npm start` outside Railway/Docker
// (e.g. ANTHROPIC_API_KEY for landing pages). Variables
// already set in the real environment win; a missing file is fine.
try {
  process.loadEnvFile();
} catch {
  // no .env -- rely on the real environment
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Railway (like Heroku and most PaaS hosts) terminates HTTPS at its own
// edge/load balancer and forwards plain HTTP internally, so without this,
// Express has no way to know the original request was actually https --
// req.protocol reports 'http' unconditionally. That matters here because
// /api/poster-image and /api/media build a public URL from req.protocol for
// Facebook/Instagram to fetch the image from (see those routes below); an
// http:// URL either gets rejected outright (Facebook's Graph API returned
// exactly that: "(#100) url should represent a valid URL") or silently
// redirected somewhere Facebook's fetcher doesn't follow, since Railway
// itself only actually serves https. Trusting the proxy makes req.protocol
// read the real X-Forwarded-Proto header Railway sets, so it correctly
// reports 'https'.
app.set('trust proxy', true);
// Bumped from 15mb: the whole Post/Landing Page content list (see the
// /api/data routes below) can now be synced here in one request, and that
// list can contain several generated posters' worth of base64 images at
// once, not just a single one.
app.use(express.json({ limit: '30mb' }));

// Where uploaded media (Instagram images, YouTube videos) gets written
// temporarily. Instagram's Graph API needs a real, publicly-fetchable image
// URL — it can't accept raw bytes the way Facebook's photos endpoint can —
// so this directory, served statically below, is what makes that URL exist.
// Railway's filesystem isn't guaranteed to persist across deploys, but these
// files only need to live long enough for Instagram to fetch them once.
const mediaDir = path.join(__dirname, 'media-uploads');
fs.mkdirSync(mediaDir, { recursive: true });
const upload = multer({ dest: mediaDir, limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB covers a short video clip

const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      // Railway's internal Postgres needs this to accept the connection over
      // its managed proxy. A local database (docker-compose's `db`,
      // localhost) has no SSL at all, so skip it there or when the URL says
      // sslmode=disable.
      ssl:
        /sslmode=disable/.test(DATABASE_URL) || /@(localhost|127\.0\.0\.1|db)(:\d+)?\//.test(DATABASE_URL)
          ? false
          : { rejectUnauthorized: false },
    })
  : null;

// Hosted landing pages (<slug>.pages.presoft.my) are answered before
// anything else -- see server/sites.js. Every other hostname is the app.
app.use(sitesMiddleware(pool));

// Every /api call needs a signed-in session, except logging in and public
// images (see server/auth.js).
app.use(authMiddleware(pool, { ensureSchema }));

// Team invite emails (see /api/invite-email below) — sent via Resend's
// HTTP API (api.enginemailer.com), not raw SMTP. This used to go through
// Gmail SMTP (nodemailer), but that reliably failed with "Connection
// timeout" on this Railway deployment even after forcing IPv4 DNS
// resolution — meaning the outbound connection to Gmail's SMTP port was
// never completing at all, most likely because this host's network
// blocks/restricts raw SMTP ports (25/465/587) outright, a common
// anti-abuse measure on shared cloud hosting. EngineMailer's REST API
// sends over a normal HTTPS POST (port 443, same as every other API call
// this server makes), which sidesteps that class of problem entirely.
//   1. Sign up / log in at enginemailer.com and grab your API key (their
//      docs describe it as a single "APIKey" header value — see
//      enginemailer.zendesk.com/hc/en-us/articles/23132996552473).
//   2. Set ENGINEMAILER_API_KEY to that key as a Railway variable.
//   3. Set ENGINEMAILER_SENDER_EMAIL to a sender address verified on your
//      EngineMailer account (their API requires SenderEmail to match a
//      verified domain — an unverified sender will get rejected by them,
//      not by this code). Optionally set ENGINEMAILER_SENDER_NAME too.
// This integration is based on EngineMailer's public documentation, not a
// live-tested account — if the exact header/field format turns out to
// differ, their API's own error response is surfaced in the failure
// banner/deploy logs so it's fixable without guessing blind.
// If ENGINEMAILER_API_KEY or ENGINEMAILER_SENDER_EMAIL is missing,
// /api/invite-email just reports "not configured" instead of crashing --
// same best-effort pattern as DATABASE_URL above.
const ENGINEMAILER_API_KEY = process.env.ENGINEMAILER_API_KEY;
const ENGINEMAILER_SENDER_EMAIL = process.env.ENGINEMAILER_SENDER_EMAIL;
const ENGINEMAILER_SENDER_NAME = process.env.ENGINEMAILER_SENDER_NAME || 'Script Studio';

async function sendInviteEmailViaEngineMailer({ to, greetName, username, password, loginUrl }) {
  const html = `
        <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <h2 style="margin-bottom: 4px;">You're invited to Script Studio</h2>
          <p>Hi ${greetName},</p>
          <p>You've been added as a member of Script Studio. Here are your login details:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 12px; background: #f3f4f6; border-radius: 6px 0 0 6px; font-weight: 600;">Username</td>
              <td style="padding: 8px 12px; background: #f9fafb; border-radius: 0 6px 6px 0;">${username}</td>
            </tr>
            <tr><td colspan="2" style="height: 6px;"></td></tr>
            <tr>
              <td style="padding: 8px 12px; background: #f3f4f6; border-radius: 6px 0 0 6px; font-weight: 600;">Password</td>
              <td style="padding: 8px 12px; background: #f9fafb; border-radius: 0 6px 6px 0;">${password}</td>
            </tr>
          </table>
          <p style="text-align: center; margin: 28px 0;">
            <a href="${loginUrl}" style="background: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; display: inline-block;">Accept Invite &amp; Log In</a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:<br/>${loginUrl}</p>
        </div>
      `;

  const res = await fetch('https://api.enginemailer.com/RESTAPI/V2/Submission/SendEmail', {
    method: 'POST',
    headers: {
      APIKey: ENGINEMAILER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ToEmail: to,
      SenderEmail: ENGINEMAILER_SENDER_EMAIL,
      SenderName: ENGINEMAILER_SENDER_NAME,
      Subject: "You've been invited to Script Studio",
      SubmittedContent: html,
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.IsError) {
    throw new Error(body?.Message || body?.message || `EngineMailer request failed (HTTP ${res.status}).`);
  }
}

if (!ENGINEMAILER_API_KEY || !ENGINEMAILER_SENDER_EMAIL) {
  console.warn('[server] ENGINEMAILER_API_KEY/ENGINEMAILER_SENDER_EMAIL not set -- /api/invite-email will report "not configured".');
}

if (!DATABASE_URL) {
  console.warn('[server] DATABASE_URL not set -- /api/credentials routes will report "not configured". Frontend will keep using localStorage only.');
}

let schemaReadyPromise = null;
function ensureSchema() {
  if (!pool) return Promise.resolve();
  if (!schemaReadyPromise) {
    schemaReadyPromise = createBaseSchema()
      .then(() => ensureContentSchema(pool))
      .then(() => ensureSitesSchema(pool))
      // Every company-owned table gets company_id; see server/tenant.js.
      .then(() => ensureTenancySchema(pool, { legacyOwner: heronEnabled ? LEGACY_OWNER : '' }))
      .catch((err) => {
        schemaReadyPromise = null; // retry on the next request
        throw err;
      });
  }
  return schemaReadyPromise;
}

function createBaseSchema() {
    return pool.query(`
      CREATE TABLE IF NOT EXISTS social_credentials (
        platform TEXT PRIMARY KEY,
        connected BOOLEAN NOT NULL DEFAULT false,
        page_id TEXT,
        page_name TEXT,
        access_token TEXT,
        -- Instagram reuses Facebook's page_id/access_token above (an IG
        -- Business account posts through its linked Page's token) and only
        -- needs its own numeric Business Account ID here.
        business_id TEXT,
        -- YouTube's OAuth credentials — Client ID/Secret from Google Cloud
        -- Console, plus a Refresh Token obtained once via a consent flow
        -- (see docs shown in Social Media → YouTube in the app).
        client_id TEXT,
        client_secret TEXT,
        refresh_token TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'Member',
        branch TEXT,
        company TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Generic shared-state store for whatever used to live only in one
      -- browser's localStorage: the Post/Landing Page content list (key
      -- 'content') and the AI generation API keys (key 'apiKeys') are the
      -- two things this is used for right now. One JSONB blob per key, same
      -- shape as what was already being JSON.stringify'd into localStorage
      -- — see src/utils/dataApi.js on the frontend for how this gets read
      -- and written. This is what makes "everyone who logs in sees the same
      -- posts/keys" actually true instead of each browser having its own
      -- private copy.
      CREATE TABLE IF NOT EXISTS app_data (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Generated poster images (from OpenAI/Gemini image generation, or a
      -- manually uploaded post image) used to be embedded directly as
      -- base64 data: URLs inside the 'content' blob above -- every post's
      -- images, all crammed into one JSON value. That blob eventually grew
      -- past both the browser's localStorage quota and this server's 30MB
      -- request-body limit, and since the old save code never checked for
      -- failure, saves after that point silently vanished (a scheduled post
      -- would look fine in the browser, then disappear on the next reload
      -- because it was never actually persisted anywhere). Storing each
      -- image as its own row here -- referenced from 'content' by a short
      -- /api/poster-image/:id URL instead of the raw base64 -- keeps every
      -- individual save small regardless of how much image history piles
      -- up. Deliberately Postgres, not local disk: Railway's filesystem
      -- isn't guaranteed to survive a redeploy (see mediaDir above, which
      -- is fine for Instagram's one-time fetch but wrong for anything meant
      -- to persist), while Postgres already is this app's durable store.
      CREATE TABLE IF NOT EXISTS media_images (
        id TEXT PRIMARY KEY,
        mime TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      -- Deployments created before Instagram/YouTube support already have a
      -- social_credentials table without these columns — CREATE TABLE IF NOT
      -- EXISTS above won't add columns to a table that already exists, so
      -- these migrate any pre-existing table forward safely.
      ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS business_id TEXT;
      ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS client_id TEXT;
      ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS client_secret TEXT;
      ALTER TABLE social_credentials ADD COLUMN IF NOT EXISTS refresh_token TEXT;

      -- Which Admin (or Superadmin) created this login, for the "use my
      -- creator's own API key before falling back to the shared default"
      -- rule -- see the effectiveApiKeys logic in AdminPanel.jsx and the
      -- per-admin key stored under app_data key 'apiKeys:admin:<id>'.
      -- Nullable: a Superadmin-created login (or the admin123 master login,
      -- which never has a row here at all) has no admin "owner", so it
      -- always resolves straight to the shared default.
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_by_admin_id INTEGER REFERENCES app_users(id);

      -- Multi-company support: a Company sits above Branch (Company ->
      -- Branch -> Member/login). Nullable because deployments that predate
      -- this feature, and the Superadmin/admin123 master login, have no
      -- single owning company. See src/pages/AdminPanel.jsx's visibleContent
      -- for how Admin visibility is scoped to the company field now instead of
      -- unrestricted "every branch".
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS company TEXT;
    `);
}


// GET /api/credentials/:platform -> { configured, connected, pageId, pageName, accessToken, businessId, clientId, clientSecret, refreshToken }
app.get('/api/credentials/:platform', async (req, res) => {
  if (!pool) return res.json({ configured: false, connected: false });
  try {
    await ensureSchema();
    const { rows } = await pool.query('SELECT * FROM social_credentials WHERE company_id = $2 AND platform = $1', [req.params.platform, companyId()]);
    const r = rows[0];
    if (!r) return res.json({ configured: true, connected: false });
    res.json({
      configured: true,
      connected: r.connected,
      pageId: r.page_id || '',
      pageName: r.page_name || '',
      accessToken: r.access_token || '',
      businessId: r.business_id || '',
      clientId: r.client_id || '',
      clientSecret: r.client_secret || '',
      refreshToken: r.refresh_token || '',
    });
  } catch (err) {
    console.error('[server] GET /api/credentials failed:', err.message);
    res.status(500).json({ error: 'Could not load saved credentials.' });
  }
});

// POST /api/credentials/:platform  body: { pageId, pageName, accessToken, businessId, clientId, clientSecret, refreshToken }
// Every field is optional and COALESCEd against the existing row, so saving
// (say) just a new Instagram businessId doesn't wipe Facebook's token that
// Instagram itself reuses.
app.post('/api/credentials/:platform', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database is not configured on this server yet.' });
  const { pageId, pageName, accessToken, businessId, clientId, clientSecret, refreshToken } = req.body || {};
  try {
    await ensureSchema();
    await pool.query(
      `INSERT INTO social_credentials (company_id, platform, connected, page_id, page_name, access_token, business_id, client_id, client_secret, refresh_token, updated_at)
       VALUES ($9, $1, true, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (company_id, platform) DO UPDATE SET
         connected = true,
         page_id = COALESCE($2, social_credentials.page_id),
         page_name = COALESCE($3, social_credentials.page_name),
         access_token = COALESCE($4, social_credentials.access_token),
         business_id = COALESCE($5, social_credentials.business_id),
         client_id = COALESCE($6, social_credentials.client_id),
         client_secret = COALESCE($7, social_credentials.client_secret),
         refresh_token = COALESCE($8, social_credentials.refresh_token),
         updated_at = now()`,
      [req.params.platform, pageId || null, pageName || null, accessToken || null, businessId || null, clientId || null, clientSecret || null, refreshToken || null, companyId()]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[server] POST /api/credentials failed:', err.message);
    res.status(500).json({ error: 'Could not save credentials.' });
  }
});

// DELETE /api/credentials/:platform -> marks as disconnected, clears every field
app.delete('/api/credentials/:platform', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database is not configured on this server yet.' });
  try {
    await ensureSchema();
    await pool.query(
      `INSERT INTO social_credentials (company_id, platform, connected, page_id, page_name, access_token, business_id, client_id, client_secret, refresh_token, updated_at)
       VALUES ($2, $1, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, now())
       ON CONFLICT (company_id, platform) DO UPDATE SET
         connected = false, page_id = NULL, page_name = NULL, access_token = NULL,
         business_id = NULL, client_id = NULL, client_secret = NULL, refresh_token = NULL, updated_at = now()`,
      [req.params.platform, companyId()]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[server] DELETE /api/credentials failed:', err.message);
    res.status(500).json({ error: 'Could not disconnect.' });
  }
});

// --- Shared app data (Post/Landing Page content, API keys) -----------------
// Generic get/set for the app_data table above. Any key works, but the
// frontend (src/utils/dataApi.js) only ever uses 'content' and 'apiKeys'
// today. Same best-effort philosophy as /api/credentials: if Postgres isn't
// configured, these report "not configured" and the frontend just keeps
// using localStorage only, exactly like before this existed.
//
// NOTE ON SECURITY: same caveat as /api/users below — there's no login/
// session check on these routes, so anyone who finds the URL can currently
// read or overwrite this data. Fine for now given the app's single shared
// front door, worth locking down later.
// The server's own session-signing secret lives in app_data too; it is never
// readable or writable through these routes.
const PRIVATE_DATA_KEYS = new Set(['sessionSecret']);

app.get('/api/data/:key', async (req, res) => {
  if (!pool) return res.json({ configured: false, value: null });
  if (PRIVATE_DATA_KEYS.has(req.params.key)) return res.status(404).json({ error: 'Not found.' });
  try {
    await ensureSchema();
    const { rows } = await pool.query('SELECT value FROM app_data WHERE company_id = $2 AND key = $1', [req.params.key, companyId()]);
    res.json({ configured: true, value: rows[0]?.value ?? null });
  } catch (err) {
    console.error('[server] GET /api/data failed:', err.message);
    res.status(500).json({ error: 'Could not load saved data.' });
  }
});

app.post('/api/data/:key', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database is not configured on this server yet.' });
  if (PRIVATE_DATA_KEYS.has(req.params.key)) return res.status(404).json({ error: 'Not found.' });
  try {
    await ensureSchema();
    await pool.query(
      `INSERT INTO app_data (company_id, key, value, updated_at) VALUES ($3, $1, $2, now())
       ON CONFLICT (company_id, key) DO UPDATE SET value = $2, updated_at = now()`,
      [req.params.key, JSON.stringify(req.body?.value ?? null), companyId()]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[server] POST /api/data failed:', err.message);
    res.status(500).json({ error: 'Could not save data.' });
  }
});

// Stores one generated/uploaded poster image (as a base64 data: URL) in
// Postgres and returns a short, stable URL to it (/api/poster-image/:id).
// See the media_images table comment above for why this exists instead of
// keeping images embedded in the 'content' blob or written to local disk.
app.post('/api/poster-image', async (req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database is not configured on this server yet.' });
  const { dataUrl } = req.body || {};
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return res.status(400).json({ error: 'Expected a base64 data: URL.' });
  const [, mime, base64] = match;
  try {
    await ensureSchema();
    const id = crypto.randomUUID();
    await pool.query('INSERT INTO media_images (id, mime, data, company_id) VALUES ($1, $2, $3, $4)', [id, mime, base64, companyId()]);
    // Absolute, not relative -- Instagram's Graph API (and Facebook's
    // /photos?url=... form) can only fetch a real, publicly-resolvable
    // URL, same reasoning as /api/media's publicUrl just above.
    res.json({ url: `${req.protocol}://${req.get('host')}/api/poster-image/${id}` });
  } catch (err) {
    console.error('[server] POST /api/poster-image failed:', err.message);
    res.status(500).json({ error: 'Could not save the image.' });
  }
});

app.get('/api/poster-image/:id', async (req, res) => {
  if (!pool) return res.status(503).end();
  try {
    await ensureSchema();
    const { rows } = await pool.query('SELECT mime, data FROM media_images WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).end();
    res.set('Content-Type', rows[0].mime);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(rows[0].data, 'base64'));
  } catch (err) {
    console.error('[server] GET /api/poster-image failed:', err.message);
    res.status(500).end();
  }
});

// --- Posts / landing pages, one row per item (see server/content.js) -------
registerContentRoutes(app, { pool, ensureSchema });

// --- AI (Claude) + Presoft hosting ------------------------------------------
// Keys come from Settings -> API (the shared apiKeys blob) or, failing that,
// the server's ANTHROPIC_API_KEY env var (see server/ai.js).
function sendAiError(res, label, err) {
  const status = err instanceof ConfigError ? err.status : 500;
  if (status >= 500) console.error(`[server] ${label} failed:`, err.message);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
}

registerBrandRoutes(app, { pool, sendError: sendAiError });
registerAiRoutes(app, { pool });

// ✨ editor actions: POST /api/landing/rewrite (one text), /api/landing/section (one section).
registerLandingAiRoutes(app, { pool, sendError: sendAiError });
// Social post copy: POST /api/posts/angles, /api/posts/copy (server/postBuild.js).
registerPostRoutes(app, { pool, sendError: sendAiError });
// Ask AI chats + caption rewrites: /api/landing/chat, /api/posts/chat, /api/posts/caption.
registerLandingChatRoutes(app, { pool, sendError: sendAiError });
registerPostChatRoutes(app, { pool, sendError: sendAiError });

// POST /api/landing/build  { goal, layout, brand, context?, notes?, photos? } -> { page }
// The new section-based generator (server/landingBuild.js).
app.post('/api/landing/build', async (req, res) => {
  try {
    if (pool) await ensureSchema();
    const started = Date.now();
    const page = await buildLandingPage(pool, req.body || {});
    console.log(`[landing] Built a "${req.body?.layout}" page (${page.sections.length} sections) in ${Math.round((Date.now() - started) / 1000)}s.`);
    res.json({ page });
  } catch (err) {
    sendAiError(res, 'POST /api/landing/build', err);
  }
});

// Presoft hosting: publish / unpublish / address check / stats.
registerSitesRoutes(app, { pool, ensureSchema, sendError: sendAiError });

// POST /api/media  (multipart, field name "file") -> { url }
// Saves an uploaded image to disk and returns a real, publicly-fetchable
// URL for it. Instagram's Graph API needs exactly this — it fetches the
// image itself from a URL rather than accepting uploaded bytes directly, so
// a generated poster (which only exists as a data: URL in the browser) has
// to be hosted somewhere real first.
app.post('/api/media', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const ext = (req.file.originalname.match(/\.[a-zA-Z0-9]+$/) || ['.png'])[0];
  const finalName = `${req.file.filename}${ext}`;
  fs.renameSync(req.file.path, path.join(mediaDir, finalName));
  const publicUrl = `${req.protocol}://${req.get('host')}/media/${finalName}`;
  res.json({ url: publicUrl });
});
app.use('/media', express.static(mediaDir));

// POST /api/youtube/publish  (multipart: video file + clientId/clientSecret/refreshToken/title/description)
// Exchanges the stored refresh token for a fresh access token, then uploads
// the video to YouTube via the Data API's multipart insert endpoint. The
// client secret and refresh token never touch the browser beyond this one
// request — Google's token endpoint doesn't allow browser-side CORS calls
// with a client secret anyway, so this has to happen server-side.
app.post('/api/youtube/publish', upload.single('video'), async (req, res) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    const { clientId, clientSecret, refreshToken, title, description } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded.' });
    if (!clientId || !clientSecret || !refreshToken) {
      cleanup();
      return res.status(400).json({ error: 'YouTube isn’t connected — save a Client ID, Client Secret, and Refresh Token first.' });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const tokenBody = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !tokenBody?.access_token) {
      cleanup();
      const reason = tokenBody?.error_description || tokenBody?.error || `HTTP ${tokenRes.status}`;
      return res.status(502).json({ error: `Could not refresh the YouTube access token (${reason}). The Refresh Token may be invalid or revoked — generate a new one.` });
    }

    const metadata = {
      snippet: { title: title || 'Untitled', description: description || '' },
      status: { privacyStatus: 'public' },
    };
    const videoBuffer = fs.readFileSync(req.file.path);
    const boundary = `ss_boundary_${crypto.randomUUID()}`;
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: ${req.file.mimetype || 'video/mp4'}\r\n\r\n`),
      videoBuffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const uploadRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenBody.access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    const uploadBody = await uploadRes.json().catch(() => null);
    cleanup();
    if (!uploadRes.ok || !uploadBody?.id) {
      const reason = uploadBody?.error?.message || `HTTP ${uploadRes.status}`;
      return res.status(502).json({ error: `YouTube rejected the upload: ${reason}` });
    }
    res.json({ id: uploadBody.id, link: `https://www.youtube.com/watch?v=${uploadBody.id}` });
  } catch (err) {
    cleanup();
    console.error('[server] POST /api/youtube/publish failed:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong uploading to YouTube.' });
  }
});

// --- Google Calendar: real auto-sync for scheduled posts -------------------
// Reuses the same social_credentials table as YouTube (platform = 'gcal'),
// since it already has client_id/client_secret/refresh_token columns and the
// existing GET/POST/DELETE /api/credentials/:platform routes above already
// read/write/clear them generically. This section just adds what's specific
// to Calendar: looking those credentials up server-side (so the client
// secret never has to be re-sent from the browser on every schedule change)
// and the three event routes that actually talk to Google Calendar.
async function getGcalCredentials() {
  if (!pool) return null;
  await ensureSchema();
  const { rows } = await pool.query('SELECT * FROM social_credentials WHERE company_id = $2 AND platform = $1', ['gcal', companyId()]);
  const r = rows[0];
  if (!r || !r.connected || !r.client_id || !r.client_secret || !r.refresh_token) return null;
  return { clientId: r.client_id, clientSecret: r.client_secret, refreshToken: r.refresh_token };
}

async function getGoogleAccessToken({ clientId, clientSecret, refreshToken }) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !body?.access_token) {
    const reason = body?.error_description || body?.error || `HTTP ${tokenRes.status}`;
    throw new Error(`Could not refresh the Google Calendar access token (${reason}). The Refresh Token may be invalid or revoked — generate a new one.`);
  }
  return body.access_token;
}

// POST /api/calendar/event  body: { title, description, startISO, endISO } -> { eventId, htmlLink }
// Called once when a post/landing page is first scheduled (see
// src/utils/googleCalendarSync.js) — creates a real event on the connected
// Google account's primary calendar, in addition to (not instead of) the
// app's own in-app calendar view.
app.post('/api/calendar/event', async (req, res) => {
  try {
    const creds = await getGcalCredentials();
    if (!creds) return res.status(400).json({ error: 'Google Calendar isn’t connected yet.' });
    const { title, description, startISO, endISO } = req.body || {};
    if (!startISO || !endISO) return res.status(400).json({ error: 'Missing event start/end time.' });
    const accessToken = await getGoogleAccessToken(creds);
    const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: title || 'Untitled',
        description: description || '',
        start: { dateTime: startISO },
        end: { dateTime: endISO },
      }),
    });
    const calBody = await calRes.json().catch(() => null);
    if (!calRes.ok || !calBody?.id) {
      const reason = calBody?.error?.message || `HTTP ${calRes.status}`;
      return res.status(502).json({ error: `Google Calendar rejected the event: ${reason}` });
    }
    res.json({ eventId: calBody.id, htmlLink: calBody.htmlLink });
  } catch (err) {
    console.error('[server] POST /api/calendar/event failed:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong creating the calendar event.' });
  }
});

// PUT /api/calendar/event/:id  body: { title, description, startISO, endISO } -> { eventId }
// Called when a post already on Google Calendar gets rescheduled — keeps the
// existing event instead of creating a duplicate.
app.put('/api/calendar/event/:id', async (req, res) => {
  try {
    const creds = await getGcalCredentials();
    if (!creds) return res.status(400).json({ error: 'Google Calendar isn’t connected yet.' });
    const { title, description, startISO, endISO } = req.body || {};
    const accessToken = await getGoogleAccessToken(creds);
    const calRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(req.params.id)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: title || 'Untitled',
        description: description || '',
        ...(startISO ? { start: { dateTime: startISO } } : {}),
        ...(endISO ? { end: { dateTime: endISO } } : {}),
      }),
    });
    const calBody = await calRes.json().catch(() => null);
    if (!calRes.ok) {
      const reason = calBody?.error?.message || `HTTP ${calRes.status}`;
      return res.status(502).json({ error: `Google Calendar rejected the update: ${reason}` });
    }
    res.json({ eventId: calBody.id || req.params.id });
  } catch (err) {
    console.error('[server] PUT /api/calendar/event failed:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong updating the calendar event.' });
  }
});

// DELETE /api/calendar/event/:id -> called when a scheduled post is
// unscheduled/unpublished, so the event doesn't linger on Google Calendar
// after the app no longer considers it scheduled.
app.delete('/api/calendar/event/:id', async (req, res) => {
  try {
    const creds = await getGcalCredentials();
    if (!creds) return res.json({ ok: true }); // nothing connected — nothing to delete
    const accessToken = await getGoogleAccessToken(creds);
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(req.params.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[server] DELETE /api/calendar/event failed:', err.message);
    res.status(500).json({ error: err.message || 'Something went wrong deleting the calendar event.' });
  }
});

// --- Logins and sign-in (server/users.js) ------------------------------------
// With Heron License on, passwords and licences are Heron's; see server/heron.js.
registerUserRoutes(app, { pool, ensureSchema });

// Sends a team invite email (username + password the Admin/Superadmin typed
// into the "Invite member" form, plus a link back into the login screen) via
// EngineMailer's HTTP API (see sendInviteEmailViaEngineMailer above).
// Best-effort: if ENGINEMAILER_API_KEY/ENGINEMAILER_SENDER_EMAIL aren't
// set, this just reports "not configured" -- the member/login is still
// created by the caller either way, they just won't get an email.
app.post('/api/invite-email', async (req, res) => {
  if (!ENGINEMAILER_API_KEY || !ENGINEMAILER_SENDER_EMAIL) {
    return res.status(503).json({ error: 'Email sending is not configured on this server yet.' });
  }
  const { to, name, username, password, appUrl } = req.body || {};
  if (!to || !username || !password) {
    return res.status(400).json({ error: 'to, username, and password are required.' });
  }
  const loginUrl = appUrl || 'https://scriptstudio.app';
  const greetName = name || 'there';
  try {
    await sendInviteEmailViaEngineMailer({ to, greetName, username, password, loginUrl });
    res.json({ ok: true });
  } catch (err) {
    console.error('[server] POST /api/invite-email failed:', err.message);
    res.status(500).json({ error: 'Could not send the invite email.' });
  }
});

// --- Auto-publish scheduler ------------------------------------------------
// Scheduling a post/landing page (see PublishScheduleModal.jsx) used to only
// ever record intent -- status: 'scheduled' plus a target time -- nothing
// actually watched the clock. It sat there until someone happened to open
// the app and click "Publish Now" themselves. This interval is what makes
// scheduling real: every AUTOPUBLISH_INTERVAL_MS it checks the shared
// content_items table (see server/content.js -- the same items every
// browser's Post/Landing Page page renders) for anything
// scheduled whose time has passed, and actually publishes it using the same
// platform APIs a manual "Publish Now" click uses -- just running here so it
// fires even when nobody has the app open.
//
// Two kinds intentionally never get auto-published here, for the same
// reasons manual publish already can't for them (see PublishScheduleModal.jsx):
//  - RedNote / xhs: there's no real posting API for it at all.
//  - YouTube / yt: publishing needs the actual video File object, which is
//    deliberately never persisted anywhere (see the content-save effect in
//    AdminPanel.jsx -- video files are stripped out before every save,
//    they're far too large to round-trip through JSON). Once the browser
//    that scheduled it is gone, there's nothing left here to upload. These
//    stay 'scheduled' until manually published from a browser session that
//    still has the video file attached.
//
// Each due item is patched individually (only the fields this changes), so
// a tick never rewrites anything it isn't publishing.
const AUTOPUBLISH_INTERVAL_MS = 60 * 1000;

async function getSocialCredentials(platform) {
  const { rows } = await pool.query('SELECT * FROM social_credentials WHERE company_id = $2 AND platform = $1', [platform, companyId()]);
  return rows[0] || null;
}

// Same Graph calls as the browser's "Publish Now" (shared/socialPublish.js).
// Poster images are always real, publicly-fetchable URLs (see
// /api/poster-image above). Several images post as a carousel / multi-photo.
const hostedImages = (item) => (item.post?.images || []).map((i) => i?.img).filter((u) => u && !u.startsWith('data:'));

async function autoPublishToFacebook(item) {
  const fb = await getSocialCredentials('fb');
  if (!fb?.connected || !fb.page_id || !fb.access_token) {
    throw new Error("Facebook isn't connected.");
  }
  const body = await publishFacebook({ pageId: fb.page_id, token: fb.access_token, message: item.post?.caption || '', imageUrls: hostedImages(item) });
  const postId = body.post_id || body.id;
  return { link: postId ? `https://www.facebook.com/${postId}` : undefined };
}

async function autoPublishToInstagram(item) {
  const fb = await getSocialCredentials('fb');
  const ig = await getSocialCredentials('ig');
  if (!fb?.connected || !fb.access_token) throw new Error("Facebook isn't connected (Instagram posts through it).");
  if (!ig?.connected || !ig.business_id) throw new Error("Instagram isn't connected.");
  const imageUrls = hostedImages(item);
  if (!imageUrls.length) throw new Error('This post has no hosted image to publish.');
  const { permalink } = await publishInstagram({ businessId: ig.business_id, token: fb.access_token, caption: item.post?.caption || '', imageUrls });
  return { link: permalink || undefined };
}

// Same publish path as the "Publish Now" button (POST /api/sites/publish),
// at the address chosen when it was scheduled. Older schedules without one
// fall back to an address made from the page's name.
async function autoPublishLandingPage(item) {
  const fallback = validateSlug(String(item.landing?.productName || item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40));
  const slug = item.siteSlug || (fallback.ok ? fallback.slug : `page-${String(item.id).slice(-6)}`);
  const { url, slug: finalSlug } = await publishSite(pool, { item, slug });
  return { link: url, siteSlug: finalSlug };
}

let autoPublishRunning = false;

async function runAutoPublishTick() {
  if (!pool || autoPublishRunning) return;
  autoPublishRunning = true;
  try {
    await ensureSchema();
    await ensureContentSchema(pool);
    // Each company's schedule runs as that company, with its own Facebook /
    // Instagram connection and hosting.
    const { rows } = await pool.query(
      "SELECT DISTINCT company_id FROM content_items WHERE deleted_at IS NULL AND data->>'status' = 'scheduled'"
    );
    for (const { company_id } of rows) {
      // With Heron on, an unlicensed company's schedule waits (see companyLicensed).
      if (heronEnabled && company_id !== '' && !(await companyLicensed(pool, company_id))) continue;
      await runAsCompany(company_id, publishDueItems);
    }
  } catch (err) {
    console.error('[auto-publish] Tick failed:', err.message);
  } finally {
    autoPublishRunning = false;
  }
}

async function publishDueItems() {
  const { items } = await listContentItems(pool);
  const now = Date.now();
  const due = items.filter(
    (item) => item?.status === 'scheduled' && item.scheduledAt && new Date(item.scheduledAt).getTime() <= now
  );

  for (const item of due) {
    try {
      let result;
      if (item.kind === 'landing') result = await autoPublishLandingPage(item);
      else if (item.kind === 'fb') result = await autoPublishToFacebook(item);
      else if (item.kind === 'ig') result = await autoPublishToInstagram(item);
      else continue; // xhs / yt -- see the block comment above

      await patchContentItem(pool, item.id, {
        status: 'published',
        ...result,
        autoPublishError: undefined,
        autoPublishLastAttempt: undefined,
        updatedAt: new Date().toISOString(),
      });
      console.log(`[auto-publish] Published "${item.title}" (${item.kind}, id ${item.id}).`);
    } catch (err) {
      // Left as 'scheduled' (not failed) so it's retried on the next tick
      // -- a lot of these are transient (an expired token that gets
      // refreshed, a flaky network call). autoPublishError surfaces the
      // reason on the item; it's only written (and logged) when it
      // changes, so a permanently broken one (e.g. Instagram not
      // connected) doesn't rewrite the row and spam the log every minute.
      if (item.autoPublishError !== err.message) {
        await patchContentItem(pool, item.id, {
          autoPublishError: err.message,
          autoPublishLastAttempt: new Date().toISOString(),
        });
        console.error(`[auto-publish] Failed to publish "${item.title}" (${item.kind}, id ${item.id}):`, err.message);
      }
    }
  }
}

if (pool) {
  setInterval(runAutoPublishTick, AUTOPUBLISH_INTERVAL_MS);
  // Also run shortly after boot -- catches anything whose scheduled time
  // already passed while the server was redeploying/restarting, instead of
  // making it wait for the first full interval.
  setTimeout(runAutoPublishTick, 10 * 1000);
}

// --- Serve the built frontend for everything else -------------------------
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
// Any non-API path falls through to index.html so client-side routing works.
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = process.env.PORT || 8787;
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] Script Studio listening on port ${port} (Postgres ${pool ? 'connected' : 'NOT configured'})`);
});
