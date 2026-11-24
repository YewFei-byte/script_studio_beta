import React from 'react';

// Simple platform marks for the settings icon tiles (lucide-react has no
// brand icons). Drawn white on the platform's colour tile.

function Tile({ background, children, size = 34 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.27, background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.12)' }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" aria-hidden="true">{children}</svg>
    </span>
  );
}

export function FacebookTile(props) {
  return (
    <Tile background="#1877F2" {...props}>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3Z" fill="white" />
    </Tile>
  );
}

export function InstagramTile(props) {
  return (
    <Tile background="linear-gradient(45deg,#F58529 0%,#DD2A7B 55%,#8134AF 100%)" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="4.5" stroke="white" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.6" stroke="white" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="white" />
    </Tile>
  );
}

export function YouTubeTile(props) {
  return (
    <Tile background="#FF0033" {...props}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="white" />
      <path d="M10.2 9.2v5.6l4.8-2.8-4.8-2.8Z" fill="#FF0033" />
    </Tile>
  );
}

export function GoogleCalendarTile(props) {
  return (
    <Tile background="#1A73E8" {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2.5" fill="white" />
      <rect x="4" y="5" width="16" height="4" rx="2" fill="#D2E3FC" />
      <path d="M8 3.5v3M16 3.5v3" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <text x="12" y="17.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#1A73E8" fontFamily="Arial, sans-serif">31</text>
    </Tile>
  );
}
