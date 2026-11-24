// Presoft hosting for landing pages: <slug>.pages.presoft.my.
//
// Publishing renders the page once to finished HTML and stores it in
// published_sites. A request whose hostname is "<slug>.<SITES_DOMAIN>" (or
// "<slug>.localhost" in local dev) never reaches the app: it's answered here
// with that stored HTML. One wildcard DNS record covers every page; nothing
// is uploaded anywhere and no per-page DNS is needed. See
// docs/DNS_RECORDS.md for the records.

import { renderPage } from '../shared/landing/render.js';
import { buildLandingDocument } from '../shared/landingDocument.js';
import { ConfigError } from './ai.js';
import { companyId } from './tenant.js';

// Production default; override with SITES_DOMAIN. Unset in local dev, where
// pages are served on http://<slug>.localhost:<PORT> instead.
export const SITES_DOMAIN =
  process.env.SITES_DOMAIN || (process.env.NODE_ENV === 'production' ? 'pages.presoft.my' : '');

const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'email', 'smtp', 'ftp', 'dev', 'test', 'staging', 'status', 'help',
  'support', 'docs', 'blog', 'static', 'assets', 'cdn', 'login', 'signup', 'dashboard', 'presoft', 'pages',
  'scriptstudio', 'script-studio', '_acme-challenge',
]);

export function siteUrl(slug) {
  return SITES_DOMAIN ? `https://${slug}.${SITES_DOMAIN}` : `http://${slug}.localhost:${process.env.PORT || 8787}`;
}

// lowercase letters, numbers and single dashes; 3-40 chars; no leading or
// trailing dash.
export function validateSlug(slug) {
  const s = String(slug || '').trim().toLowerCase();
  if (s.length < 3) return { ok: false, reason: 'At least 3 characters.' };
  if (s.length > 40) return { ok: false, reason: 'At most 40 characters.' };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) return { ok: false, reason: 'Only letters, numbers and single dashes.' };
  if (RESERVED.has(s)) return { ok: false, reason: 'That address is reserved.' };
  return { ok: true, slug: s };
}

let schemaPromise = null;
export function ensureSitesSchema(pool) {
  if (!pool) return Promise.resolve();
  if (!schemaPromise) {
    schemaPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS published_sites (
          slug TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          html TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'on',
          views INTEGER NOT NULL DEFAULT 0,
          whatsapp_clicks INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS published_sites_item_idx ON published_sites (item_id);
      `)
      .catch((err) => {
        schemaPromise = null;
        throw err;
      });
  }
  return schemaPromise;
}

// Free if nobody has it, it's this item's own, or its old owner switched it off.
// Addresses are public subdomains, so they're unique across every company;
// the row records which company's page lives there.
async function checkSlug(pool, slug, itemId) {
  const v = validateSlug(slug);
  if (!v.ok) return { available: false, reason: v.reason };
  const { rows } = await pool.query('SELECT item_id, company_id, status FROM published_sites WHERE slug = $1', [v.slug]);
  const row = rows[0];
  const ours = row && row.item_id === itemId && row.company_id === companyId();
  if (row && !ours && row.status === 'on') return { available: false, reason: 'Already taken. Try another.' };
  return { available: true, slug: v.slug, url: siteUrl(v.slug) };
}

// Finished HTML for an item: section pages from their JSON, older pages from
// their stored HTML/CSS/JS.
function htmlForItem(item) {
  const landing = item?.landing || {};
  if (landing.page?.sections) return renderPage(landing.page, { trackUrl: '/__ss/hit' }).html;
  if (landing.generated?.html) {
    return buildLandingDocument(landing.generated, { inline: true, title: landing.productName || item.title, logoUrl: landing.logoUrl });
  }
  throw new ConfigError('This landing page has no content to publish yet.');
}

export async function publishSite(pool, { item, slug }) {
  if (!pool) throw new ConfigError('Hosting needs the database, which is not configured on this server.');
  if (!item?.id) throw new ConfigError('Missing the landing page to publish.');
  await ensureSitesSchema(pool);
  const check = await checkSlug(pool, slug, String(item.id));
  if (!check.available) throw new ConfigError(`"${slug}": ${check.reason}`);
  const html = htmlForItem(item);
  await pool.query(
    `INSERT INTO published_sites (slug, item_id, company_id, html, status, updated_at) VALUES ($1, $2, $4, $3, 'on', now())
     ON CONFLICT (slug) DO UPDATE SET
       html = $3, status = 'on', updated_at = now(),
       views = CASE WHEN published_sites.item_id = $2 AND published_sites.company_id = $4 THEN published_sites.views ELSE 0 END,
       whatsapp_clicks = CASE WHEN published_sites.item_id = $2 AND published_sites.company_id = $4 THEN published_sites.whatsapp_clicks ELSE 0 END,
       item_id = $2, company_id = $4`,
    [check.slug, String(item.id), html, companyId()]
  );
  // A page lives at one address: switching address turns the old one off.
  await pool.query("UPDATE published_sites SET status = 'off', updated_at = now() WHERE company_id = $3 AND item_id = $1 AND slug <> $2", [String(item.id), check.slug, companyId()]);
  return { url: check.url, slug: check.slug };
}

export async function unpublishSite(pool, itemId) {
  if (!pool) return;
  await ensureSitesSchema(pool);
  await pool.query("UPDATE published_sites SET status = 'off', updated_at = now() WHERE company_id = $2 AND item_id = $1", [String(itemId), companyId()]);
}

// --- serving -------------------------------------------------------------------

function slugFromHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  const suffixes = [SITES_DOMAIN && `.${SITES_DOMAIN}`, '.localhost'].filter(Boolean);
  for (const suffix of suffixes) {
    if (host.endsWith(suffix)) {
      const label = host.slice(0, -suffix.length);
      if (label && !label.includes('.')) return label;
    }
  }
  return null;
}

const NOT_FOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not available</title>
<style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui,sans-serif;background:#F4F3F0;color:#2B2A27;text-align:center;padding:24px}h1{font-size:24px;margin:0 0 8px}p{margin:0;color:#6B6862}</style></head>
<body><div><h1>This page isn't available</h1><p>The link may be wrong, or the page was taken down.</p></div></body></html>`;

// Mounted first in server.js. Anything on a hosted-site hostname is handled
// here and never falls through to the app.
export function sitesMiddleware(pool) {
  return async (req, res, next) => {
    const slug = slugFromHost(req.hostname);
    if (!slug) return next();
    try {
      if (!pool) return res.status(503).type('html').send(NOT_FOUND_HTML);
      await ensureSitesSchema(pool);

      if (req.path === '/__ss/hit') {
        const col = req.query.e === 'whatsapp' ? 'whatsapp_clicks' : req.query.e === 'view' ? 'views' : null;
        if (col) await pool.query(`UPDATE published_sites SET ${col} = ${col} + 1 WHERE slug = $1 AND status = 'on'`, [slug]);
        return res.status(204).end();
      }
      if (req.path === '/robots.txt') return res.type('text/plain').send('User-agent: *\nAllow: /\n');
      if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).end();
      if (req.path !== '/' && req.path !== '/index.html') return res.status(404).type('html').send(NOT_FOUND_HTML);

      const { rows } = await pool.query("SELECT html FROM published_sites WHERE slug = $1 AND status = 'on'", [slug]);
      if (!rows[0]) return res.status(404).type('html').send(NOT_FOUND_HTML);
      // Revalidate every time (cheap: ETag → 304), so a republish shows at once.
      res.set('Cache-Control', 'no-cache');
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      return res.type('html').send(rows[0].html);
    } catch (err) {
      console.error(`[sites] ${slug}${req.path} failed:`, err.message);
      return res.status(500).type('html').send(NOT_FOUND_HTML);
    }
  };
}

// --- app routes ----------------------------------------------------------------

export function registerSitesRoutes(app, { pool, ensureSchema, sendError }) {
  const ready = async () => {
    if (!pool) throw new ConfigError('Hosting needs the database, which is not configured on this server.');
    await ensureSchema();
    await ensureSitesSchema(pool);
  };

  // GET /api/sites/check?slug=&itemId= -> { available, slug?, url?, reason? }
  app.get('/api/sites/check', async (req, res) => {
    try {
      await ready();
      res.json(await checkSlug(pool, req.query.slug, String(req.query.itemId || '')));
    } catch (err) {
      sendError(res, 'GET /api/sites/check', err);
    }
  });

  // POST /api/sites/publish { item, slug } -> { url, slug }
  app.post('/api/sites/publish', async (req, res) => {
    try {
      await ready();
      const result = await publishSite(pool, req.body || {});
      console.log(`[sites] Published ${result.url} (item ${req.body?.item?.id}).`);
      res.json(result);
    } catch (err) {
      sendError(res, 'POST /api/sites/publish', err);
    }
  });

  // POST /api/sites/unpublish { itemId } -> { ok }
  app.post('/api/sites/unpublish', async (req, res) => {
    try {
      await ready();
      await unpublishSite(pool, req.body?.itemId);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, 'POST /api/sites/unpublish', err);
    }
  });

  // GET /api/sites/stats -> { [itemId]: { slug, url, views, whatsappClicks } } (live sites only)
  app.get('/api/sites/stats', async (req, res) => {
    if (!pool) return res.json({});
    try {
      await ready();
      const { rows } = await pool.query("SELECT slug, item_id, views, whatsapp_clicks FROM published_sites WHERE status = 'on' AND company_id = $1", [companyId()]);
      res.json(Object.fromEntries(rows.map((r) => [r.item_id, { slug: r.slug, url: siteUrl(r.slug), views: r.views, whatsappClicks: r.whatsapp_clicks }])));
    } catch (err) {
      sendError(res, 'GET /api/sites/stats', err);
    }
  });
}
