import React, { useEffect, useState } from 'react';
import { AtSign, KeyRound, Link2Off, Loader2 } from 'lucide-react';
import { GlassCard } from '../components/Glass';
import { fetchCredentials, saveCredentials, deleteCredentials } from '../utils/credentialsApi';
import { changePassword as changeOwnPassword, updateUser } from '../utils/usersApi';
import { FieldStack, Group, HelpDisclosure, Notice, Row, SettingsPage, SmallButton } from '../components/settings/SettingsUI';
import { GoogleCalendarTile } from '../components/settings/BrandGlyphs';

// Settings → User Setting: who you're signed in as, your login details,
// and your Google Calendar link.

export default function UserSettingPage({ user, onUpdateUser }) {
  // The admin123 "break glass" master login (see LoginScreen.jsx) has no
  // real row in app_users, so there's nothing to rename or re-password.
  const isMasterLogin = !user?.id;
  const [open, setOpen] = useState(null);
  const toggle = (id) => setOpen((o) => (o === id ? null : id));

  // --- username (edits the real login row via PUT /api/users/:id) ---
  const [username, setUsername] = useState(user?.username || '');
  const [usernameState, setUsernameState] = useState({ busy: false, error: '', saved: false });
  const saveUsername = async () => {
    const trimmed = username.trim();
    if (!trimmed) return setUsernameState({ busy: false, error: "Username can't be empty.", saved: false });
    if (trimmed === user?.username) return;
    setUsernameState({ busy: true, error: '', saved: false });
    try {
      const updated = await updateUser(user.id, { username: trimmed });
      setUsername(updated.username);
      onUpdateUser?.(updated);
      setUsernameState({ busy: false, error: '', saved: true });
    } catch (err) {
      setUsernameState({ busy: false, error: err.message || 'Could not update username.', saved: false });
    }
  };

  // --- password: the server checks the current one (or Heron License does,
  // when it's on) and saves the new one ---
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwState, setPwState] = useState({ busy: false, error: '', saved: false });
  const changePassword = async () => {
    if (!pw.current) return setPwState({ busy: false, error: 'Enter your current password.', saved: false });
    if (pw.next.length < 6) return setPwState({ busy: false, error: 'New password needs at least 6 characters.', saved: false });
    if (pw.next !== pw.confirm) return setPwState({ busy: false, error: "The new passwords don't match.", saved: false });
    setPwState({ busy: true, error: '', saved: false });
    try {
      const fresh = await changeOwnPassword(pw.current, pw.next);
      // Heron replaces the whole session on a password change.
      if (fresh) onUpdateUser?.(fresh);
      setPw({ current: '', next: '', confirm: '' });
      setPwState({ busy: false, error: '', saved: true });
    } catch (err) {
      setPwState({ busy: false, error: err.message || 'Could not change the password.', saved: false });
    }
  };

  // --- Google Calendar (same OAuth pattern as YouTube; stored server-side
  // as platform 'gcal', read by src/utils/googleCalendarSync.js when
  // something gets scheduled) ---
  const [gcal, setGcal] = useState({ clientId: '', clientSecret: '', refreshToken: '' });
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(true);
  const [gcalError, setGcalError] = useState('');
  useEffect(() => {
    fetchCredentials('gcal')
      .then((creds) => {
        if (creds) {
          setGcalConnected(true);
          setGcal({ clientId: creds.clientId || '', clientSecret: creds.clientSecret || '', refreshToken: creds.refreshToken || '' });
        }
      })
      .finally(() => setGcalLoading(false));
  }, []);
  const connectGcal = async () => {
    setGcalError('');
    const c = { clientId: gcal.clientId.trim(), clientSecret: gcal.clientSecret.trim(), refreshToken: gcal.refreshToken.trim() };
    if (!c.clientId || !c.clientSecret || !c.refreshToken) return setGcalError('All three are needed.');
    await saveCredentials('gcal', c);
    setGcalConnected(true);
    setOpen(null);
  };
  const disconnectGcal = async () => {
    await deleteCredentials('gcal');
    setGcalConnected(false);
    setGcal({ clientId: '', clientSecret: '', refreshToken: '' });
  };

  const name = user?.displayName || user?.username || 'You';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const chips = [user?.role, user?.company, user?.branch].filter(Boolean);

  return (
    <SettingsPage title="User Setting" subtitle="Your account and calendar.">
      <GlassCard strong style={{ padding: 18, borderRadius: 18, marginBottom: 26, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-violet), #D9822B)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
          {initials}
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-900)' }}>{name}</p>
          <p style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: chips.length ? 6 : 0 }}>@{user?.username}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {chips.map((c) => (
              <span key={c} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'rgba(80,69,56,0.07)', color: 'var(--ink-700)' }}>{c}</span>
            ))}
          </div>
        </div>
      </GlassCard>

      <Group title="Account" footer={isMasterLogin ? "This is the built-in master login — its username and password can't be changed." : undefined}>
        <Row icon={AtSign} color="linear-gradient(135deg,#8E8E93,#636366)" title="Username" subtitle="What you sign in with"
          right={<span style={{ fontSize: 13, color: 'var(--ink-500)' }}>{user?.username}</span>}
          open={open === 'username'} onToggle={isMasterLogin ? undefined : () => toggle('username')}>
          <FieldStack fields={[{ label: 'New username', value: username, onChange: (v) => { setUsername(v); setUsernameState((s) => ({ ...s, saved: false })); }, onEnter: saveUsername, autoComplete: 'username' }]} />
          {usernameState.error && <Notice kind="error">{usernameState.error}</Notice>}
          {usernameState.saved && <Notice kind="ok">Username updated.</Notice>}
          <SmallButton primary icon={usernameState.busy ? Loader2 : undefined} disabled={usernameState.busy || !username.trim() || username.trim() === user?.username} onClick={saveUsername} style={{ alignSelf: 'flex-start' }}>
            Save
          </SmallButton>
        </Row>

        <Row icon={KeyRound} color="linear-gradient(135deg,#F2AA24,#D9822B)" title="Password" subtitle="Change your sign-in password"
          open={open === 'password'} onToggle={isMasterLogin ? undefined : () => toggle('password')} last>
          <FieldStack fields={[
            { label: 'Current', type: 'password', value: pw.current, onChange: (v) => setPw((p) => ({ ...p, current: v })), autoComplete: 'current-password' },
            { label: 'New', type: 'password', value: pw.next, onChange: (v) => setPw((p) => ({ ...p, next: v })), placeholder: 'At least 6 characters', autoComplete: 'new-password' },
            { label: 'Confirm new', type: 'password', value: pw.confirm, onChange: (v) => setPw((p) => ({ ...p, confirm: v })), onEnter: changePassword, autoComplete: 'new-password' },
          ]} />
          {pwState.error && <Notice kind="error">{pwState.error}</Notice>}
          {pwState.saved && <Notice kind="ok">Password changed — use it next time you sign in.</Notice>}
          <SmallButton primary icon={pwState.busy ? Loader2 : undefined} disabled={pwState.busy} onClick={changePassword} style={{ alignSelf: 'flex-start' }}>
            Change password
          </SmallButton>
        </Row>
      </Group>

      <Group title="Calendar" footer="When connected, everything you schedule also appears on your Google Calendar.">
        <Row iconNode={<GoogleCalendarTile />} title="Google Calendar" subtitle="Scheduled posts & pages"
          status={{ state: gcalLoading ? 'checking' : gcalConnected ? 'ok' : 'none' }}
          open={open === 'gcal'} onToggle={() => toggle('gcal')} last>
          <FieldStack fields={[
            { label: 'Client ID', value: gcal.clientId, onChange: (v) => setGcal((g) => ({ ...g, clientId: v })), placeholder: '…apps.googleusercontent.com' },
            { label: 'Client secret', type: 'password', value: gcal.clientSecret, onChange: (v) => setGcal((g) => ({ ...g, clientSecret: v })), placeholder: 'GOCSPX-…' },
            { label: 'Refresh token', type: 'password', value: gcal.refreshToken, onChange: (v) => setGcal((g) => ({ ...g, refreshToken: v })), placeholder: '1//…', onEnter: connectGcal },
          ]} />
          {gcalError && <Notice kind="error">{gcalError}</Notice>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <SmallButton primary onClick={connectGcal}>{gcalConnected ? 'Update' : 'Connect'}</SmallButton>
            {gcalConnected && <SmallButton danger icon={Link2Off} onClick={disconnectGcal}>Disconnect</SmallButton>}
          </div>
          <HelpDisclosure>
            <li>In <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">Google Cloud Console</a>, create a project and enable <b>Google Calendar API</b>.</li>
            <li>Credentials → create an <b>OAuth Client ID</b> (Desktop app) → copy the Client ID and Secret.</li>
            <li>In <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer">OAuth Playground</a>, ⚙ → <b>Use your own OAuth credentials</b> → paste them.</li>
            <li>Authorize <code>https://www.googleapis.com/auth/calendar.events</code>, exchange the code, copy the <b>Refresh Token</b>.</li>
          </HelpDisclosure>
        </Row>
      </Group>
    </SettingsPage>
  );
}
