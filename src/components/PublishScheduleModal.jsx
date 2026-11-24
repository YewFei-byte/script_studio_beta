import React, { useEffect, useState } from 'react';
import { Rocket, CalendarClock, Save, UploadCloud, Loader2, CheckCircle2, Globe, Check, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import { GlassButton } from './Glass';
import { platformMeta } from '../data/mockData';
import { checkSiteSlug, publishLandingPage, suggestSlug } from '../utils/hosting';
import { postToFacebookPage } from '../utils/facebook';
import { postToInstagram } from '../utils/instagram';
import { postToYoutube } from '../utils/youtube';
import { announcePublished } from '../utils/publishEvents';

const PUBLISH_STEPS_LANDING = ['Preparing the page…', 'Saving to Presoft hosting…', 'Going live…'];

// Typing "Kopi Kita!" becomes "kopi-kita": only what an address can hold.
const cleanSlug = (v) => v.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, 40);

// The landing page's web address, checked live as you type.
function AddressField({ slug, onChange, status }) {
  const host = status.url ? status.url.replace(/^https?:\/\/[^.]+\./, '').replace(/\/$/, '') : 'pages.presoft.my';
  const color = status.state === 'ok' ? '#0E8A5F' : status.state === 'bad' ? 'var(--accent-coral)' : 'var(--ink-500)';
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Web address</p>
      <label style={{ display: 'flex', alignItems: 'center', borderRadius: 12, border: `1.5px solid ${status.state === 'bad' ? 'rgba(217,0,0,0.4)' : 'rgba(183,169,154,0.45)'}`, background: 'white', overflow: 'hidden' }}>
        <Globe size={15} color="var(--ink-300)" style={{ marginLeft: 12, flexShrink: 0 }} />
        <input value={slug} onChange={(e) => onChange(cleanSlug(e.target.value))} aria-label="Web address" spellCheck={false}
          style={{ flex: 1, minWidth: 60, padding: '11px 2px 11px 8px', border: 0, outline: 'none', fontSize: 14, fontWeight: 600, textAlign: 'right', background: 'transparent' }} />
        <span style={{ padding: '11px 12px 11px 0', fontSize: 14, color: 'var(--ink-500)', whiteSpace: 'nowrap' }}>.{host}</span>
      </label>
      <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, marginTop: 6, color, minHeight: 18 }}>
        {status.state === 'checking' && <><Loader2 size={12} className="spin" /> Checking…</>}
        {status.state === 'ok' && <><Check size={13} strokeWidth={3} /> Available</>}
        {status.state === 'bad' && <><AlertCircle size={13} /> {status.reason}</>}
      </p>
    </div>
  );
}
const publishSteps = (item) =>
  item.kind === 'landing'
    ? PUBLISH_STEPS_LANDING
    : ['Preparing media…', `Uploading to ${platformMeta[item.kind]?.label || 'platform'}…`, 'Publishing…'];

// Facebook, Instagram, and YouTube all read back whatever SocialMediaPage's
// real connect flow stored on the profile (see src/pages/SocialMediaPage.jsx).
function getFacebookConnection(profile) {
  const fb = profile?.socials?.find((s) => s.id === 'fb');
  return fb?.connected && fb.pageId && fb.pageAccessToken ? fb : null;
}
// Instagram reuses Facebook's own Page Access Token — it isn't a real
// connection unless Facebook is connected too, on top of having its own
// Business Account ID saved.
function getInstagramConnection(profile) {
  const ig = profile?.socials?.find((s) => s.id === 'ig');
  const fb = getFacebookConnection(profile);
  return ig?.connected && ig.businessId && fb ? { ...ig, accessToken: fb.pageAccessToken } : null;
}
function getYoutubeConnection(profile) {
  const yt = profile?.socials?.find((s) => s.id === 'yt');
  return yt?.connected && yt.clientId && yt.clientSecret && yt.refreshToken ? yt : null;
}

export default function PublishScheduleModal({ item, profile, onClose, onSave, startAtSequence }) {
  const [stage, setStage] = useState(startAtSequence ? 'sequence' : 'choose'); // choose | sequence | schedule
  const [stepIdx, setStepIdx] = useState(0);
  const [scheduledAt, setScheduledAt] = useState('');
  const [videoName, setVideoName] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  const [slug, setSlug] = useState(() => item?.siteSlug || (item?.kind === 'landing' ? suggestSlug(item) : ''));
  const [slugStatus, setSlugStatus] = useState({ state: 'checking' });

  const isRealLanding = item?.kind === 'landing' && !!(item?.landing?.generated?.html || item?.landing?.page?.sections);
  const fbConnection = item?.kind === 'fb' ? getFacebookConnection(profile) : null;
  const isRealFb = !!fbConnection;
  const igConnection = item?.kind === 'ig' ? getInstagramConnection(profile) : null;
  const isRealIg = !!igConnection;
  const ytConnection = item?.kind === 'yt' ? getYoutubeConnection(profile) : null;
  // YouTube additionally needs an actual video file attached (see
  // UploadPostModal.jsx) — credentials alone aren't enough to have anything
  // to upload.
  const isRealYt = !!ytConnection && !!item?.post?.videoFile;
  // RedNote (XHS) can still be generated/copywritten like any other platform
  // (see the post create flow), but there's no real posting integration for it —
  // so unlike other placeholder platforms it never gets the simulated/mock
  // "published" path either. It can only ever be saved as a draft.
  const isXhs = item?.kind === 'xhs';

  useEffect(() => {
    setStage(startAtSequence ? 'sequence' : 'choose');
    setStepIdx(0);
    setScheduledAt('');
    setVideoName(null);
    setPublishError(null);
    setRetryToken(0);
    setSlug(item?.siteSlug || (item?.kind === 'landing' ? suggestSlug(item) : ''));
  }, [item, startAtSequence]);

  // Live availability check for the landing page address (debounced).
  useEffect(() => {
    if (item?.kind !== 'landing' || stage !== 'choose') return undefined;
    setSlugStatus({ state: 'checking' });
    const t = setTimeout(() => {
      checkSiteSlug(slug, item.id)
        .then((r) => setSlugStatus(r.available ? { state: 'ok', url: r.url } : { state: 'bad', reason: r.reason }))
        .catch((err) => setSlugStatus({ state: 'bad', reason: err.message }));
    }, 350);
    return () => clearTimeout(t);
  }, [slug, item, stage]);

  useEffect(() => {
    if (stage !== 'sequence' || !item) return;
    // Saves the new status and shows the 'it's live' dialog with the link.
    const published = (extra) => {
      announcePublished({ ...item, status: 'published', ...extra });
      onSave('published', extra);
    };
    const steps = publishSteps(item);

    // Facebook/Instagram/YouTube never get a simulated/mock publish path —
    // each one either really posts, or fails loudly with a real error
    // telling you exactly what to fix. No fake link is ever shown for any
    // of them.
    if (item.kind === 'fb' && !isRealFb) {
      setPublishError('Facebook isn’t connected yet — go to Settings → Social Media and save a Page ID + Page Access Token first.');
      return;
    }
    if (item.kind === 'ig' && !isRealIg) {
      setPublishError(
        getFacebookConnection(profile)
          ? 'Instagram isn’t connected yet — go to Settings → Social Media and save your Instagram Business Account ID.'
          : 'Instagram isn’t connected yet — it needs Facebook connected first (Instagram posts through the same Page Access Token), then your Instagram Business Account ID.'
      );
      return;
    }
    if (item.kind === 'yt' && !isRealYt) {
      setPublishError(
        !ytConnection
          ? 'YouTube isn’t connected yet — go to Settings → Social Media and save a Client ID, Client Secret, and Refresh Token.'
          : 'No video file is attached to this post — go back to Upload and attach a video file, then try publishing again.'
      );
      return;
    }

    // RedNote (XHS) has no real posting integration, so it never gets the
    // mock/simulated "published" path either — it can only be saved as a
    // draft (see the 'choose' stage below, which hides Publish/Schedule for
    // XHS entirely). This is a safety net for any path that reaches
    // 'sequence' directly (e.g. "Publish Now" on an already-scheduled item).
    if (isXhs) {
      setPublishError("RedNote (XHS) posting isn't set up yet — close this and use Save (draft) instead.");
      return;
    }

    if (isRealLanding) {
      // Real landing page: animate up to the final step, then wait on the
      // actual publish call rather than a fixed timer.
      if (stepIdx < steps.length - 1) {
        const t = setTimeout(() => setStepIdx((i) => i + 1), 700);
        return () => clearTimeout(t);
      }

      let cancelled = false;
      setPublishError(null);
      publishLandingPage(item, slug)
        .then(({ link, siteSlug }) => {
          if (cancelled) return;
          published({ link, siteSlug });
        })
        .catch((err) => {
          if (cancelled) return;
          setPublishError(err.message || 'Something went wrong publishing the page.');
        });
      return () => { cancelled = true; };
    }

    // Real Facebook/Instagram/YouTube post: animate up to the final step,
    // then wait on the actual API call instead of a fixed timer. By this
    // point every kind reaching here has already passed its own
    // real-connection check above, so exactly one of these three applies.
    if (stepIdx < steps.length - 1) {
      const t = setTimeout(() => setStepIdx((i) => i + 1), 700);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    setPublishError(null);

    if (item.kind === 'fb') {
      // facebook.js uploads a data: URL as raw photo bytes directly (no
      // hosting needed), or uses a real http(s) URL as-is if one is ever
      // wired in later — either way, the actual image gets posted.
      postToFacebookPage({
        pageId: fbConnection.pageId,
        pageAccessToken: fbConnection.pageAccessToken,
        message: item.post?.caption,
        imageUrls: (item.post?.images || []).map((i) => i?.img).filter(Boolean),
      })
        .then((res) => {
          if (cancelled) return;
          // Use Facebook's own response to link to the real post instead of
          // buildLinks()'s cosmetic mock slug — post_id is present on photo
          // uploads, plain feed posts return it directly as `id`.
          const fbPostId = res?.post_id || res?.id;
          const link = fbPostId ? `https://www.facebook.com/${fbPostId}` : undefined;
          published({ link, video: videoName ? { fileName: videoName } : undefined });
        })
        .catch((err) => {
          if (cancelled) return;
          setPublishError(err.message || 'Something went wrong publishing to Facebook.');
        });
    } else if (item.kind === 'ig') {
      postToInstagram({
        businessId: igConnection.businessId,
        accessToken: igConnection.accessToken,
        caption: item.post?.caption,
        imageUrls: (item.post?.images || []).map((i) => i?.img).filter(Boolean),
      })
        .then((res) => {
          if (cancelled) return;
          const link = res?.permalink || undefined;
          published({ link });
        })
        .catch((err) => {
          if (cancelled) return;
          setPublishError(err.message || 'Something went wrong publishing to Instagram.');
        });
    } else if (item.kind === 'yt') {
      postToYoutube({
        clientId: ytConnection.clientId,
        clientSecret: ytConnection.clientSecret,
        refreshToken: ytConnection.refreshToken,
        title: item.title,
        description: item.post?.caption,
        videoFile: item.post?.videoFile,
      })
        .then((res) => {
          if (cancelled) return;
          published({ link: res?.link });
        })
        .catch((err) => {
          if (cancelled) return;
          setPublishError(err.message || 'Something went wrong publishing to YouTube.');
        });
    }

    return () => { cancelled = true; };
  }, [stage, stepIdx, item, slug, videoName, onSave, isRealLanding, isRealFb, isRealIg, isRealYt, isXhs, fbConnection, igConnection, ytConnection, profile, retryToken]);

  if (!item) return null;
  const isLanding = item.kind === 'landing';
  const steps = publishSteps(item);
  const addressBlocked = isLanding && slugStatus.state !== 'ok';

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    setVideoName(f ? f.name : 'promo_clip.mp4');
  };

  return (
    <Modal open={!!item} onClose={onClose} width={460}>
      {stage === 'choose' && (
        <>
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>{item.title}</h2>
          <p style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 20 }}>
            {isXhs
              ? "RedNote (XHS) posting isn't set up yet — you can save this as a draft for now."
              : 'Save it for later, publish it now, or schedule it for a specific time.'}
          </p>

          {/* YouTube's real video comes from the Upload button (see
              UploadPostModal.jsx), not from here — showing this decorative
              drop-zone alongside it would be confusing about which video
              actually gets used. Show what's really attached instead. */}
          {isLanding && <AddressField slug={slug} onChange={setSlug} status={slugStatus} />}

          {item.kind === 'yt' ? (
            <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 12, background: item.post?.videoFile ? 'rgba(0,214,151,0.08)' : 'rgba(220,80,60,0.08)', fontSize: 12.5, color: item.post?.videoFile ? 'var(--ink-900)' : 'var(--accent-coral)' }}>
              {item.post?.videoFile
                ? `Video attached: ${item.post.videoFile.name} — this is what will upload to YouTube.`
                : 'No video file attached — go back to Upload and attach one before publishing.'}
            </div>
          ) : !isLanding && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
                Attach a video (optional)
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => setVideoName(videoName || 'promo_clip.mp4')}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--accent-violet)' : 'rgba(183,169,154,0.4)'}`,
                  borderRadius: 14,
                  padding: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: dragOver ? 'rgba(242,170,36,0.06)' : 'transparent',
                  fontSize: 12.5,
                  color: videoName ? 'var(--ink-900)' : 'var(--ink-500)',
                }}
              >
                <UploadCloud size={16} color="var(--accent-violet)" style={{ marginBottom: 4 }} />
                <div>{videoName ? `${videoName} — will go out with this post` : 'Drag & drop, or click to attach a video'}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!isXhs && (
              <>
                <GlassButton variant="primary" icon={Rocket} style={{ justifyContent: 'center' }} disabled={addressBlocked} onClick={() => setStage('sequence')}>
                  Publish now
                </GlassButton>
                <GlassButton variant="ghost" icon={CalendarClock} style={{ justifyContent: 'center' }} disabled={addressBlocked} onClick={() => setStage('schedule')}>
                  Schedule publish
                </GlassButton>
              </>
            )}
            <GlassButton variant={isXhs ? 'primary' : 'subtle'} icon={Save} style={{ justifyContent: 'center' }} onClick={() => onSave('draft', {})}>
              Save (draft)
            </GlassButton>
          </div>
        </>
      )}

      {stage === 'sequence' && (
        <div style={{ padding: '20px 4px' }}>
          {publishError ? (
            <>
              <h3 style={{ fontSize: 15, marginBottom: 8, color: 'var(--accent-red, #D90000)' }}>
                {isLanding ? "Couldn't publish the page" : "Couldn't publish"}
              </h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-500)', marginBottom: 18 }}>{publishError}</p>
              <GlassButton
                variant="primary"
                style={{ justifyContent: 'center', width: '100%' }}
                onClick={() => { setPublishError(null); setRetryToken((t) => t + 1); }}
              >
                Retry
              </GlassButton>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: 15, marginBottom: 18 }}>Publishing…</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {steps.map((label, i) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: i <= stepIdx ? 1 : 0.35 }}>
                    {i < stepIdx ? (
                      <CheckCircle2 size={16} color="var(--accent-mint)" />
                    ) : i === stepIdx ? (
                      <Loader2 size={16} color="var(--accent-violet)" className="spinner" />
                    ) : (
                      <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid var(--glass-border)' }} />
                    )}
                    <span style={{ fontSize: 13, color: 'var(--ink-700)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {stage === 'schedule' && (
        <>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Schedule publish</h3>
          <p style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 16 }}>Pick a date and time.</p>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(183,169,154,0.35)',
              background: 'rgba(255,255,255,0.6)',
              fontSize: 13.5,
              outline: 'none',
              marginBottom: 20,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <GlassButton variant="ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStage('choose')}>Back</GlassButton>
            <GlassButton
              variant="primary"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={!scheduledAt}
              // Stored as a real UTC instant (ISO), not the raw
              // datetime-local string -- that string has no timezone info,
              // so "2026-08-27T16:46" means something different depending
              // on which machine's clock reads it back. Converting here
              // (in the browser, which knows its own timezone) is what lets
              // the auto-publish scheduler in server.js -- which almost
              // certainly runs in a different timezone than whoever
              // scheduled this -- fire at the actual intended moment
              // instead of off by however many hours apart the two are.
              onClick={() => onSave('scheduled', { scheduledAt: new Date(scheduledAt).toISOString(), video: videoName ? { fileName: videoName } : undefined, ...(isLanding ? { siteSlug: slug } : {}) })}
            >
              Confirm
            </GlassButton>
          </div>
        </>
      )}
    </Modal>
  );
}
