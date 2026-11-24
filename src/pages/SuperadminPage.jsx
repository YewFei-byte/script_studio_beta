import React, { useEffect, useState } from 'react';
import { UserPlus, Trash2, KeyRound, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { GlassCard, GlassButton, GlassPill } from '../components/Glass';
import Modal from '../components/Modal';
import FilterSelect from '../components/FilterSelect';
import { roleOptions } from '../data/mockData';
import { listUsers, createUser, updateUser, deleteUser } from '../utils/usersApi';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function AddUserModal({ open, onClose, onCreated, branches, branchCompany, creatorIsSuperadmin, creatorAdminId }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  // An Admin creating a login can only hand out Manager/Member — Superadmin
  // and Admin tiers stay Superadmin-exclusive to create, so an Admin can
  // never mint a peer Admin or a Superadmin.
  const assignableRoles = creatorIsSuperadmin ? roleOptions : roleOptions.filter((r) => r !== 'Superadmin' && r !== 'Admin');
  const [role, setRole] = useState('Member');
  const [branch, setBranch] = useState((branches || [])[0] || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setUsername('');
    setPassword('');
    setDisplayName('');
    setRole('Member');
    setBranch((branches || [])[0] || '');
    setError('');
  };

  const submit = async () => {
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setSaving(true);
    try {
      const company = (branchCompany || {})[branch] || '';
      const created = await createUser({ username: username.trim(), password, displayName: displayName.trim(), role, branch, company, createdByAdminId: creatorIsSuperadmin ? null : creatorAdminId });
      onCreated(created);
      reset();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not create user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} width={400}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Add a login</h2>
      <p style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 20 }}>Creates a row in the credentials table.</p>

      <label style={fieldLabel}>Username</label>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. jane.chen" style={{ ...inputStyle, marginBottom: 14 }} />

      <label style={fieldLabel}>Password</label>
      <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password" style={{ ...inputStyle, marginBottom: 14 }} />

      <label style={fieldLabel}>Display name (optional)</label>
      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Chen" style={{ ...inputStyle, marginBottom: 14 }} />

      <label style={fieldLabel}>Role</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {assignableRoles.map((r) => (
          <GlassPill key={r} active={role === r} onClick={() => setRole(r)}>{r}</GlassPill>
        ))}
      </div>

      <label style={fieldLabel}>Branch</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(branches || []).length > 0 ? (
          branches.map((b) => (
            <GlassPill key={b} active={branch === b} onClick={() => setBranch(b)}>{b}</GlassPill>
          ))
        ) : (
          <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>No branches yet — add one from the Members page first.</p>
        )}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'rgba(220,80,60,0.08)', color: 'var(--accent-coral)', fontSize: 12 }}>
          <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <GlassButton variant="primary" icon={UserPlus} disabled={saving} style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>
        {saving ? 'Creating…' : 'Create login'}
      </GlassButton>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onSaved }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError('');
    if (!password.trim()) return setError('Enter a new password.');
    setSaving(true);
    try {
      await updateUser(user.id, { password });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not reset password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!user} onClose={onClose} width={360}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Reset password</h2>
      <p style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 18 }}>For {user?.username}</p>
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" style={{ ...inputStyle, marginBottom: 14 }} />
      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'rgba(220,80,60,0.08)', color: 'var(--accent-coral)', fontSize: 12 }}>
          <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      <GlassButton variant="primary" icon={KeyRound} disabled={saving} style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>
        {saving ? 'Saving…' : 'Save new password'}
      </GlassButton>
    </Modal>
  );
}

// Superadmin dashboard for the login-credentials table backing this app —
// this used to be entirely separate from Members (which manages who's on
// the team + their content-editing permissions), which meant every real
// person had to be added twice: once here as a login, once again on the
// Members page as a roster entry. To fix that, every create/role
// change/branch change/delete done here also keeps a matching Members
// entry in sync (linked by the `loginId` field stored on that member — see
// the sync helpers below). This page still manages actual usernames/
// passwords stored (hashed) in Postgres via server.js; Members' own
// localStorage-backed roster is just kept mirrored alongside it now.
// Logins created here sign in through the server (server/auth.js), which
// issues the session token every API call needs.
export default function SuperadminPage({ currentUser, branches, branchCompany, setMembers }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [actionError, setActionError] = useState('');

  // Superadmin manages every login unrestricted, same as always. An Admin
  // (granted this page via Role Permissions -> Superadmin) can create
  // Manager/Member logins and manage the ones they created — see
  // canEditRow below — but can't touch logins Superadmin or another Admin
  // created, and can't create Admin/Superadmin logins themselves.
  const currentIsSuperadmin = currentUser?.role === 'Superadmin';
  // Same company-scoping as MembersPage.jsx's branchesInScope -- an Admin
  // granted this page can only assign logins to branches under their own
  // company.
  const branchOptions = currentIsSuperadmin
    ? (branches || [])
    : (branches || []).filter((b) => (branchCompany || {})[b] === currentUser?.company);
  const canEditRow = (u) => currentIsSuperadmin || u.createdByAdminId === currentUser?.id;
  const creatorLabel = (u) => {
    if (!u.createdByAdminId) return 'Superadmin (shared default)';
    const creator = users.find((x) => x.id === u.createdByAdminId);
    return creator ? `${creator.displayName || creator.username}` : 'Another admin';
  };

  const refresh = () => {
    setLoading(true);
    setLoadError('');
    listUsers()
      .then((list) => setUsers(list))
      .catch((err) => setLoadError(err.message || 'Could not load users.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  // Adds (or, if one's already linked, updates) the Members roster entry
  // that mirrors a login row. Members entries created this way carry a
  // `loginId` pointing back at the app_users row, so later role/branch
  // changes and deletes here know which member to keep in sync.
  const upsertLinkedMember = (user, extra = {}) => {
    if (!setMembers) return;
    setMembers((list) => {
      const existing = list.find((m) => m.loginId === user.id);
      if (existing) {
        return list.map((m) => (m.loginId === user.id ? { ...m, ...extra, role: user.role, branch: user.branch, company: user.company } : m));
      }
      return [
        ...list,
        {
          id: `m${user.id}-login`,
          loginId: user.id,
          name: user.displayName || user.username,
          email: extra.email || '',
          role: user.role,
          branch: user.branch,
          company: user.company,
          status: 'active',
          color: 'var(--accent-violet)',
        },
      ];
    });
  };

  const removeLinkedMember = (userId) => {
    if (!setMembers) return;
    setMembers((list) => list.filter((m) => m.loginId !== userId));
  };

  const changeRole = async (user, role) => {
    setActionError('');
    try {
      const updated = await updateUser(user.id, { role });
      setUsers((list) => list.map((u) => (u.id === user.id ? updated : u)));
      upsertLinkedMember(updated);
    } catch (err) {
      setActionError(err.message || 'Could not update role.');
    }
  };

  const changeBranch = async (user, branch) => {
    setActionError('');
    try {
      // Company always tracks the branch a login is moved to -- see
      // MembersPage.jsx's changeBranch for the same rule.
      const company = (branchCompany || {})[branch] || '';
      const updated = await updateUser(user.id, { branch, company });
      setUsers((list) => list.map((u) => (u.id === user.id ? updated : u)));
      upsertLinkedMember(updated);
    } catch (err) {
      setActionError(err.message || 'Could not update branch.');
    }
  };

  const remove = async (user) => {
    setActionError('');
    try {
      await deleteUser(user.id);
      setUsers((list) => list.filter((u) => u.id !== user.id));
      removeLinkedMember(user.id);
    } catch (err) {
      setActionError(err.message || 'Could not delete user.');
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 24px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <ShieldCheck size={22} color="var(--accent-violet)" />
        <h1 style={{ fontSize: 30 }}>Superadmin</h1>
      </div>
      <p style={{ color: 'var(--ink-500)', fontSize: 14, marginBottom: 24 }}>
        Manage the login credentials table (stored, hashed, in Postgres).
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <GlassButton variant="primary" icon={UserPlus} style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setAddOpen(true)}>
          Add login
        </GlassButton>
      </div>

      {loadError && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 16px', marginBottom: 16, borderRadius: 12, background: 'rgba(220,80,60,0.08)', color: 'var(--accent-coral)', fontSize: 13 }}>
          <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            {loadError} If this is a fresh deploy, make sure Postgres is attached and the server was redeployed with{' '}
            <code>npm start</code>.
          </span>
        </div>
      )}

      {actionError && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'rgba(220,80,60,0.08)', color: 'var(--accent-coral)', fontSize: 12 }}>
          <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{actionError}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: 'var(--ink-500)' }}>
          <Loader2 size={16} className="spinner" /> Loading…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* An Admin granted this page (via Role Permissions -> Superadmin)
              only ever sees logins within their own company -- otherwise
              they'd see every other company's usernames/roles too, even
              though canEditRow already stops them from touching them. */}
          {users.filter((u) => currentIsSuperadmin || u.company === currentUser?.company).map((u) => (
            <GlassCard key={u.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--accent-violet)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12.5,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials(u.displayName || u.username)}
              </div>

              <div style={{ flex: 1, minWidth: 140 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700 }}>{u.displayName || u.username}</p>
                <p style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>@{u.username}</p>
                <p style={{ fontSize: 10.5, color: 'var(--ink-300)' }}>Created by {creatorLabel(u)}</p>
              </div>

              {canEditRow(u) ? (
                <>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {/* An Admin managing a login they created can only move it
                        between Manager/Member — never promote it to Admin or
                        Superadmin. Superadmin has no such restriction. */}
                    {(currentIsSuperadmin ? roleOptions : roleOptions.filter((r) => r !== 'Superadmin' && r !== 'Admin')).map((r) => (
                      <GlassPill key={r} active={u.role === r} onClick={() => changeRole(u, r)}>{r}</GlassPill>
                    ))}
                  </div>

                  <FilterSelect
                    value={u.branch || branchOptions[0] || ''}
                    onChange={(v) => changeBranch(u, v)}
                    options={branchOptions}
                    includeAll={false}
                    style={{ flexShrink: 0 }}
                  />

                  <button
                    onClick={() => setResetTarget(u)}
                    title="Reset password"
                    style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(183,169,154,0.3)', background: 'var(--glass-fill-soft)', color: 'var(--ink-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <KeyRound size={14} />
                  </button>

                  <button
                    onClick={() => remove(u)}
                    title="Delete login"
                    style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(183,169,154,0.3)', background: 'rgba(217,0,0,0.1)', color: 'var(--accent-coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--ink-300)', fontStyle: 'italic', flexShrink: 0 }}>
                  Managed by {creatorLabel(u)}
                </span>
              )}
            </GlassCard>
          ))}
          {users.length === 0 && !loadError && (
            <p style={{ fontSize: 12.5, color: 'var(--ink-300)' }}>No logins yet — add one to get started.</p>
          )}
        </div>
      )}

      <AddUserModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(u) => {
          setUsers((list) => [...list, u]);
          upsertLinkedMember(u);
        }}
        branches={branchOptions}
        branchCompany={branchCompany}
        creatorIsSuperadmin={currentIsSuperadmin}
        creatorAdminId={currentUser?.id}
      />
      <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onSaved={() => {}} />
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
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(183,169,154,0.35)',
  background: 'rgba(255,255,255,0.6)',
  fontSize: 13.5,
  outline: 'none',
};
