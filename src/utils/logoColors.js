// "Pick colours from my logo": reads the logo's pixels in the browser and
// builds a Brand Kit palette from its dominant colours. No AI call.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read the logo image."));
    img.src = src;
  });
}

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

const mix = ([r, g, b], [r2, g2, b2], t) => [r + (r2 - r) * t, g + (g2 - g) * t, b + (b2 - b) * t];

export async function paletteFromLogo(src) {
  // /api/poster-image URLs are absolute (built for Facebook/Instagram), which
  // in dev can point at the API port instead of this page's origin. Reading
  // pixels needs same-origin, so load our own images by path.
  try {
    const u = new URL(src, window.location.href);
    if (u.pathname.startsWith('/api/')) src = u.pathname;
  } catch {
    // data: URLs etc. — use as-is
  }
  const img = await loadImage(src);
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  // Bucket pixels into a coarse 4-bit-per-channel grid and count them.
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // transparent
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    e.r += r; e.g += g; e.b += b; e.n += 1;
    buckets.set(key, e);
  }
  const colors = [...buckets.values()]
    .map((e) => {
      const rgb = [e.r / e.n, e.g / e.n, e.b / e.n];
      return { rgb, n: e.n, ...hsl(...rgb) };
    })
    .sort((a, b) => b.n - a.n);

  // Primary: the most common colourful pixel (skip white/black/grey backgrounds).
  const colourful = colors.filter((c) => c.s > 0.25 && c.l > 0.15 && c.l < 0.85);
  const primary = colourful[0]?.rgb || colors.find((c) => c.l > 0.1 && c.l < 0.9)?.rgb;
  if (!primary) throw new Error("The logo doesn't have enough colour to build a palette from — pick a preset instead.");

  // Accent: a dark colour from the logo if it has one, else a deep shade of primary.
  const dark = colors.find((c) => c.l < 0.3 && c.n > 4);
  const accent = dark ? dark.rgb : mix(primary, [20, 20, 20], 0.7);

  return {
    primary: toHex(...primary),
    accent: toHex(...accent),
    bg: toHex(...mix(primary, [255, 255, 255], 0.94)),
    surface: '#FFFFFF',
    text: toHex(...mix(accent, [15, 15, 15], 0.5)),
  };
}
