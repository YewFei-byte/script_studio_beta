// Talks to the /api/users + /api/auth/login routes in server.js (the
// Postgres-backed login credentials table). Unlike credentialsApi.js, these
// calls surface real errors instead of failing silently — this page's whole
// job is managing that table, so the superadmin needs to know when a save
// didn't actually happen (e.g. Postgres isn't attached yet, or the username
// is taken) rather than it quietly no-oping.

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function listUsers() {
  const res = await fetch('/api/users');
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || 'Could not load users.');
  return data.users;
}

export async function createUser(payload) {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || 'Could not create user.');
  return data.user;
}

export async function updateUser(id, payload) {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || 'Could not update user.');
  return data.user;
}

export async function deleteUser(id) {
  const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || 'Could not delete user.');
}

// Changes the signed-in person's own password (checked against the current
// one by the server, or by Heron License when it's on). With Heron the
// response carries a fresh session ({ user, token }) that replaces the old one.
export async function changePassword(currentPassword, newPassword) {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || 'Could not change the password.');
  return data?.token ? { ...data.user, token: data.token } : null;
}

// Ends the session on the server (and the Heron session behind it). Best-effort:
// signing out locally happens regardless.
export async function logoutUser() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // offline -- the local sign-out still happens
  }
}

// Used by LoginScreen.jsx for real per-user sign-in (checked against the
// same table Superadmin manages). Throws on bad credentials or if Postgres
// isn't reachable — LoginScreen shows that message directly.
export async function loginUser(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || 'Incorrect username or password.');
  // The session token rides along with the user so App.jsx stores it (and
  // src/utils/session.js sends it on every API call).
  return { ...data.user, token: data.token };
}
