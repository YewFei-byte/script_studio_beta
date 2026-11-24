import React, { useState } from 'react';
import { UserPlus, Trash2, Check, X, Plus, Building2, AlertCircle } from 'lucide-react';
import { GlassCard, GlassButton, GlassPill } from '../components/Glass';
import Modal from '../components/Modal';
import SearchSortBar from '../components/SearchSortBar';
import FilterSelect from '../components/FilterSelect';
import { roleOptions, assignableRoles, permissionDefs } from '../data/mockData';
import { createUser, updateUser, deleteUser } from '../utils/usersApi';
import { sendInviteEmail } from '../utils/inviteApi';

const MEMBER_SORT_OPTIONS = [
  { id: 'name-asc', label: 'Name (A–Z)' },
  { id: 'name-desc', label: 'Name (Z–A)' },
  { id: 'role', label: 'Role' },
];

const sectionTitle = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--ink-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 14,
};

const STATUS_META = {
  active: { label: 'Active', color: 'var(--accent-mint)', bg: 'rgba(0,214,151,0.14)' },
  invited: { label: 'Invited', color: 'var(--accent-violet)', bg: 'rgba(242,170,36,0.14)' },
};

function initials(name) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function InviteMemberModal({ open, onClose, onInvite, lockedBranch, branches, canCreateLogin }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Manager');
  const [branch, setBranch] = useState(lockedBranch || (branches || [])[0] || '');
  const [createLogin, setCreateLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setEmail('');
    setRole('Manager');
    setBranch(lockedBranch || (branches || [])[0] || '');
    setCreateLogin(false);
    setUsername('');
    setPassword('');
    setError('');
  };

  const submit = async () => {
    setError('');
    if (!name.trim() || !email.trim()) return;
    if (createLogin && (!username.trim() || !password.trim())) {
      setError('Username and password are required to create a login.');
      return;
    }
    setSaving(true);
    try {
      await onInvite({
        name: name.trim(),
        email: email.trim(),
        role,
        branch: lockedBranch || branch,
        createLogin,
        username: username.trim(),
        password,
      });
      reset();
    } catch (err) {
      setError(err.message || 'Could not send invite.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} width={400}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Invite a member</h2>
      <p style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 20 }}>If you also create a login below, they'll get an email with their username, password, and a link to sign in.</p>

      <label style={fieldLabel}>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={{ ...inputStyle, marginBottom: 14 }} />

      <label style={fieldLabel}>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" style={{ ...inputStyle, marginBottom: 14 }} />

      <label style={fieldLabel}>Role</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Superadmin isn't offered here — that tier is only ever granted
            from the real Superadmin login dashboard, not a pill on a demo
            member card. */}
        {assignableRoles.map((r) => (
          <GlassPill key={r} active={role === r} onClick={() => setRole(r)}>{r}</GlassPill>
        ))}
      </div>

      {lockedBranch ? (
        <p style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 18 }}>
          Branch: <strong>{lockedBranch}</strong> (you can only invite into your own branch)
        </p>
      ) : (
        <>
          <label style={fieldLabel}>Branch</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
            {(branches || []).length > 0 ? (
              branches.map((b) => (
                <GlassPill key={b} active={branch === b} onClick={() => setBranch(b)}>{b}</GlassPill>
              ))
            ) : (
              <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>No branches yet — add one below first.</p>
            )}
          </div>
        </>
      )}

      {canCreateLogin && (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: createLogin ? 14 : 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={createLogin} onChange={(e) => setCreateLogin(e.target.checked)} />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Also create a login for this member</span>
          </label>
          {createLogin && (
            <>
              <label style={fieldLabel}>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. jane.chen" style={{ ...inputStyle, marginBottom: 14 }} />
              <label style={fieldLabel}>Password</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password" style={{ ...inputStyle, marginBottom: 20 }} />
            </>
          )}
        </>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', marginBottom: 14, borderRadius: 10, background: 'rgba(220,80,60,0.08)', color: 'var(--accent-coral)', fontSize: 12 }}>
          <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <GlassButton variant="primary" icon={UserPlus} disabled={saving} style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>
        {saving ? 'Sending…' : 'Send Invite'}
      </GlassButton>
    </Modal>
  );
}

// Access model:
// - Superadmin: full control, every company, every branch.
// - Admin (canManageAll, not Superadmin): full control, but scoped to their
//   own COMPANY -- every branch under it, not other companies' branches.
//   This is what makes running more than one company through the same
//   deployment safe: an Admin from Company A never sees or manages Company
//   B's team, branches, or posts.
// - Manager (canManageBranch, not canManageAll): can view/invite/edit/remove
//   members within their own branch only — everything here gets scoped to
//   currentUser.branch.
// - Member (neither): read-only view of their own branch's roster, no
//   editing controls rendered at all.
// The Role Permissions table itself (who can do what, company-wide) is
// Superadmin-only to edit — even Admin only gets a read-only view of it,
// since Admin's own row is now real, changeable data.
export default function MembersPage({ members, setMembers, branches, setBranches, companies, setCompanies, branchCompany, setBranchCompany, permissions, setPermissions, currentUser, isSuperadmin, canManageAll, canManageBranch }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [roleFilter, setRoleFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [newBranch, setNewBranch] = useState('');
  const [newBranchCompany, setNewBranchCompany] = useState('');
  const [branchError, setBranchError] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [companyError, setCompanyError] = useState('');
  const [emailNotice, setEmailNotice] = useState('');

  const canManage = canManageAll || canManageBranch;
  const scopeBranch = !canManageAll && currentUser?.branch ? currentUser.branch : null;
  // An Admin (not Superadmin) is scoped to their own company -- every
  // branch under it is fair game, but nothing outside it. Superadmin has
  // no scoping at all.
  const scopeCompany = canManageAll && !isSuperadmin ? (currentUser?.company || null) : null;
  // Branches an Admin is allowed to see/assign: their own company's only.
  // Superadmin (and roles with no company concept applying to them, e.g.
  // Manager/Member who are already locked to one branch) see the full list.
  const branchesInScope = scopeCompany
    ? (branches || []).filter((b) => (branchCompany || {})[b] === scopeCompany)
    : (branches || []);

  // Members created from a real login (see SuperadminPage.jsx) carry a
  // `loginId` pointing back at that login row. Editing/removing them here
  // best-effort mirrors the change back onto the login table too, so the
  // two lists don't drift apart again — same idea as the sync SuperadminPage
  // does in the other direction. These are fire-and-forget: a member's role/
  // branch in this app's roster is still the source of truth for content
  // permissions even if the login-table sync happens to fail (e.g. Postgres
  // briefly unreachable).
  const changeRole = (id, role) => {
    setMembers((list) => list.map((m) => (m.id === id ? { ...m, role } : m)));
    const m = members.find((x) => x.id === id);
    if (m?.loginId) updateUser(m.loginId, { role }).catch(() => {});
  };
  const changeBranch = (id, branch) => {
    // Moving someone to a new branch also carries them to that branch's
    // company -- a member's company is derived from their branch, never
    // set independently, so these two always stay consistent.
    const company = (branchCompany || {})[branch] || null;
    setMembers((list) => list.map((m) => (m.id === id ? { ...m, branch, company } : m)));
    const m = members.find((x) => x.id === id);
    if (m?.loginId) updateUser(m.loginId, { branch, company }).catch(() => {});
  };
  const removeMember = (id) => {
    const m = members.find((x) => x.id === id);
    setMembers((list) => list.filter((x) => x.id !== id));
    if (m?.loginId) deleteUser(m.loginId).catch(() => {});
  };

  const q = search.trim().toLowerCase();
  const bySearch = members
    .filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
    .filter((m) => roleFilter === 'all' || m.role === roleFilter)
    .filter((m) => branchFilter === 'all' || m.branch === branchFilter)
    .filter((m) => !scopeBranch || m.branch === scopeBranch)
    .filter((m) => !scopeCompany || m.company === scopeCompany || branchesInScope.includes(m.branch));
  const visibleMembers = [...bySearch].sort((a, b) => {
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    if (sortBy === 'role') return roleOptions.indexOf(a.role) - roleOptions.indexOf(b.role);
    return a.name.localeCompare(b.name);
  });

  // Every branch belongs to exactly one company. Superadmin picks which
  // company when adding a branch (must add the company first); an Admin
  // adding a branch has no choice to make -- it's automatically their own
  // company, since that's the only company they're allowed to touch.
  const addBranch = () => {
    const name = newBranch.trim();
    if (!name) return;
    // Branch names are one flat list shared by every company on this
    // deployment (see the note on removeBranch below), so "HQ" can only
    // ever belong to one company at a time. Rather than a bare rejection
    // that leaves a second company's admin wondering how their own,
    // never-yet-used branch is somehow "already taken", name the company
    // that's actually holding it and suggest the "Company - Location"
    // pattern that sidesteps the collision entirely.
    const clash = (branches || []).find((b) => b.toLowerCase() === name.toLowerCase());
    if (clash) {
      const clashCompany = (branchCompany || {})[clash];
      const myCompany = (isSuperadmin ? newBranchCompany : currentUser?.company) || 'YourCompany';
      setBranchError(
        clashCompany
          ? `"${name}" is already used by ${clashCompany}. Try "${myCompany} - ${name}" instead.`
          : `That branch already exists. Try prefixing it with your company name, e.g. "${myCompany} - ${name}".`
      );
      return;
    }
    const company = isSuperadmin ? (newBranchCompany || (companies || [])[0] || '') : (currentUser?.company || '');
    if (isSuperadmin && (companies || []).length > 0 && !company) {
      setBranchError('Pick which company this branch belongs to.');
      return;
    }
    setBranches((list) => [...(list || []), name]);
    if (company) setBranchCompany((map) => ({ ...(map || {}), [name]: company }));
    setNewBranch('');
    setNewBranchCompany('');
    setBranchError('');
  };

  const removeBranch = (name) => {
    const inUse = members.some((m) => m.branch === name);
    if (inUse) {
      setBranchError(`Can't remove "${name}" — it's still assigned to at least one member.`);
      return;
    }
    setBranches((list) => (list || []).filter((b) => b !== name));
    setBranchCompany((map) => {
      const next = { ...(map || {}) };
      delete next[name];
      return next;
    });
    setBranchError('');
  };

  // Companies are Superadmin-only to add/remove -- an Admin operates
  // inside whichever company they were assigned to, they don't get to
  // create new ones.
  const addCompany = () => {
    const name = newCompany.trim();
    if (!name) return;
    if ((companies || []).some((c) => c.toLowerCase() === name.toLowerCase())) {
      setCompanyError('That company already exists.');
      return;
    }
    setCompanies((list) => [...(list || []), name]);
    setNewCompany('');
    setCompanyError('');
  };

  const removeCompany = (name) => {
    const inUse = Object.values(branchCompany || {}).some((c) => c === name);
    if (inUse) {
      setCompanyError(`Can't remove "${name}" — it still has branches assigned to it.`);
      return;
    }
    setCompanies((list) => (list || []).filter((c) => c !== name));
    setCompanyError('');
  };

  // If "Also create a login" was checked, create the real login first —
  // that call can fail (e.g. username already taken), and we don't want a
  // roster entry left behind with no way to sign in, so the member is only
  // added once the login succeeds (or wasn't requested at all). Errors
  // propagate back up to the modal, which stays open and shows them.
  const invite = async ({ name, email, role, branch, createLogin, username, password }) => {
    // Company is always derived from the chosen branch, never picked
    // independently -- keeps every member/login's company in lockstep with
    // whichever branch they're actually on.
    const company = (branchCompany || {})[branch] || scopeCompany || '';
    let loginId;
    if (createLogin) {
      const user = await createUser({
        username,
        password,
        displayName: name,
        email,
        role,
        branch,
        company,
        // True creator tracking (see AdminPanel.jsx's effectiveApiKeys /
        // adminCreatedMemberIds): Superadmin-created logins have no creator
        // admin (they fall back to the shared default key + Superadmin-only
        // visibility rules); everyone else's invited members are tracked
        // back to whichever Admin/Manager sent this invite.
        createdByAdminId: isSuperadmin ? null : currentUser?.id,
      });
      loginId = user.id;
    }
    const newMemberId = `m${Date.now()}`;
    // Status used to jump straight to "Active" the instant a login was
    // created here, regardless of whether the invite email actually went
    // out -- misleading, since "Active" reads as "this person has their
    // credentials and can get in", but if the email failed (see the catch
    // below) they don't actually know their username/password yet. Now it
    // starts as "Invited" and only flips to "Active" once the email
    // genuinely sends -- if it fails, it stays "Invited" as an honest
    // signal that you still need to share the credentials some other way
    // (they're shown in the failure notice below either way).
    setMembers((list) => [
      ...list,
      { id: newMemberId, loginId, name, email, role, branch, company, status: 'invited', color: 'var(--accent-violet)' },
    ]);
    setInviteOpen(false);

    // Email sending is best-effort and separate from the invite itself --
    // the member + login already exist by this point, so a failed email
    // should surface as a warning, not undo the invite or reopen the modal.
    if (createLogin) {
      try {
        await sendInviteEmail({ to: email, name, username, password, appUrl: window.location.origin });
        setEmailNotice(`Invite email sent to ${email}.`);
        setMembers((list) => list.map((m) => (m.id === newMemberId ? { ...m, status: 'active' } : m)));
      } catch (err) {
        setEmailNotice(`${name} was added, but the invite email couldn't be sent (${err.message}). Share their username/password with them directly.`);
      }
      setTimeout(() => setEmailNotice(''), 7000);
    }
  };

  const togglePermission = (role, key, adminOnly) => {
    if (!isSuperadmin) return; // only Superadmin can change what a role is allowed to do, company-wide
    if (role === 'Superadmin') return; // Superadmin's own column is a fixed display, not an editable state
    if (adminOnly && (role === 'Manager' || role === 'Member')) return; // Domain/Social Media/API can never be granted to Manager/Member
    setPermissions((p) => ({ ...p, [role]: { ...p[role], [key]: !p[role][key] } }));
  };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '10px 24px 80px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Members</h1>
      <p style={{ color: 'var(--ink-500)', fontSize: 14, marginBottom: 32 }}>
        Manage who has access, and what each role can do.
      </p>

      {emailNotice && (
        <div style={{ padding: '10px 14px', marginBottom: 20, borderRadius: 10, background: 'rgba(79,70,229,0.08)', color: 'var(--accent-violet)', fontSize: 12.5, fontWeight: 600 }}>
          {emailNotice}
        </div>
      )}

      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ ...sectionTitle, marginBottom: 0 }}>Team Members{scopeBranch ? ` — ${scopeBranch}` : scopeCompany ? ` — ${scopeCompany}` : ''}</h2>
          {canManage && (
            <GlassButton variant="primary" icon={UserPlus} style={{ padding: '8px 16px', fontSize: 12.5 }} onClick={() => setInviteOpen(true)}>
              Invite Member
            </GlassButton>
          )}
        </div>

        <SearchSortBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search members by name or id…"
          sortBy={sortBy}
          onSortChange={setSortBy}
          sortOptions={MEMBER_SORT_OPTIONS}
          style={{ marginBottom: 14 }}
        >
          <FilterSelect value={roleFilter} onChange={setRoleFilter} options={roleOptions} allLabel="All roles" />
          {/* Branch is fixed to your own when you're scoped to one branch —
              no point offering a dropdown that would just show nothing. */}
          {!scopeBranch && (
            <FilterSelect value={branchFilter} onChange={setBranchFilter} options={branchesInScope} allLabel="All branches" />
          )}
        </SearchSortBar>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 344, overflowY: 'auto', paddingRight: 4 }}>
          {visibleMembers.map((m) => {
            const status = STATUS_META[m.status] || STATUS_META.active;
            return (
              <GlassCard key={m.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: m.color,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12.5,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {initials(m.name)}
                </div>

                <div style={{ flex: 1, minWidth: 140 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700 }}>{m.name}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{m.email}</p>
                </div>

                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: status.bg, color: status.color, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>
                  {status.label}
                </span>

                {canManage ? (
                  <>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {assignableRoles.map((r) => (
                        <GlassPill key={r} active={m.role === r} onClick={() => changeRole(m.id, r)}>{r}</GlassPill>
                      ))}
                    </div>

                    <FilterSelect
                      value={m.branch || branchesInScope[0] || ''}
                      onChange={(v) => changeBranch(m.id, v)}
                      // A branch-scoped Manager can't move someone out of
                      // their own branch — that'd just be handing off a
                      // teammate to a branch they can no longer manage. An
                      // Admin similarly can't move someone into another
                      // company's branch.
                      options={scopeBranch ? [scopeBranch] : branchesInScope}
                      includeAll={false}
                      style={{ flexShrink: 0 }}
                    />

                    <button
                      onClick={() => removeMember(m.id)}
                      title="Remove member"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        border: '1px solid rgba(183,169,154,0.3)',
                        background: 'rgba(217,0,0,0.1)',
                        color: 'var(--accent-coral)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)', flexShrink: 0 }}>{m.role}</span>
                )}
              </GlassCard>
            );
          })}
          {visibleMembers.length === 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--ink-300)' }}>
              {members.length === 0 ? 'No members yet.' : 'No members match your search or filters.'}
            </p>
          )}
        </div>
      </section>

      {isSuperadmin && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={sectionTitle}>Companies</h2>
          <p style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 14, marginTop: -8 }}>
            Running more than one company through this deployment? Add each one here, then assign
            every branch below to the company it belongs to. An Admin only ever sees their own
            company's branches, members, and posts — never another company's.
          </p>
          <GlassCard style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCompany(); }}
                placeholder="e.g. Presoft AI Marketing"
                style={{ ...inputStyle, flex: 1 }}
              />
              <GlassButton variant="primary" icon={Plus} style={{ padding: '9px 16px', fontSize: 13, flexShrink: 0 }} onClick={addCompany}>
                Add Company
              </GlassButton>
            </div>

            {companyError && (
              <p style={{ fontSize: 12, color: 'var(--accent-coral)', marginBottom: 14 }}>{companyError}</p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(companies || []).map((c) => (
                <span key={c} style={pillTagStyle}>
                  <Building2 size={12} />
                  {c}
                  <button onClick={() => removeCompany(c)} title="Remove company" style={pillRemoveStyle}>
                    <X size={11} />
                  </button>
                </span>
              ))}
              {(companies || []).length === 0 && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-300)' }}>No companies yet — add your first one above.</p>
              )}
            </div>
          </GlassCard>
        </section>
      )}

      {canManageAll && (
        <section style={{ marginBottom: 40 }}>
          <h2 style={sectionTitle}>Branches</h2>
          {(companies || []).length > 1 && (
            <p style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 14, marginTop: -8 }}>
              Branch names are shared across all companies here, so two companies can't both have a
              branch called "HQ" — name yours "YourCompany - HQ" to keep it clearly yours.
            </p>
          )}
          <GlassCard style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <input
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addBranch(); }}
                // Branch names are shared across every company on this
                // deployment (see addBranch's clash check above), so once
                // there's more than one company, "HQ" can only belong to
                // one of them -- hinting the "Company - Location" pattern
                // up front heads off that confusion before it happens.
                placeholder={(companies || []).length > 1 ? 'e.g. Presoft - HQ' : 'e.g. Downtown'}
                style={{ ...inputStyle, flex: 1, minWidth: 160 }}
              />
              {/* Superadmin picks which company a new branch belongs to.
                  An Admin has no choice here -- it's silently their own
                  company, since that's the only one they're allowed to
                  touch. */}
              {isSuperadmin && (companies || []).length > 0 && (
                <FilterSelect
                  value={newBranchCompany || (companies || [])[0] || ''}
                  onChange={setNewBranchCompany}
                  options={companies || []}
                  includeAll={false}
                  style={{ flexShrink: 0 }}
                />
              )}
              <GlassButton variant="primary" icon={Plus} style={{ padding: '9px 16px', fontSize: 13, flexShrink: 0 }} onClick={addBranch}>
                Add Branch
              </GlassButton>
            </div>

            {branchError && (
              <p style={{ fontSize: 12, color: 'var(--accent-coral)', marginBottom: 14 }}>{branchError}</p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(isSuperadmin ? (branches || []) : branchesInScope).map((b) => (
                <span key={b} style={pillTagStyle}>
                  <Building2 size={12} />
                  {b}
                  {/* Superadmin managing multiple companies benefits from
                      seeing which company owns each branch at a glance;
                      an Admin already knows -- it's always their own. */}
                  {isSuperadmin && (branchCompany || {})[b] && (
                    <span style={{ color: 'var(--ink-300)', fontWeight: 500 }}>· {(branchCompany || {})[b]}</span>
                  )}
                  <button onClick={() => removeBranch(b)} title="Remove branch" style={pillRemoveStyle}>
                    <X size={11} />
                  </button>
                </span>
              ))}
              {(isSuperadmin ? (branches || []).length === 0 : branchesInScope.length === 0) && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-300)' }}>No branches yet — add your first one above.</p>
              )}
            </div>
          </GlassCard>
        </section>
      )}

      <section>
        <h2 style={sectionTitle}>Role Permissions</h2>
        <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ ...cellStyle, textAlign: 'left', color: 'var(--ink-500)', fontWeight: 700, fontSize: 11 }}>Permission</th>
                  {roleOptions.map((r) => (
                    <th key={r} style={{ ...cellStyle, color: 'var(--ink-500)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionDefs.map((perm) => (
                  <tr key={perm.key}>
                    <td style={{ ...cellStyle, textAlign: 'left', color: 'var(--ink-900)' }}>
                      {perm.label}
                      {perm.adminOnly && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--ink-300)', textTransform: 'uppercase' }}>
                          Admin-only
                        </span>
                      )}
                    </td>
                    {roleOptions.map((r) => {
                      // Superadmin's column is a fixed display (always on) —
                      // not an editable cell, since Superadmin always has
                      // full access regardless of this table.
                      const isSuperadminCol = r === 'Superadmin';
                      // Domain/Social Media/API can never be turned on for
                      // Manager or Member — locked off in code, not just in
                      // the stored data, so the box always reads as off here.
                      const lockedOff = perm.adminOnly && (r === 'Manager' || r === 'Member');
                      const on = isSuperadminCol ? true : lockedOff ? false : !!permissions[r]?.[perm.key];
                      const editable = isSuperadmin && !isSuperadminCol && !lockedOff;
                      const title = isSuperadminCol
                        ? 'Superadmin always has full access'
                        : lockedOff
                        ? 'Locked to Superadmin / Admin only — cannot be granted here'
                        : isSuperadmin
                        ? undefined
                        : 'Only Superadmin can change role permissions';
                      return (
                        <td key={r} style={cellStyle}>
                          <button
                            onClick={() => togglePermission(r, perm.key, perm.adminOnly)}
                            disabled={!editable}
                            title={title}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 8,
                              border: on ? '1px solid var(--accent-violet)' : '1px solid rgba(183,169,154,0.35)',
                              background: on ? 'var(--accent-violet)' : 'transparent',
                              color: 'white',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: editable ? 'pointer' : 'not-allowed',
                              opacity: editable ? 1 : 0.7,
                            }}
                          >
                            {on ? <Check size={14} /> : <X size={12} color="var(--ink-300)" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={invite}
        lockedBranch={scopeBranch}
        branches={branchesInScope}
        canCreateLogin={canManageAll}
      />
    </div>
  );
}

const pillTagStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 6px 6px 12px',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 600,
  background: 'var(--glass-fill-soft)',
  border: '1px solid var(--glass-border)',
};

const pillRemoveStyle = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(217,0,0,0.1)',
  color: 'var(--accent-coral)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const cellStyle = {
  padding: '12px 16px',
  textAlign: 'center',
  borderBottom: '1px solid var(--glass-border)',
};

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
