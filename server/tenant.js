// Which company a request belongs to, and the schema that keeps companies
// apart in the one shared database.
//
// With Heron License on (HERON_URL set), every signed-in request runs "as"
// the Heron company of the person who made it: authMiddleware wraps the rest
// of the request in runAsCompany(), and every query reads companyId() and
// filters on it. Without Heron, everything runs as the legacy company ''.
//
// companyId() throws when there is no company context instead of quietly
// returning "everyone's" data -- a route that forgot to run inside one fails
// loudly rather than leaking another company's posts.

import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();

// The company rows had before Heron (and while Heron is off).
export const LEGACY_COMPANY = '';

export function runAsCompany(id, fn) {
  return als.run({ companyId: String(id ?? LEGACY_COMPANY) }, fn);
}

export function companyId() {
  const store = als.getStore();
  if (!store) throw new Error('No company context for this request.');
  return store.companyId;
}

// Tables whose rows belong to one company. app_data, social_credentials and
// content_items were keyed by a single column; that key is now unique per
// company instead (two companies may both have a 'members' blob or an 'fb'
// connection).
const REKEYED = [
  { table: 'app_data', key: 'key' },
  { table: 'social_credentials', key: 'platform' },
  { table: 'content_items', key: 'id' },
];

// Runs once per boot, after the base tables exist. Idempotent, and taken under
// an advisory lock so two instances booting together don't race.
export async function ensureTenancySchema(pool, { legacyOwner } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(724001)');

    for (const t of ['app_data', 'social_credentials', 'content_items', 'media_images', 'published_sites', 'app_users']) {
      await client.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS company_id TEXT NOT NULL DEFAULT ''`);
    }

    for (const { table, key } of REKEYED) {
      // Swap a single-column primary key for (company_id, key). Skipped once done.
      await client.query(`
        DO $$
        DECLARE pk text;
        BEGIN
          SELECT conname INTO pk FROM pg_constraint
           WHERE conrelid = '${table}'::regclass AND contype = 'p' AND array_length(conkey, 1) = 1;
          IF pk IS NOT NULL THEN
            EXECUTE format('ALTER TABLE ${table} DROP CONSTRAINT %I', pk);
            ALTER TABLE ${table} ADD CONSTRAINT ${table}_pkey PRIMARY KEY (company_id, ${key});
          END IF;
        END $$;
      `);
    }

    await client.query('CREATE INDEX IF NOT EXISTS published_sites_company_idx ON published_sites (company_id)');

    // Logins: usernames are unique within a company (Heron keeps them unique
    // everywhere anyway), and a login may be linked to its Heron user.
    await client.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS heron_user_id TEXT');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS app_users_heron_user_idx ON app_users (heron_user_id)');
    await client.query('ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_username_key');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS app_users_company_username_idx ON app_users (company_id, username)');

    // Each login's Heron session, held server-side only: the refresh token is
    // as sensitive as a password and never goes to the browser.
    await client.query(`
      CREATE TABLE IF NOT EXISTS heron_links (
        app_user_id INTEGER PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        heron_user_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        access_token TEXT NOT NULL,
        access_expires_at TIMESTAMPTZ NOT NULL,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        must_change_password BOOLEAN NOT NULL DEFAULT false,
        license JSONB
      )
    `);
    // Each Heron company as last reported by Heron: its name, licence expiry,
    // and the code Heron last refused it with (licence suspended, company
    // inactive...). The auto-publish scheduler, which runs with nobody signed
    // in, uses this to skip companies that aren't licensed.
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        company_id TEXT PRIMARY KEY,
        name TEXT,
        license_expires_at TIMESTAMPTZ,
        blocked_code TEXT,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    if (legacyOwner) await adoptLegacyRows(client, legacyOwner);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Hands everything created before Heron (company '') to one Heron company --
// HERON_LEGACY_COMPANY_ID, normally Presoft's own. A row whose key that
// company already has is left where it is (and reported) rather than
// overwriting newer data.
async function adoptLegacyRows(client, owner) {
  const moved = {};
  const skip = async (table, key, extra = '') => {
    const { rowCount } = await client.query(
      `UPDATE ${table} t SET company_id = $1
        WHERE t.company_id = '' ${extra}
          AND NOT EXISTS (SELECT 1 FROM ${table} o WHERE o.company_id = $1 AND o.${key} = t.${key})`,
      [owner]
    );
    const left = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE company_id = '' ${extra}`);
    moved[table] = rowCount;
    if (left.rows[0].n) console.warn(`[tenancy] ${left.rows[0].n} pre-Heron ${table} row(s) clash with rows company ${owner} already has; left unassigned.`);
  };
  // The session-signing secret is the server's own, not a company's.
  await skip('app_data', 'key', "AND key <> 'sessionSecret'");
  await skip('social_credentials', 'platform');
  await skip('content_items', 'id');
  await skip('app_users', 'username');
  for (const table of ['media_images', 'published_sites']) {
    const { rowCount } = await client.query(`UPDATE ${table} SET company_id = $1 WHERE company_id = ''`, [owner]);
    moved[table] = rowCount;
  }
  const total = Object.values(moved).reduce((a, b) => a + b, 0);
  if (total) console.log(`[tenancy] Assigned pre-Heron data to company ${owner}:`, moved);
}
