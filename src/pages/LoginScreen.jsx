import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { GlassCard, GlassButton } from '../components/Glass';
import { loginUser } from '../utils/usersApi';

// "Remember me" stores the last-used USERNAME in localStorage and pre-fills
// the form with it next time. It never stores the password: with Heron
// License the same password signs in to every Presoft product. Unticking the
// box on a later login clears whatever was remembered (including a password
// saved by older versions).
const REMEMBER_KEY = 'scriptStudioRemember';

function loadRemembered() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const { u } = JSON.parse(raw);
    return { username: atob(u || '') };
  } catch {
    return null;
  }
}

function saveRemembered(username) {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ u: btoa(username) }));
  } catch {
    // best-effort — login still works even if storage fails
  }
}

function clearRemembered() {
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // ignore
  }
}

// `notice` explains why the last session ended (e.g. an expired licence).
export default function LoginScreen({ onLogin, notice = '' }) {
  const remembered = loadRemembered();
  const [username, setUsername] = useState(remembered?.username || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(!!remembered);
  const [error, setError] = useState(notice);
  const [loading, setLoading] = useState(false);

  const applyRememberChoice = () => {
    if (rememberMe) {
      saveRemembered(username);
    } else {
      clearRemembered();
    }
  };

  // Enter in the username field moves on to the password field (instead of
  // submitting with an empty password); Enter in the password field logs in.
  const passwordRef = useRef(null);
  const onUsernameKeyDown = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (username.trim() && password) e.currentTarget.form.requestSubmit();
    else passwordRef.current?.focus();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    // Every login (including the built-in master login) is checked by the
    // server, which returns a signed session token (see server/auth.js).
    setLoading(true);
    try {
      const user = await loginUser(username, password);
      applyRememberChoice();
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Incorrect username or password. (Hint for demo: admin123 / admin123)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <GlassCard strong style={{ width: 380, maxWidth: '90vw', padding: '38px 34px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 6 }}>
            <img src="/logo.png" alt="" width={30} height={30} style={{ display: 'block' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19 }}>Script Studio</span>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--ink-500)', fontSize: 13, marginBottom: 30 }}>
            Sign in to the Admin Panel
          </p>

          <form onSubmit={submit}>
            <label style={fieldLabel}>Username</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <User size={15} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--ink-300)' }} />
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={onUsernameKeyDown}
                autoComplete="username"
                enterKeyHint="next"
                placeholder="admin123"
                style={{ ...inputStyle, paddingLeft: 38 }}
              />
            </div>

            <label style={fieldLabel}>Password</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Lock size={15} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--ink-300)' }} />
              <input
                ref={passwordRef}
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="admin123"
                style={{ ...inputStyle, paddingLeft: 38 }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: error ? 12 : 26, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: 'var(--accent-violet)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 12.5, color: 'var(--ink-500)' }}>Remember me</span>
            </label>

            {error && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', color: 'var(--accent-coral)', fontSize: 12, marginBottom: 18, lineHeight: 1.4 }}>
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            <GlassButton variant="primary" type="submit" disabled={loading} icon={loading ? Loader2 : undefined} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Signing in…' : 'Log In'}
            </GlassButton>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
}

const fieldLabel = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--ink-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 12,
  border: '1px solid rgba(183,169,154,0.35)',
  background: 'rgba(255,255,255,0.6)',
  fontSize: 13.6,
  fontFamily: 'var(--font-body)',
  outline: 'none',
};
