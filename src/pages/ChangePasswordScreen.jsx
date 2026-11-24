import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { GlassCard, GlassButton } from '../components/Glass';
import { changePassword } from '../utils/usersApi';

// Shown instead of the app when Heron License requires a new password -- a
// login an admin just created, or one whose password an admin reset. Nothing
// else loads until it's done (the server refuses other calls meanwhile).
export default function ChangePasswordScreen({ user, onChanged, onLogout }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!current || !next) return setError('Enter the password you were given and a new one.');
    if (next !== confirm) return setError("The new passwords don't match.");
    setBusy(true);
    try {
      const fresh = await changePassword(current, next);
      onChanged(fresh || { mustChangePassword: false });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <GlassCard strong style={{ width: 400, maxWidth: '90vw', padding: '36px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 6 }}>
            <KeyRound size={20} color="var(--accent-violet)" />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19 }}>Choose a new password</span>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--ink-500)', fontSize: 13, marginBottom: 26, lineHeight: 1.5 }}>
            Hi {user?.displayName || user?.username}, replace the password you were given before you continue.
          </p>

          <form onSubmit={submit}>
            <label style={fieldLabel}>Current password</label>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
            <label style={fieldLabel}>New password</label>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
            <label style={fieldLabel}>Confirm new password</label>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ ...inputStyle, marginBottom: error ? 12 : 22 }} />

            {error && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', color: 'var(--accent-coral)', fontSize: 12, marginBottom: 18, lineHeight: 1.4 }}>
                <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            <GlassButton variant="primary" type="submit" disabled={busy} icon={busy ? Loader2 : undefined} style={{ width: '100%', justifyContent: 'center' }}>
              {busy ? 'Saving…' : 'Save and continue'}
            </GlassButton>
          </form>
          <button type="button" onClick={onLogout} style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 0, color: 'var(--ink-500)', fontSize: 12.5, cursor: 'pointer' }}>
            Sign out
          </button>
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
