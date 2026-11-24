import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout, Sparkles } from 'lucide-react';

const CHOICES = [
  {
    id: 'post',
    icon: Sparkles,
    label: 'Generate Post',
    accent: 'var(--accent-violet)',
    gradient: 'linear-gradient(135deg, var(--accent-violet), var(--accent-violet-soft))',
    glow: 'rgba(242,170,36,0.45)',
    detail: 'Social posts + copywriting for Instagram, Facebook & RedNote.',
  },
  {
    id: 'landing',
    icon: Layout,
    label: 'Landing Page',
    accent: 'var(--accent-mint)',
    gradient: 'linear-gradient(135deg, var(--accent-mint), #5CEFC4)',
    glow: 'rgba(0,214,151,0.45)',
    detail: 'A full product landing page, ready to deploy.',
  },
];

const BUBBLE_COLORS = ['rgba(242,170,36,0.28)', 'rgba(0,214,151,0.26)', 'rgba(217,0,0,0.22)'];

function useFloatingBubbles(count = 22) {
  return useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        size: 10 + Math.random() * 26,
        left: Math.random() * 100,
        duration: 9 + Math.random() * 10,
        delay: -Math.random() * 14,
        color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
      })),
    [count]
  );
}

function Bubble({ choice, index, setHovered, onClick }) {
  const Icon = choice.icon;
  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(choice.id)}
      onMouseLeave={() => setHovered((h) => (h === choice.id ? null : h))}
      onFocus={() => setHovered(choice.id)}
      onBlur={() => setHovered((h) => (h === choice.id ? null : h))}
      className="generate-bubble"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1, y: [0, -14, 0] }}
      transition={{
        opacity: { delay: 0.15 + index * 0.1, duration: 0.4 },
        scale: { delay: 0.15 + index * 0.1, duration: 0.4, type: 'spring' },
        y: { duration: 3.2 + index * 0.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 },
      }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      style={{
        width: 220,
        height: 220,
        borderRadius: '50%',
        border: 'none',
        background: choice.gradient,
        boxShadow: `0 20px 50px ${choice.glow}, inset 0 2px 12px rgba(255,255,255,0.35)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: 'pointer',
        color: 'white',
      }}
    >
      <Icon size={30} strokeWidth={2} />
      <span style={{ fontSize: 16, fontWeight: 700 }}>{choice.label}</span>
    </motion.button>
  );
}

export default function GeneratePage({ onSelect }) {
  const bubbles = useFloatingBubbles();
  const [hovered, setHovered] = useState(null);
  const active = CHOICES.find((c) => c.id === hovered);

  return (
    <div style={{ position: 'relative', maxWidth: 980, margin: '0 auto', padding: '40px 24px 80px', textAlign: 'center', overflow: 'hidden' }}>
      {bubbles.map((b) => (
        <span
          key={b.id}
          style={{
            position: 'absolute',
            bottom: -40,
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            background: b.color,
            boxShadow: 'inset 0 0 8px rgba(255,255,255,0.4)',
            animation: `bubbleRise ${b.duration}s ease-in ${b.delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}

      <h1 style={{ fontSize: 30, marginBottom: 4, position: 'relative' }}>Generate</h1>
      <p style={{ color: 'var(--ink-500)', fontSize: 14, marginBottom: 56, position: 'relative' }}>What would you like to create?</p>

      <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', position: 'relative' }}>
        {CHOICES.map((c, i) => (
          <Bubble key={c.id} choice={c} index={i} hovered={hovered} setHovered={setHovered} onClick={() => onSelect(c.id)} />
        ))}
      </div>

      <div
        style={{
          minHeight: 40,
          marginTop: 30,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          position: 'relative',
          maxWidth: 460,
          padding: '0 20px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <AnimatePresence mode="wait">
          {active && (
            <motion.p
              key={active.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-500)', lineHeight: 1.5 }}
            >
              <strong style={{ color: active.accent }}>{active.label}</strong> — {active.detail}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
