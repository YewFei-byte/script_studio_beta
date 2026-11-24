import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { GlassCard } from './Glass';

// dismissible={false} turns off Escape, backdrop and the X (e.g. while
// something is being created, so a stray click doesn't throw it away).
export default function Modal({ open, onClose, children, width = 720, showClose = true, zIndex = 50, dismissible = true }) {
  const close = dismissible ? onClose : undefined;
  // Backdrop click and Escape both close the modal now — previously the
  // small X button (top-right of the card) was the ONLY way to close any
  // modal in the app, so anything that made it hard to hit (a wide 90vw
  // preview, a small screen, a stray overlapping element) left someone
  // stuck with no way out. These are standard, safe fallbacks for every
  // modal, not just the ones that were reported stuck.
  useEffect(() => {
    if (!open || !close) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(20, 20, 35, 0.28)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: width, maxHeight: '88vh', display: 'flex' }}
          >
            {/* Outer shell owns the rounded border + clipping. It never scrolls itself,
                so the native scrollbar can never poke out past the rounded corners. */}
            <GlassCard
              strong
              style={{ width: '100%', maxHeight: '88vh', position: 'relative', padding: 0, overflow: 'hidden', display: 'flex' }}
            >
              {showClose && close && (
                <button
                  onClick={close}
                  style={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: '1px solid rgba(183,169,154,0.3)',
                    background: 'var(--glass-fill-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--ink-500)',
                    zIndex: 2,
                  }}
                >
                  <X size={16} />
                </button>
              )}
              {/* Inner scroll container — flat edges, scrollbar sits flush inside the clipped shell */}
              <div style={{ width: '100%', overflowY: 'auto', padding: 32 }}>
                {children}
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
