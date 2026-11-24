import React from 'react';
import { Layout, MessageSquareText, CalendarClock, Check, Copy, ExternalLink, Sparkles, Rocket, XCircle, RefreshCw, Eye, MessageCircle } from 'lucide-react';
import MiniPage from '../editor/landing/MiniPage';
import { GlassCard, GlassButton } from './Glass';
import { platformMeta } from '../data/mockData';

const STATUS_META = {
  draft: { label: 'Draft', color: 'var(--ink-500)', bg: 'rgba(183,169,154,0.18)' },
  scheduled: { label: 'Scheduled', color: 'var(--accent-violet)', bg: 'rgba(242,170,36,0.14)' },
  published: { label: 'Published', color: 'var(--accent-mint)', bg: 'rgba(0,214,151,0.14)' },
};

function formatScheduled(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// `selectable` (the list's Select mode): clicking the card ticks it instead
// of opening it, and the action buttons are hidden.
export default function ContentCard({ item, stats, onPreview, onPublishClick, onModify, onUnpublish, onPublishNow, onRegenerate, onDuplicate, selectable, selected, onToggleSelect }) {
  const status = STATUS_META[item.status] || STATUS_META.draft;
  const isLanding = item.kind === 'landing';
  const isPublishedPost = item.status === 'published' && !isLanding;
  const platform = platformMeta[item.kind];
  const thumbImg = !isLanding && item.post?.images?.[0]?.img;

  return (
    <GlassCard
      onClick={selectable ? onToggleSelect : undefined}
      style={{ padding: 12, display: 'flex', flexDirection: 'column', position: 'relative', cursor: selectable ? 'pointer' : undefined, outline: selected ? '2.5px solid var(--accent-violet)' : 'none', outlineOffset: -1 }}>
      {selectable && (
        <span role="checkbox" aria-checked={!!selected} aria-label={`Select ${item.title}`}
          style={{ position: 'absolute', top: 20, left: 20, zIndex: 2, width: 24, height: 24, borderRadius: 7, border: `2px solid ${selected ? 'var(--accent-violet)' : 'white'}`, background: selected ? 'var(--accent-violet)' : 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {selected && <Check size={14} color="white" strokeWidth={3} />}
        </span>
      )}
      <div
        onClick={selectable ? undefined : () => onPreview(item)}
        style={{
          height: 130,
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 12,
          cursor: 'pointer',
          background: isLanding ? 'linear-gradient(160deg, #FFF8EC, #FDEFE0)' : '#eee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isLanding && item.landing?.page?.sections ? (
          <div style={{ width: '100%', height: '100%' }}><MiniPage page={item.landing.page} height={130} scale={0.2} radius={0} /></div>
        ) : isLanding ? (
          <div style={{ textAlign: 'center' }}>
            <Layout size={22} color="var(--accent-violet)" style={{ marginBottom: 6 }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-violet)', padding: '0 10px' }}>
              {item.landing?.productName}
            </p>
          </div>
        ) : thumbImg ? (
          <img src={thumbImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Sparkles size={22} color="var(--ink-300)" />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: status.bg, color: status.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {status.label}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'var(--glass-fill-soft)', color: 'var(--ink-500)' }}>
          {isLanding ? 'Landing Page' : platform?.label}
        </span>
      </div>

      <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4, lineHeight: 1.35 }}>{item.title}</p>

      {item.creatorName && (
        <p style={{ fontSize: 10.5, color: 'var(--ink-500)', marginBottom: 6 }}>
          By {item.creatorName}
        </p>
      )}

      {item.status === 'scheduled' && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-500)', marginBottom: 8 }}>
          <CalendarClock size={12} /> {formatScheduled(item.scheduledAt)}
        </p>
      )}
      {item.status === 'scheduled' && item.autoPublishError && (
        // The server's auto-publish job (see server.js) retries every
        // minute, so this isn't necessarily stuck forever -- but if it's
        // something like a disconnected Facebook Page, it'll keep failing
        // the same way until that's fixed, so surface it instead of
        // retrying silently forever.
        <p style={{ fontSize: 11, color: 'var(--accent-coral)', marginBottom: 8, lineHeight: 1.4 }}>
          ⚠ Auto-publish keeps failing: {item.autoPublishError}
        </p>
      )}
      {item.status === 'published' && item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--accent-violet)', marginBottom: 8, wordBreak: 'break-all' }}
        >
          <ExternalLink size={12} style={{ flexShrink: 0 }} /> {item.link.replace(/^https?:\/\//, '')}
        </a>
      )}
      {isLanding && item.status === 'published' && stats && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--ink-500)', marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Page views"><Eye size={12} /> {stats.views}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="WhatsApp button clicks"><MessageCircle size={12} /> {stats.whatsappClicks}</span>
        </p>
      )}

      {!selectable && <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 6, flexWrap: 'wrap' }}>
        {isPublishedPost ? (
          <GlassButton variant="primary" icon={RefreshCw} style={{ flex: 1, padding: '8px 10px', fontSize: 12 }} onClick={() => onRegenerate(item)}>
            Regenerate
          </GlassButton>
        ) : (
          <>
            {item.status === 'draft' && (
              <GlassButton variant="primary" style={{ flex: 1, padding: '8px 10px', fontSize: 12 }} onClick={() => onPublishClick(item)}>
                Publish
              </GlassButton>
            )}
            {item.status === 'scheduled' && (
              <GlassButton variant="primary" icon={Rocket} style={{ flex: 1, padding: '8px 10px', fontSize: 12 }} onClick={() => onPublishNow(item)}>
                Publish Now
              </GlassButton>
            )}
            {item.status === 'published' && (
              <GlassButton variant="danger" icon={XCircle} style={{ flex: 1, padding: '8px 10px', fontSize: 12 }} onClick={() => onUnpublish(item)}>
                Unpublish
              </GlassButton>
            )}
            <GlassButton
              variant="ghost"
              icon={MessageSquareText}
              style={{ flex: item.status === 'draft' ? 'none' : 1, padding: '8px 10px', fontSize: 12 }}
              onClick={() => onModify(item)}
            >
              Edit
            </GlassButton>
          </>
        )}
        {onDuplicate && (
          <GlassButton variant="ghost" icon={Copy} title="Duplicate as a new draft" aria-label="Duplicate" style={{ flex: 'none', padding: '8px 10px', fontSize: 12 }} onClick={() => onDuplicate(item)} />
        )}
      </div>}
    </GlassCard>
  );
}
