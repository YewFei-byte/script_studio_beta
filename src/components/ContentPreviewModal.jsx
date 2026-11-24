import React from 'react';
import { ExternalLink, MessageSquareText, Code2, Copy, Target, Megaphone, Rocket, XCircle, RefreshCw, Download } from 'lucide-react';
import Modal from './Modal';
import { GlassButton } from './Glass';
import ContentPreview from './ContentPreview';
import { platformMeta } from '../data/mockData';
import { slugify } from '../utils/links';
import { buildLandingZip } from '../utils/landingZip';

function LinkRow({ icon: Icon, label, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        padding: '8px 10px',
        borderRadius: 10,
        background: 'var(--glass-fill-soft)',
        border: '1px solid var(--glass-border)',
        fontSize: 11.5,
        color: 'var(--ink-700)',
        marginBottom: 6,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700, marginBottom: 2 }}>
        <Icon size={12} color="var(--accent-violet)" /> {label}
      </span>
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>
        {href.replace(/^https?:\/\//, '')}
      </span>
    </a>
  );
}

const sectionLabel = {
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--ink-500)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  marginBottom: 8,
};

async function downloadGeneratedLanding(item, generated) {
  const blob = await buildLandingZip(generated, {
    page: item.landing?.page,
    logoUrl: item.landing?.logoUrl,
    title: item.landing?.productName || item.title,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(item.title)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// Downloads every generated poster image for a post, one file at a time.
// Images are either a same-origin /api/poster-image/:id URL (see
// posterImages.js) or, if that upload ever failed, the original data: URL
// -- <a download> works for both without needing to fetch/blob them first.
// Browsers can be fussy about firing several downloads back to back with
// zero delay (some silently drop everything past the first), so each click
// is staggered slightly instead of firing in a tight loop.
function downloadGeneratedImages(item) {
  const images = item.post?.images || [];
  images.forEach((image, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = image.img;
      a.download = `${slugify(item.title)}-${i + 1}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, i * 300);
  });
}

export default function ContentPreviewModal({ item, onClose, onModify, onPublishClick, onUnpublish, onPublishNow, onRegenerate, onDuplicate }) {
  if (!item) return null;
  const isLanding = item.kind === 'landing';
  const isPublishedPost = item.status === 'published' && !isLanding;
  const generated = isLanding ? item.landing?.generated : null;

  return (
    <Modal open={!!item} onClose={onClose} width="90vw">
      <div style={{ display: 'grid', gridTemplateColumns: '4fr 1fr', gap: 20 }}>
        <div>
          <ContentPreview item={item} height={600} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h2 style={{ fontSize: 16, marginBottom: 4, lineHeight: 1.3 }}>{item.title}</h2>
          {item.creatorName && (
            <p style={{ fontSize: 11, color: 'var(--ink-500)', marginBottom: 6 }}>
              Created by {item.creatorName}
            </p>
          )}
          <p style={{ color: 'var(--ink-500)', fontSize: 11.5, marginBottom: 16, lineHeight: 1.5 }}>{item.guidance}</p>

          {!isLanding && item.post?.caption && (
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>{platformMeta[item.kind]?.label || item.kind}</p>
              <p style={{ fontSize: 12, color: 'var(--ink-700)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.post.caption}</p>
            </div>
          )}

          {item.status === 'published' && (
            <div style={{ marginBottom: 16 }}>
              <p style={sectionLabel}>Links</p>
              {item.link && <LinkRow icon={ExternalLink} label="Live" href={item.link} />}
              {isLanding && item.ctaLink && <LinkRow icon={Target} label="CTA" href={item.ctaLink} />}
              {isLanding && item.metaAdLink && <LinkRow icon={Megaphone} label="Meta Ads" href={item.metaAdLink} />}
              {isLanding && item.sourceCodeLink && <LinkRow icon={Code2} label="Source" href={item.sourceCodeLink} />}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {(generated?.html || item.landing?.page) && (
              <GlassButton variant="ghost" icon={Download} style={{ justifyContent: 'center' }} onClick={() => downloadGeneratedLanding(item, generated || undefined)}>
                Download .zip
              </GlassButton>
            )}
            {!isLanding && item.post?.images?.length > 0 && (
              <GlassButton variant="ghost" icon={Download} style={{ justifyContent: 'center' }} onClick={() => downloadGeneratedImages(item)}>
                Download image{item.post.images.length > 1 ? 's' : ''}
              </GlassButton>
            )}
            {isPublishedPost ? (
              <GlassButton variant="primary" icon={RefreshCw} style={{ justifyContent: 'center' }} onClick={() => onRegenerate(item)}>
                Regenerate
              </GlassButton>
            ) : (
              <>
                {item.status === 'draft' && (
                  <GlassButton variant="primary" style={{ justifyContent: 'center' }} onClick={() => onPublishClick(item)}>
                    Publish / Schedule
                  </GlassButton>
                )}
                {item.status === 'scheduled' && (
                  <GlassButton variant="primary" icon={Rocket} style={{ justifyContent: 'center' }} onClick={() => onPublishNow(item)}>
                    Publish Now
                  </GlassButton>
                )}
                {item.status === 'published' && (
                  <GlassButton variant="danger" icon={XCircle} style={{ justifyContent: 'center' }} onClick={() => onUnpublish(item)}>
                    Unpublish
                  </GlassButton>
                )}
                <GlassButton variant="ghost" icon={MessageSquareText} style={{ justifyContent: 'center' }} onClick={() => onModify(item)}>
                  Edit
                </GlassButton>
              </>
            )}
            {onDuplicate && (
              <GlassButton variant="ghost" icon={Copy} style={{ justifyContent: 'center' }} onClick={() => onDuplicate(item)}>
                Duplicate
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
