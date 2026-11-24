import React, { useEffect, useState } from 'react';
import LoginScreen from './pages/LoginScreen';
import AdminPanel from './pages/AdminPanel';
import ChangePasswordScreen from './pages/ChangePasswordScreen';
import { logoutUser } from './utils/usersApi';

export default function App() {
  // Real per-user identity now (username/displayName/role/branch) instead of
  // a plain boolean — see LoginScreen.jsx for how this gets populated (a
  // hardcoded admin123/admin123 master login, or a real row from the
  // Postgres-backed credentials table via Superadmin).
  //
  // Persisted to localStorage ("remember me" behavior) so a page refresh —
  // or closing and reopening the tab — doesn't force a re-login every time.
  // There's no password in this object, just the identity shown around the
  // app (username/displayName/role/branch), so keeping it in localStorage
  // isn't any riskier than everything else this app already stores there.
  // Logging out clears it, so that still works exactly as before.
  const [user, setUser] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scriptStudioUser') || 'null');
      // Saved before sign-in sessions existed: sign in again to get one.
      return saved?.token ? saved : null;
    } catch {
      return null;
    }
  });

  // Why the last session ended, shown on the login screen (e.g. Heron
  // License reporting an expired licence).
  const [signedOutNotice, setSignedOutNotice] = useState('');

  const login = (u) => {
    setSignedOutNotice('');
    setUser(u);
    try {
      localStorage.setItem('scriptStudioUser', JSON.stringify(u));
    } catch {
      // best-effort — login still works for this session even if storage fails
    }
  };

  // Used after an in-app edit to the logged-in user's own account (e.g.
  // changing username on the User Setting page) -- merges the change into
  // the identity object App already tracks/persists, same storage path as
  // login() above, without going through the login flow again.
  const updateCurrentUser = (patch) => {
    setUser((u) => {
      const next = { ...u, ...patch };
      try {
        localStorage.setItem('scriptStudioUser', JSON.stringify(next));
      } catch {
        // best-effort, same as login() above
      }
      return next;
    });
  };

  const clearSession = () => {
    setUser(null);
    try {
      localStorage.removeItem('scriptStudioUser');
    } catch {
      // ignore
    }
  };

  const logout = () => {
    logoutUser(); // ends the server (and Heron) session; local sign-out doesn't wait
    setSignedOutNotice('');
    clearSession();
  };

  // The server rejected the saved session (expired, licence ended, signed
  // out elsewhere): back to the login screen, saying why. And when Heron
  // requires a new password, the change-password screen takes over.
  useEffect(() => {
    const onSignedOut = (e) => {
      setSignedOutNotice(e?.detail?.message || '');
      clearSession();
    };
    const onMustChange = () => updateCurrentUser({ mustChangePassword: true });
    window.addEventListener('ss-signed-out', onSignedOut);
    window.addEventListener('ss-must-change-password', onMustChange);
    return () => {
      window.removeEventListener('ss-signed-out', onSignedOut);
      window.removeEventListener('ss-must-change-password', onMustChange);
    };
  });

  return (
    <>
      <div className="aurora-field">
        <div className="aurora-blob b1" />
        <div className="aurora-blob b2" />
        <div className="aurora-blob b3" />
      </div>

      {!user ? (
        <LoginScreen key={signedOutNotice} onLogin={login} notice={signedOutNotice} />
      ) : user.mustChangePassword ? (
        <ChangePasswordScreen user={user} onChanged={updateCurrentUser} onLogout={logout} />
      ) : (
        <>
          <LicenseBanner license={user.license} />
          <AdminPanel user={user} onLogout={logout} onUpdateUser={updateCurrentUser} />
        </>
      )}
    </>
  );
}

// "Your licence ends in N days" -- from Heron License, when it's on. Shown from
// 30 days out; dismissible until the last week.
function LicenseBanner({ license }) {
  const [dismissed, setDismissed] = useState(false);
  const days = license?.daysRemaining;
  if (typeof days !== 'number' || days > 30) return null;
  const urgent = days <= 7;
  if (dismissed && !urgent) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 32px)',
        padding: '10px 16px', borderRadius: 12, fontSize: 13, lineHeight: 1.4,
        background: urgent ? '#FDECEA' : '#FFF6E0', color: urgent ? '#8A1C12' : '#6B4A00',
        border: `1px solid ${urgent ? '#F3B8B1' : '#F1D58A'}`, boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
      }}
    >
      <span>
        {days <= 0 ? "Your organisation's Script Studio licence ends today." : `Your organisation's Script Studio licence ends in ${days} day${days === 1 ? '' : 's'}.`} Contact support to renew.
      </span>
      {!urgent && (
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', fontSize: 16, lineHeight: 1 }}>
          ×
        </button>
      )}
    </div>
  );
}
