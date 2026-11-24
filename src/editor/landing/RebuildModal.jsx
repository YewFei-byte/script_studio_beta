import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import Modal from '../../components/Modal';
import { GlassButton } from '../../components/Glass';
import { normalizeBrandKit } from '../../../shared/brand.js';
import { buildPage } from './aiApi';

// Shown when "Edit" is pressed on a landing page made with the old builder
// (stored HTML, no page data). Rebuilding writes it again as an editable
// page from its own text; the old HTML is kept on the item as a backup.

function textOfOldPage(item) {
  const l = item.landing || {};
  const html = String(l.generated?.html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return [
    `--- Details from the original page ---`,
    l.productName && `Product / business: ${l.productName}`,
    l.about && `About: ${l.about}`,
    l.cta && `Call to action: ${l.cta}`,
    html && `Text on the old page: ${html.slice(0, 12000)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export default function RebuildModal({ item, brandKit, onRebuilt, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const kit = normalizeBrandKit(brandKit);

  const rebuild = async () => {
    setBusy(true);
    setError('');
    try {
      const page = await buildPage({ goal: 'enquiries', layout: 'complete', brand: kit, context: textOfOldPage(item), photos: [] });
      onRebuilt(page);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose} width={480}>
      <h2 style={{ fontSize: 19, marginBottom: 6 }}>Rebuild in the new editor?</h2>
      <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 18, lineHeight: 1.55 }}>
        "{item.title}" was made with the old builder and can't be edited directly. Rebuilding turns it into an editable page
        (click to edit, drag sections, EN and 中文) using its own text and your brand. It takes about 20 seconds; the old version stays
        saved as a backup, and the live page doesn't change until you publish.
      </p>
      {error && <p style={{ fontSize: 13, color: 'var(--accent-coral)', marginBottom: 12 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <GlassButton variant="primary" icon={busy ? Loader2 : Sparkles} disabled={busy} onClick={rebuild} style={{ justifyContent: 'center' }}>
          {busy ? 'Rebuilding…' : 'Rebuild in new editor'}
        </GlassButton>
        <GlassButton variant="ghost" disabled={busy} onClick={onClose} style={{ justifyContent: 'center' }}>
          Not now
        </GlassButton>
      </div>
    </Modal>
  );
}
