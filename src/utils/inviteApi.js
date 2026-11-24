// Talks to the /api/invite-email route in server.js (Gmail SMTP). Used by
// MembersPage.jsx after a login is created for a newly-invited member, to
// send them their username/password and a link back into the app.
//
// Deliberately soft-fails: the member + login are already created by the
// time this is called, so a failed email should surface a warning to the
// admin, not undo the invite. Callers should catch and show a toast/message
// rather than letting this throw block the rest of the invite flow.

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendInviteEmail({ to, name, username, password, appUrl }) {
  const res = await fetch('/api/invite-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, name, username, password, appUrl }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || 'Could not send the invite email.');
  return data;
}
