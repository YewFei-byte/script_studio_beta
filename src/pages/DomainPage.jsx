import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { GlassButton } from '../components/Glass';

export default function DomainPage({ profile, setProfile }) {
  const [domain, setDomain] = useState(profile.domain);

  const saveDomain = () => setProfile((p) => ({ ...p, domain }));

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '10px 24px 80px' }}>
      <h1 style={{ fontSize: 30, marginBottom: 4 }}>Domain</h1>
      <p style={{ color: 'var(--ink-500)', fontSize: 14, marginBottom: 32 }}>Company website domain.</p>

      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Company Website (Domain)
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Globe size={15} style={{ position: 'absolute', left: 14, top: 13, color: 'var(--ink-300)' }} />
          <input value={domain} onChange={(e) => setDomain(e.target.value)} style={{ ...inputStyle, paddingLeft: 38 }} />
        </div>
        <GlassButton variant="primary" style={{ padding: '0 18px' }} onClick={saveDomain} disabled={domain === profile.domain}>
          Save
        </GlassButton>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(183,169,154,0.35)',
  background: 'rgba(255,255,255,0.6)',
  fontSize: 13.8,
  outline: 'none',
};
