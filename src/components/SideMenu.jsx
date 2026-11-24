import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Layout,
  Sparkles,
  Users,
  UserCog,
  Globe,
  Share2,
  KeyRound,
  FileText,
  Wand2,
  LogOut,
  ShieldCheck,
  Palette,
} from 'lucide-react';
import { GlassCard } from './Glass';

function NavItem({ icon: Icon, label, active, onClick, disabled, disabledTitle }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className="side-nav-item"
      disabled={disabled}
      title={disabled ? (disabledTitle || "You don't have access to this — ask a Superadmin to grant it in Member → Role Permissions") : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 14px',
        borderRadius: 12,
        border: 'none',
        background: !disabled && active ? 'rgba(242,170,36,0.14)' : 'transparent',
        color: disabled ? 'var(--ink-300)' : active ? 'var(--accent-violet)' : 'var(--ink-700)',
        fontSize: 13.5,
        fontWeight: !disabled && active ? 700 : 600,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

export default function SideMenu({ open, onClose, view, onNavigate, onLogout, menuAccess = {} }) {
  const go = (v, allowed) => {
    if (allowed === false) return; // extra guard — the button is already non-clickable when disabled
    onNavigate(v);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              background: 'rgba(20, 20, 35, 0.28)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          />
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 61, width: 300, padding: 16 }}
          >
            <GlassCard strong style={{ height: '100%', padding: 18, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src="/logo.png" alt="" width={22} height={22} style={{ display: 'block' }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15.5 }}>Script Studio</span>
                </div>
                <button
                  onClick={onClose}
                  style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--glass-border)', background: 'var(--glass-fill-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-500)' }}
                >
                  <X size={14} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Every item is always shown — an item this role doesn't have
                    access to (per Member → Role Permissions) just renders
                    greyed out and unclickable instead of disappearing, so
                    everyone can see the full shape of the app. menuAccess
                    already bakes in every bypass (Superadmin always true,
                    Admin per its own row) — see AdminPanel.jsx. */}
                <NavItem icon={Wand2} label="Generate" active={view === 'generate'} disabled={!menuAccess.generate} onClick={() => go('generate', menuAccess.generate)} />
                <NavItem icon={FileText} label="Requirement" active={view === 'requirement'} disabled={!menuAccess.requirement} onClick={() => go('requirement', menuAccess.requirement)} />
                <NavItem icon={UserCog} label="User Setting" active={view === 'setting-user'} disabled={!menuAccess.userSetting} onClick={() => go('setting-user', menuAccess.userSetting)} />

                <div style={{ height: 1, background: 'var(--glass-border)', margin: '8px 4px' }} />

                <p
                  style={{
                    padding: '4px 14px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--ink-300)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Admin Panel
                </p>

                <NavItem icon={Layout} label="Landing Page" active={view === 'admin-landing'} disabled={!menuAccess.landingPage} onClick={() => go('admin-landing', menuAccess.landingPage)} />
                <NavItem icon={Sparkles} label="Post" active={view === 'admin-post'} disabled={!menuAccess.post} onClick={() => go('admin-post', menuAccess.post)} />
                <NavItem icon={Palette} label="Brand" active={view === 'setting-brand'} disabled={!menuAccess.brand} onClick={() => go('setting-brand', menuAccess.brand)} />
                <NavItem icon={Users} label="Member" active={view === 'members'} disabled={!menuAccess.member} onClick={() => go('members', menuAccess.member)} />
                {/* Domain / Social Media / API can only ever be true here for
                    Superadmin or Admin — Manager/Member are excluded in code,
                    not just in the stored table — see AdminPanel.jsx. */}
                <NavItem icon={Globe} label="Domain" active={view === 'setting-domain'} disabled={!menuAccess.domain} disabledTitle="Locked to Superadmin / Admin only" onClick={() => go('setting-domain', menuAccess.domain)} />
                <NavItem icon={Share2} label="Social Media" active={view === 'setting-social'} disabled={!menuAccess.socialMedia} disabledTitle="Locked to Superadmin / Admin only" onClick={() => go('setting-social', menuAccess.socialMedia)} />
                <NavItem icon={KeyRound} label="API" active={view === 'setting-api'} disabled={!menuAccess.api} disabledTitle="Locked to Superadmin / Admin only" onClick={() => go('setting-api', menuAccess.api)} />
                {/* Managing real logins is now a normal checklist row
                    (superadmin) like Domain/Social Media/API — Superadmin
                    always has it, Admin only if granted, Manager/Member
                    excluded in code same as the other adminOnly rows. */}
                <NavItem icon={ShieldCheck} label="Superadmin" active={view === 'superadmin'} disabled={!menuAccess.superadmin} disabledTitle="Locked to Superadmin / Admin only" onClick={() => go('superadmin', menuAccess.superadmin)} />
              </div>

              <div style={{ paddingTop: 10, borderTop: '1px solid var(--glass-border)' }}>
                <NavItem icon={LogOut} label="Log Out" onClick={onLogout} />
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
