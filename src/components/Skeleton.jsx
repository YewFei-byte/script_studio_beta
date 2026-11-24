import React from 'react';

// A grey placeholder block for "being made" states (see .skeleton in index.css).
export function Bone({ w = '100%', h = 12, r = 8, style }) {
  return <span className="skeleton" aria-hidden="true" style={{ display: 'block', width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />;
}

// The status lines under a skeleton: what is being made and the current step.
export function SkeletonStatus({ title, step, hint }) {
  return (
    <div role="status" aria-live="polite" style={{ textAlign: 'center', marginTop: 22 }}>
      <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{title}</p>
      {step && <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{step}…</p>}
      {hint && <p style={{ fontSize: 12, color: 'var(--ink-300)', marginTop: 10 }}>{hint}</p>}
    </div>
  );
}
