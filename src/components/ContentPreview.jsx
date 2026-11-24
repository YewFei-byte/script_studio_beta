import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, ShieldCheck, Star, X, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './Glass';
import { buildLandingDocument } from '../../shared/landingDocument.js';
import { renderPage } from '../../shared/landing/render.js';

export default function ContentPreview({ item, height = 360 }) {
  if (item.kind === 'landing') {
    return <LandingPreview data={item.landing} height={height} />;
  }
  return <PostPreview data={item.post} height={height} />;
}

function LandingPreview({ data, height }) {
  const isDark = data.theme === 'dark';
  const heading = data.language === 'Chinese' ? '全新推出' : 'New Arrival';
  const generated = data.generated;

  if (generated?.html || data.page?.sections) {
    // New section-based pages render from their JSON; older pages are stored HTML.
    const srcDoc = data.page?.sections
      ? renderPage(data.page).html
      : buildLandingDocument(generated, { inline: true, title: data.productName, logoUrl: data.logoUrl });

    return (
      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.4)' }}>
          <span style={dotStyle('#FF7A6B')} />
          <span style={dotStyle('#F5C451')} />
          <span style={dotStyle('#2FD9C4')} />
        </div>
        <iframe
          title="Generated landing page"
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          style={{ width: '100%', height, border: 'none', display: 'block', background: 'white' }}
        />
      </GlassCard>
    );
  }

  return (
    <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.4)' }}>
        <span style={dotStyle('#FF7A6B')} />
        <span style={dotStyle('#F5C451')} />
        <span style={dotStyle('#2FD9C4')} />
      </div>

      <div style={{ height, overflowY: 'auto', background: isDark ? '#1B1C2B' : '#FCFBFF', color: isDark ? '#F2F2F8' : 'var(--ink-900)' }}>
        <div style={{ padding: '42px 28px', textAlign: 'center', background: isDark ? 'linear-gradient(160deg, #1B1C2B, #2A2C42)' : 'linear-gradient(160deg, #FFF8EC, #FDEFE0)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-violet)', textTransform: 'uppercase' }}>{heading}</span>
          <h2 style={{ fontSize: 26, margin: '10px 0 12px' }}>{data.productName || 'Your Product'}</h2>
          <p style={{ maxWidth: 380, margin: '0 auto 22px', fontSize: 13.3, opacity: 0.75 }}>
            {data.about || 'A short, benefit-led description generated from your requirement.'}
          </p>
          <button style={{ padding: '12px 26px', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, var(--accent-violet), var(--accent-violet-soft))', color: 'white', fontWeight: 700, fontSize: 13.3 }}>
            {data.cta || 'Shop Now'}
          </button>
        </div>

        <div style={{ padding: '28px' }}>
          <h4 style={{ fontSize: 14, textAlign: 'center', marginBottom: 16, opacity: 0.9 }}>Why it works</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[Sparkles, ShieldCheck, Star].map((Icon, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 12, borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(242,170,36,0.05)' }}>
                <Icon size={17} color="var(--accent-violet)" style={{ marginBottom: 6 }} />
                <p style={{ fontSize: 10.5, opacity: 0.8 }}>Key benefit highlight</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '8px 28px 36px', textAlign: 'center', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(183,169,154,0.2)'}` }}>
          <p style={{ fontSize: 12.5, marginBottom: 12, opacity: 0.8 }}>Ready to try {data.productName || 'it'}?</p>
          <button style={{ padding: '10px 24px', borderRadius: 999, border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(242,170,36,0.4)'}`, background: 'transparent', color: isDark ? 'white' : 'var(--accent-violet)', fontWeight: 700, fontSize: 12 }}>
            {data.cta || 'Shop Now'}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function PostPreview({ data, height }) {
  const images = data.images || [];
  const [lightbox, setLightbox] = useState(null);
  // Carousels with more than 2 slides scroll sideways instead of squeezing.
  const scroll = images.length > 2;

  return (
    <GlassCard style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
      {images.length > 1 && (
        <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, padding: '3px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}>
          Carousel · {images.length}
        </span>
      )}
      <div style={{ height, display: 'flex', flexDirection: images.length > 1 ? 'row' : 'column', gap: 3, background: '#eee', overflowX: scroll ? 'auto' : 'hidden' }}>
        {images.length > 0 ? (
          images.map((img, i) => (
            <div
              key={i}
              onClick={() => setLightbox(img.img)}
              style={{ position: 'relative', cursor: 'zoom-in', minHeight: 0, overflow: 'hidden', ...(scroll ? { flex: '0 0 auto', height: '100%', aspectRatio: '4 / 5' } : { flex: 1, minWidth: 0 }) }}
            >
              <img src={img.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Maximize2 size={13} color="white" />
              </div>
            </div>
          ))
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300)', fontSize: 12 }}>
            No image
          </div>
        )}
      </div>

      {createPortal(
        <AnimatePresence>
          {lightbox && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightbox(null)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 500,
                background: 'rgba(15,16,26,0.82)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                cursor: 'zoom-out',
              }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
                style={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.15)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
              <motion.img
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                src={lightbox}
                alt=""
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '90vw', maxHeight: '88vh', borderRadius: 16, objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </GlassCard>
  );
}

function dotStyle(color) {
  return { width: 9, height: 9, borderRadius: '50%', background: color };
}
