import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import SideMenu from './SideMenu';

export default function TopBar({ user, onLogout, view, onNavigate, isSuperadmin, menuAccess }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '20px 32px',
          position: 'relative',
          zIndex: 5,
          gap: 12,
        }}
      >
        <button
          onClick={() => setMenuOpen(true)}
          title="Menu"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '1px solid var(--glass-border)',
            background: 'var(--glass-fill)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-700)',
            boxShadow: 'var(--glass-shadow)',
            flexShrink: 0,
            cursor: 'pointer',
            justifySelf: 'start',
          }}
        >
          <Menu size={20} strokeWidth={2} />
        </button>

        <button
          onClick={() => onNavigate('generate')}
          title="Back to Generate"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifySelf: 'center',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          <img src="/logo.png" alt="" width={24} height={24} style={{ display: 'block' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>
            Script Studio
          </span>
        </button>

        <div style={{ justifySelf: 'end', fontSize: 12, color: 'var(--ink-500)', textAlign: 'right' }}>
          {user && (
            <>
              <div style={{ fontWeight: 700, color: 'var(--ink-700)' }}>{user.displayName || user.username}</div>
              <div>{user.role}{user.branch ? ` · ${user.branch}` : ''}</div>
            </>
          )}
        </div>
      </div>

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        view={view}
        onNavigate={onNavigate}
        onLogout={onLogout}
        isSuperadmin={isSuperadmin}
        menuAccess={menuAccess}
      />
    </>
  );
}
