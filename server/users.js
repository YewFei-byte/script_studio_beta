// Logins (app_users) and sign-in.
//
// Two modes, chosen by HERON_URL (server/heron.js):
//
// - Heron off: passwords are bcrypt hashes in app_users, as they always were,
//   plus the MASTER_USERNAME emergency login. Everything is company ''.
//
// - Heron on: Heron checks every password and licence. app_users keeps only
//   what Script Studio decides -- role, branch, in-app company label, who
//   created whom -- keyed to the Heron user (heron_user_id) and scoped to the
//   Heron company. Creating, renaming, password resets and deactivation go to
//   Heron as the signed-in admin, so Heron's seat limit, password rules and
//   rank rules apply. Nobody's password is stored here.
//
// First Heron sign-in links an existing login of the same username in that
// company (keeping its role), or creates one whose role follows the Heron rank.

import bcrypt from 'bcryptjs';
import { MASTER_USER, isMasterLogin, issueToken } from './auth.js';
import {
  HeronError,
  dropLink,
  heron,
  heronEnabled,
  heronMessage,
  heronSession,
  heronStatus,
  licenseSummary,
  saveLink,
  SessionEnded,
  startingRole,
  tokenClaims,
} from './heron.js';
import { LEGACY_COMPANY, companyId } from './tenant.js';

// Stored instead of a hash for Heron logins: never matches any password.
const NO_LOCAL_PASSWORD = '!heron';

export function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || '',
    role: row.role,
    branch: row.branch || '',
    company: row.company || '',
    createdAt: row.created_at,
    createdByAdminId: row.created_by_admin_id || null,
    heronLinked: !!row.heron_user_id,
  };
}

function sendHeronError(res, label, err) {
  if (err instanceof SessionEnded) return res.status(401).json({ error: err.message, signedOut: true, code: err.code });
  if (!(err instanceof HeronError)) {
    console.error(`[users] ${label} failed:`, err.message);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
  if (heronStatus(err) >= 500) console.error(`[users] ${label}: Heron answered ${err.status} ${err.code}: ${err.message}`);
  return res.status(heronStatus(err)).json({ error: heronMessage(err), code: err.code });
}

// The signed-in person's Heron access token, fresh enough for one call.
async function adminAccess(pool, req) {
  const link = await heronSession(pool, req.user.sub, { needAccess: true });
  return link.access_token;
}

async function findLogin(pool, id) {
  if (!/^\d+$/.test(String(id))) return null;
  const { rows } = await pool.query('SELECT * FROM app_users WHERE id = $1 AND company_id = $2', [id, companyId()]);
  return rows[0] || null;
}

// --- Heron sign-in ---------------------------------------------------------------

async function heronLogin(pool, username, password) {
  const payload = await heron.login(username, password);
  const hu = payload.user;
  const claims = tokenClaims(payload.accessToken);
  const company = String(hu.companyId);

  let row = (await pool.query('SELECT * FROM app_users WHERE heron_user_id = $1', [hu.id])).rows[0];
  if (row && row.company_id !== company) {
    // A Heron user never changes company; a mismatch means stale local data.
    console.error(`[users] Login ${row.id} is linked to Heron user ${hu.id} but sits in company ${row.company_id}, not ${company}.`);
    throw new HeronError(403, 'TOKEN_INVALID', 'Account mismatch.');
  }
  if (!row) {
    // An existing Script Studio login of the same name, made before Heron.
    row = (
      await pool.query(
        'UPDATE app_users SET heron_user_id = $1 WHERE company_id = $2 AND heron_user_id IS NULL AND lower(username) = lower($3) RETURNING *',
        [hu.id, company, hu.username]
      )
    ).rows[0];
    if (row) console.log(`[users] Linked existing login "${row.username}" (${row.id}) to Heron user ${hu.id}.`);
  }
  if (!row) {
    row = (
      await pool.query(
        `INSERT INTO app_users (username, password_hash, display_name, role, company, company_id, heron_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [hu.username, NO_LOCAL_PASSWORD, hu.fullName || null, startingRole(claims.crole), hu.companyName || null, company, hu.id]
      )
    ).rows[0];
    console.log(`[users] First sign-in of Heron user ${hu.username}: created login ${row.id} as ${row.role}.`);
  } else if (row.username !== hu.username) {
    // Renamed in Heron's console: follow it.
    row = (await pool.query('UPDATE app_users SET username = $2 WHERE id = $1 RETURNING *', [row.id, hu.username])).rows[0];
  }

  await saveLink(pool, row.id, payload);
  return { row, payload };
}

function sessionUser(row, payload) {
  return {
    ...publicUser(row),
    companyId: row.company_id,
    companyName: payload?.user?.companyName || '',
    mustChangePassword: !!payload?.user?.mustChangePassword,
    license: licenseSummary(payload?.license),
    heron: true,
  };
}

export function registerUserRoutes(app, { pool, ensureSchema }) {
  const noDb = (res) => res.status(503).json({ error: 'Database is not configured on this server yet.' });

  // POST /api/auth/login { username, password } -> { user, token }
  app.post('/api/auth/login', async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    // The built-in master login works even without a database (never with Heron on).
    if (isMasterLogin(username, password)) {
      if (pool) await ensureSchema();
      return res.json({ user: MASTER_USER, token: await issueToken(pool, MASTER_USER) });
    }
    if (!pool) return noDb(res);
    if (!username || !password) return res.status(400).json({ error: 'Enter your username and password.' });
    try {
      await ensureSchema();
      if (heronEnabled) {
        const { row, payload } = await heronLogin(pool, username, password);
        const user = sessionUser(row, payload);
        return res.json({ user, token: await issueToken(pool, user) });
      }
      const { rows } = await pool.query('SELECT * FROM app_users WHERE company_id = $1 AND username = $2', [LEGACY_COMPANY, username]);
      const row = rows[0];
      if (!row || !(await bcrypt.compare(password, row.password_hash))) {
        return res.status(401).json({ error: 'Incorrect username or password.' });
      }
      const user = publicUser(row);
      res.json({ user, token: await issueToken(pool, user) });
    } catch (err) {
      sendHeronError(res, 'POST /api/auth/login', err);
    }
  });

  // GET /api/auth/me -> { user } fresh from the database (and Heron's last answer).
  app.get('/api/auth/me', async (req, res) => {
    if (!pool || req.user.sub === 'master') return res.json({ user: MASTER_USER });
    try {
      const row = await findLogin(pool, req.user.sub);
      if (!row) return res.status(401).json({ error: 'Please sign in again.', signedOut: true });
      if (!heronEnabled) return res.json({ user: publicUser(row) });
      const link = req.heronLink;
      const { rows } = await pool.query('SELECT name FROM companies WHERE company_id = $1', [row.company_id]);
      res.json({
        user: {
          ...publicUser(row),
          companyId: row.company_id,
          companyName: rows[0]?.name || '',
          mustChangePassword: !!link?.must_change_password,
          license: link?.license || null,
          heron: true,
        },
      });
    } catch (err) {
      sendHeronError(res, 'GET /api/auth/me', err);
    }
  });

  // POST /api/auth/change-password { currentPassword, newPassword } -> { ok, user?, token? }
  app.post('/api/auth/change-password', async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Enter your current and new password.' });
    if (!pool) return noDb(res);
    if (req.user.sub === 'master') return res.status(400).json({ error: "The built-in master login's password is set on the server." });
    try {
      const row = await findLogin(pool, req.user.sub);
      if (!row) return res.status(401).json({ error: 'Please sign in again.', signedOut: true });
      if (heronEnabled) {
        const access = await adminAccess(pool, req);
        // Returns a whole new session; the one it was called with is revoked.
        const payload = await heron.changePassword(access, currentPassword, newPassword);
        await saveLink(pool, row.id, payload);
        const user = sessionUser(row, payload);
        return res.json({ ok: true, user, token: await issueToken(pool, user) });
      }
      if (!(await bcrypt.compare(currentPassword, row.password_hash))) {
        return res.status(400).json({ error: 'Your current password is incorrect.' });
      }
      await pool.query('UPDATE app_users SET password_hash = $2 WHERE id = $1', [row.id, await bcrypt.hash(newPassword, 10)]);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof HeronError && err.code === 'INVALID_CREDENTIALS') {
        return res.status(400).json({ error: 'Your current password is incorrect.' });
      }
      sendHeronError(res, 'POST /api/auth/change-password', err);
    }
  });

  // POST /api/auth/logout -> { ok }. Ends the Heron session too (on every device).
  app.post('/api/auth/logout', async (req, res) => {
    if (heronEnabled && pool && req.heronLink) {
      await heron.logout(req.heronLink.refresh_token).catch(() => {});
      await dropLink(pool, req.heronLink.app_user_id).catch(() => {});
    }
    res.json({ ok: true });
  });

  // --- logins ---------------------------------------------------------------------

  app.get('/api/users', async (req, res) => {
    if (!pool) return noDb(res);
    try {
      const { rows } = await pool.query('SELECT * FROM app_users WHERE company_id = $1 ORDER BY created_at ASC', [companyId()]);
      res.json({ users: rows.map(publicUser) });
    } catch (err) {
      console.error('[server] GET /api/users failed:', err.message);
      res.status(500).json({ error: 'Could not load users.' });
    }
  });

  app.post('/api/users', async (req, res) => {
    if (!pool) return noDb(res);
    const { username, password, displayName, email, role, branch, company, createdByAdminId } = req.body || {};
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    try {
      let heronUserId = null;
      let passwordHash = NO_LOCAL_PASSWORD;
      if (heronEnabled) {
        // An ordinary Heron user: what they may do here is their Script Studio role.
        const created = await heron.createUser(await adminAccess(pool, req), {
          username: username.trim(),
          password,
          ...(displayName?.trim() ? { fullName: displayName.trim() } : {}),
          ...(email?.trim() ? { email: email.trim() } : {}),
        });
        heronUserId = created.user.id;
      } else {
        passwordHash = await bcrypt.hash(password, 10);
      }
      try {
        const creator = createdByAdminId ? await findLogin(pool, createdByAdminId) : null;
        const { rows } = await pool.query(
          `INSERT INTO app_users (username, password_hash, display_name, role, branch, company, created_by_admin_id, company_id, heron_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [username.trim(), passwordHash, displayName?.trim() || null, role || 'Member', branch || null, company || null, creator?.id || null, companyId(), heronUserId]
        );
        res.json({ user: publicUser(rows[0]) });
      } catch (err) {
        // Don't leave a Heron login (and a used seat) with no Script Studio login.
        if (heronUserId) await heron.deactivateUser(await adminAccess(pool, req), heronUserId).catch(() => {});
        throw err;
      }
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken.' });
      sendHeronError(res, 'POST /api/users', err);
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    if (!pool) return noDb(res);
    const { username, displayName, role, branch, company, password } = req.body || {};
    try {
      const target = await findLogin(pool, req.params.id);
      if (!target) return res.status(404).json({ error: 'User not found.' });
      const self = String(target.id) === String(req.user.sub);
      let heronUserId = target.heron_user_id;

      if (heronEnabled) {
        if (self && password?.trim()) {
          return res.status(400).json({ error: 'Change your own password under User Setting → Password.' });
        }
        const renamed = username?.trim() && username.trim() !== target.username;
        const fullName = displayName?.trim() && displayName.trim() !== (target.display_name || '') ? displayName.trim() : null;
        if (heronUserId && (renamed || fullName)) {
          await heron.updateUser(await adminAccess(pool, req), heronUserId, {
            ...(renamed ? { username: username.trim() } : {}),
            ...(fullName ? { fullName } : {}),
          });
        }
        if (password?.trim()) {
          const access = await adminAccess(pool, req);
          if (heronUserId) {
            await heron.setPassword(access, heronUserId, { password, mustChangePassword: true });
          } else {
            // A login from before Heron: giving it a password creates its Heron login.
            const created = await heron.createUser(access, {
              username: (username?.trim() || target.username),
              password,
              ...(target.display_name ? { fullName: target.display_name } : {}),
            });
            heronUserId = created.user.id;
          }
        }
      }

      const passwordHash = !heronEnabled && password?.trim() ? await bcrypt.hash(password, 10) : null;
      const { rows } = await pool.query(
        `UPDATE app_users SET
           username = COALESCE($2, username),
           display_name = COALESCE($3, display_name),
           role = COALESCE($4, role),
           branch = COALESCE($5, branch),
           company = COALESCE($6, company),
           password_hash = COALESCE($7, password_hash),
           heron_user_id = COALESCE($8, heron_user_id)
         WHERE id = $1 AND company_id = $9 RETURNING *`,
        [target.id, username?.trim() || null, displayName?.trim() || null, role || null, branch || null, company || null, passwordHash, heronUserId, companyId()]
      );
      res.json({ user: publicUser(rows[0]) });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That username is already taken.' });
      sendHeronError(res, 'PUT /api/users', err);
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    if (!pool) return noDb(res);
    try {
      const target = await findLogin(pool, req.params.id);
      if (!target) return res.json({ ok: true });
      if (String(target.id) === String(req.user.sub)) return res.status(400).json({ error: "You can't remove your own login." });
      // Deactivating in Heron frees the seat and ends their sessions.
      if (heronEnabled && target.heron_user_id) {
        await heron.deactivateUser(await adminAccess(pool, req), target.heron_user_id).catch((err) => {
          if (!(err instanceof HeronError && err.code === 'NOT_FOUND')) throw err;
        });
      }
      // Logins this one created fall back to the shared default API key.
      await pool.query('UPDATE app_users SET created_by_admin_id = NULL WHERE created_by_admin_id = $1', [target.id]);
      await pool.query('DELETE FROM app_users WHERE id = $1 AND company_id = $2', [target.id, companyId()]);
      res.json({ ok: true });
    } catch (err) {
      sendHeronError(res, 'DELETE /api/users', err);
    }
  });
}
