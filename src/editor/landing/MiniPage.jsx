import React, { useMemo } from 'react';
import { renderPage } from '../../../shared/landing/render.js';

// A live, scaled-down render of a landing page (layout thumbnails, landing
// page cards). Not interactive.
export default function MiniPage({ page, height = 210, scale = 0.24, radius = 10 }) {
  const html = useMemo(() => renderPage(page, { lang: 'en', still: true }).html, [page]);
  return (
    <div style={{ height, overflow: 'hidden', borderRadius: radius, background: 'white', position: 'relative' }}>
      <iframe title="Page preview" srcDoc={html} sandbox="allow-scripts" tabIndex={-1} aria-hidden="true" loading="lazy"
        style={{ width: `${100 / scale}%`, height: `${height / scale}px`, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }} />
    </div>
  );
}
