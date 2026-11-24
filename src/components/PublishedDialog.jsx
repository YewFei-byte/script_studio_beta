import React, { useState } from 'react';
import { Check, Copy, ExternalLink, PartyPopper } from 'lucide-react';
import Modal from './Modal';
import { GlassButton } from './Glass';
import { platformMeta } from '../data/mockData';

// Shown right after something goes live: the link, ready to copy, open or
// send on WhatsApp. See src/utils/publishEvents.js.

export default function PublishedDialog({ item, republished, onClose }) {
  const [copied, setCopied] = useState(false);
  const isLanding = item.kind === 'landing';
  const link = item.link || '';
  const where = isLanding ? '' : platformMeta[item.kind]?.label || 'the platform';

  const title = isLanding
    ? republished ? 'Your changes are live' : 'Your page is live'
    : `Posted to ${where}`;
  const sub = isLanding
    ? 'Share this link anywhere: WhatsApp, Facebook or your bio.'
    : link ? 'Here is the post.' : `It's on ${where} now. Open ${where} to see it.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Older browsers / no permission: fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal open onClose={onClose} width={440} zIndex={90}>
      <div style={{ textAlign: 'center', paddingTop: 6 }}>
        <span style={{ width: 54, height: 54, borderRadius: 999, background: 'rgba(14,138,95,0.12)', color: '#0E8A5F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <PartyPopper size={26} />
        </span>
        <h2 style={{ fontSize: 21, marginBottom: 4 }}>{title}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 18 }}>{sub}</p>
      </div>

      {link && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px 6px 14px', borderRadius: 12, border: '1.5px solid rgba(183,169,154,0.45)', background: 'white', marginBottom: 12 }}>
            <a href={link} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
              {link.replace(/^https?:\/\//, '')}
            </a>
            <button type="button" onClick={copy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 0, background: copied ? '#0E8A5F' : 'var(--accent-violet)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {copied ? <><Check size={14} strokeWidth={3} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <GlassButton variant="ghost" icon={ExternalLink} onClick={() => window.open(link, '_blank', 'noopener')} style={{ flex: 1, justifyContent: 'center' }}>
              {isLanding ? 'Open page' : 'Open post'}
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, '_blank', 'noopener')} style={{ flex: 1, justifyContent: 'center' }}>
              Send on WhatsApp
            </GlassButton>
          </div>
        </>
      )}

      <GlassButton variant={link ? 'subtle' : 'primary'} onClick={onClose} style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>Done</GlassButton>
    </Modal>
  );
}
