import React from 'react';

export function GlassCard({ children, style, className = '', strong = false, ...rest }) {
  return (
    <div
      className={`glass-card ${className}`}
      style={{
        background: strong ? 'var(--glass-fill-strong)' : 'var(--glass-fill)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--glass-shadow)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function GlassButton({ children, variant = 'primary', icon: Icon, style, ...rest }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 14.5,
    fontWeight: 600,
    padding: '12px 22px',
    borderRadius: 999,
    border: 'none',
    fontFamily: 'var(--font-body)',
  };

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-violet-soft))',
      color: 'white',
      boxShadow: '0 6px 20px rgba(242,170,36,0.35)',
    },
    ghost: {
      background: 'var(--glass-fill-soft)',
      backdropFilter: 'blur(16px)',
      color: 'var(--ink-900)',
      border: '1px solid var(--glass-border)',
    },
    subtle: {
      background: 'transparent',
      color: 'var(--ink-500)',
      border: '1px solid rgba(183,169,154,0.4)',
    },
    danger: {
      background: 'rgba(217,0,0,0.12)',
      color: 'var(--accent-coral)',
      border: '1px solid rgba(217,0,0,0.3)',
    },
  };

  return (
    <button className="gbtn" style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {Icon && <Icon size={17} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function GlassPill({ children, active, onClick, icon: Icon }) {
  return (
    <button
      className="gpill"
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 999,
        fontSize: 13.5,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: active ? '1px solid var(--accent-violet)' : '1px solid rgba(183,169,154,0.4)',
        background: active ? 'rgba(242,170,36,0.14)' : 'transparent',
        color: active ? 'var(--accent-violet)' : 'var(--ink-500)',
      }}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}
