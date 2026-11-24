// Per-item storage for posts and landing pages.
//
// Everything used to live in ONE JSONB blob (app_data key 'content'): every
// save from any browser rewrote the entire list, so two people saving at
// once could clobber each other, and the auto-publish scheduler rewrote the
// whole list every minute just to record an error message. With the visual
// editors autosaving, that would only get worse -- so each item is now its
// own row, saved and deleted individually.
//
// Deletes are soft (deleted_at) so other open sessions and the initial
// merge on load can tell "deleted elsewhere" apart from "this browser has
// something the server never saw", and don't resurrect it.
//
// Rows belong to one company (company_id, see tenant.js): every query here
// is scoped to the company of the request it runs in.
//
// Every write bumps the row's `rev`. A browser saves with the rev it last
// saw (baseRev); if the row changed in between -- e.g. the auto-publish
// scheduler just marked it published -- the save is refused with 409 and the
// current row, so the browser can merge instead of silently pushing a stale
// 'scheduled' status back (which would publish the post twice).

import { companyId } from './tenant.js';

let contentSchemaPromise = null;

export function ensureContentSchema(pool) {
  if (!pool) return Promise.resolve();
  if (!contentSchemaPromise) {
    contentSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS content_items (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          deleted_at TIMESTAMPTZ,
          rev BIGINT NOT NULL DEFAULT 1
        );
      `);
      // One-time copy of the old single-blob list. The blob itself is left
      // in app_data untouched, as a backup.
      const { rows } = await pool.query('SELECT 1 FROM content_items LIMIT 1');
      if (rows.length === 0) {
        const blob = await pool.query("SELECT value FROM app_data WHERE key = 'content'").catch(() => ({ rows: [] }));
        const list = Array.isArray(blob.rows[0]?.value) ? blob.rows[0].value : [];
        for (const item of list) {
          if (!item?.id) continue;
          await pool.query('INSERT INTO content_items (id, data) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
            String(item.id),
            JSON.stringify(item),
          ]);
        }
        if (list.length) console.log(`[content] Migrated ${list.length} items from the app_data 'content' blob.`);
      }
    })().catch((err) => {
      contentSchemaPromise = null; // retry on the next request
      throw err;
    });
  }
  return contentSchemaPromise;
}

export async function listContentItems(pool) {
  const { rows } = await pool.query(
    'SELECT id, data, deleted_at, rev FROM content_items WHERE company_id = $1 ORDER BY updated_at DESC',
    [companyId()]
  );
  const revs = {};
  for (const r of rows) revs[r.id] = Number(r.rev);
  return {
    items: rows.filter((r) => !r.deleted_at).map((r) => r.data),
    deletedIds: rows.filter((r) => r.deleted_at).map((r) => r.id),
    revs,
  };
}

// Returns { ok: true, rev } or, when baseRev is stale,
// { ok: false, current: { item | null, deleted, rev } }.
// baseRev null/undefined means "I don't know of a server copy" (a brand-new
// item): it's written unconditionally.
export async function upsertContentItem(pool, item, baseRev) {
  const id = String(item.id);
  const { rows } = await pool.query(
    `INSERT INTO content_items (company_id, id, data, updated_at, deleted_at, rev) VALUES ($4, $1, $2, now(), NULL, 1)
     ON CONFLICT (company_id, id) DO UPDATE SET data = $2, updated_at = now(), deleted_at = NULL, rev = content_items.rev + 1
       WHERE $3::bigint IS NULL OR content_items.rev = $3::bigint
     RETURNING rev`,
    [id, JSON.stringify(item), baseRev ?? null, companyId()]
  );
  if (rows[0]) return { ok: true, rev: Number(rows[0].rev) };
  const cur = await pool.query('SELECT data, deleted_at, rev FROM content_items WHERE company_id = $2 AND id = $1', [id, companyId()]);
  const row = cur.rows[0];
  return { ok: false, current: { item: row?.deleted_at ? null : row?.data ?? null, deleted: !!row?.deleted_at, rev: Number(row?.rev ?? 0) } };
}

export async function deleteContentItem(pool, id) {
  await pool.query(
    'UPDATE content_items SET deleted_at = now(), updated_at = now(), rev = rev + 1 WHERE company_id = $2 AND id = $1',
    [String(id), companyId()]
  );
}

// Shallow-merges `patch` into one item's data. Keys whose value is
// undefined are removed instead. Used by the auto-publish scheduler, which
// only ever touches a handful of fields on one item.
export async function patchContentItem(pool, id, patch) {
  const set = {};
  const remove = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) remove.push(k);
    else set[k] = v;
  }
  await pool.query(
    `UPDATE content_items SET data = (data - $2::text[]) || $3::jsonb, updated_at = now(), rev = rev + 1
     WHERE company_id = $4 AND id = $1 AND deleted_at IS NULL`,
    [String(id), remove, JSON.stringify(set), companyId()]
  );
}

export function registerContentRoutes(app, { pool, ensureSchema }) {
  const ready = async () => {
    await ensureSchema();
    await ensureContentSchema(pool);
  };

  // GET /api/content -> { configured, items, deletedIds, revs: { [id]: rev } }
  app.get('/api/content', async (req, res) => {
    if (!pool) return res.json({ configured: false, items: [], deletedIds: [], revs: {} });
    try {
      await ready();
      res.json({ configured: true, ...(await listContentItems(pool)) });
    } catch (err) {
      console.error('[server] GET /api/content failed:', err.message);
      res.status(500).json({ error: 'Could not load posts and landing pages.' });
    }
  });

  // PUT /api/content/:id  { item, baseRev? } -> { ok, rev }
  //   409 { conflict: true, current: { item, deleted, rev } } when baseRev is stale
  app.put('/api/content/:id', async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'Database is not configured on this server yet.' });
    const item = req.body?.item;
    if (!item || typeof item !== 'object' || String(item.id) !== req.params.id) {
      return res.status(400).json({ error: 'Expected { item } whose id matches the URL.' });
    }
    try {
      await ready();
      const result = await upsertContentItem(pool, item, req.body?.baseRev);
      if (!result.ok) return res.status(409).json({ conflict: true, current: result.current });
      res.json({ ok: true, rev: result.rev });
    } catch (err) {
      console.error('[server] PUT /api/content failed:', err.message);
      res.status(500).json({ error: 'Could not save this item.' });
    }
  });

  // DELETE /api/content/:id -> { ok }
  app.delete('/api/content/:id', async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'Database is not configured on this server yet.' });
    try {
      await ready();
      await deleteContentItem(pool, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      console.error('[server] DELETE /api/content failed:', err.message);
      res.status(500).json({ error: 'Could not delete this item.' });
    }
  });
}
