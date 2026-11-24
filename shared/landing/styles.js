// Stylesheet for rendered landing pages. Brand colours, fonts and the
// corner-radius style come in as CSS variables, so the same section
// templates work for any brand. Colours derived from the brand (muted text,
// lines, tints) use color-mix, so they always harmonise with the palette.

import { fontPairById } from '../brand.js';

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return [0, 0, 0];
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Readable text colour to put on top of `bg`.
export function onColor(bg, dark = '#16181D', light = '#FFFFFF') {
  return contrast(bg, light) >= contrast(bg, dark) ? light : dark;
}

// A button colour: a palette name ('primary', 'accent', ...), white/black or #hex.
function pickColor(value, c, fallback) {
  if (/^#[0-9a-f]{6}$/i.test(value || '')) return value;
  if (value === 'white') return '#FFFFFF';
  if (value === 'black') return '#111111';
  return ['primary', 'accent', 'bg', 'surface', 'text'].includes(value) ? c[value] : fallback;
}

const RADIUS = {
  sharp: { r: '4px', rLg: '6px', btn: '6px' },
  soft: { r: '14px', rLg: '22px', btn: '999px' },
  round: { r: '22px', rLg: '32px', btn: '999px' },
};

export function themeVars(theme = {}) {
  const c = { primary: '#F2AA24', accent: '#504538', bg: '#F2F1EF', surface: '#FFFFFF', text: '#2B241C', ...(theme.colors || {}) };
  const dark = luminance(c.bg) < 0.25;
  const font = fontPairById(theme.fontPair);
  const rad = RADIUS[theme.radius] || RADIUS.soft;
  const btn = pickColor(theme.button?.bg, c, c.primary);
  const onBtn = pickColor(theme.button?.text, c, onColor(btn));
  return {
    dark,
    css: `:root{
--c-primary:${c.primary};--c-on-primary:${onColor(c.primary)};
--c-accent:${c.accent};--c-on-accent:${onColor(c.accent)};
--c-btn:${btn};--c-on-btn:${onBtn};
--c-bg:${c.bg};--c-surface:${c.surface};--c-text:${c.text};
--c-muted:color-mix(in srgb,var(--c-text) 68%,var(--c-bg));
--c-line:color-mix(in srgb,var(--c-text) 12%,transparent);
--c-tint:color-mix(in srgb,var(--c-primary) ${dark ? 7 : 10}%,var(--c-bg));
--c-tint-2:color-mix(in srgb,var(--c-accent) ${dark ? 6 : 8}%,var(--c-bg));
--shadow:0 1px 2px color-mix(in srgb,var(--c-accent) ${dark ? 40 : 8}%,transparent),0 12px 32px -12px color-mix(in srgb,var(--c-accent) ${dark ? 60 : 22}%,transparent);
--f-display:'${font.display}',ui-sans-serif,system-ui,sans-serif;
--f-body:'${font.body}','Noto Sans SC',ui-sans-serif,system-ui,sans-serif;
--r:${rad.r};--r-lg:${rad.rLg};--r-btn:${rad.btn};
color-scheme:${dark ? 'dark' : 'light'};
}`,
  };
}

// Base + every section's styles. ~14 KB, cached once per page.
export const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:84px}
body{margin:0;background:var(--c-bg);color:var(--c-text);font-family:var(--f-body);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img,video,iframe{display:block;max-width:100%}
a{color:inherit}
h1,h2,h3{font-family:var(--f-display);color:var(--c-accent);line-height:1.08;letter-spacing:-.02em;margin:0;text-wrap:balance}
p{margin:0;text-wrap:pretty}
.wrap{width:100%;max-width:1160px;margin:0 auto;padding:0 20px}
@media(min-width:768px){.wrap{padding:0 32px}}
.sec{padding:72px 0}
@media(min-width:1024px){.sec{padding:104px 0}}
.sec-tint{background:var(--c-tint)}
/* CTA / contact are self-contained cards: less air around them */
.sec-tight{padding:28px 0}
@media(min-width:1024px){.sec-tight{padding:40px 0}}
.sec-tight+.ftr{margin-top:48px}
.h2{font-size:clamp(30px,4.2vw,46px);font-weight:700;max-width:20ch}
.lead{color:var(--c-muted);font-size:clamp(17px,1.5vw,19px);max-width:56ch;margin-top:14px}
.head{margin-bottom:44px}
.head.center{text-align:center}.head.center .h2,.head.center .lead{margin-left:auto;margin-right:auto}
.ic{flex-shrink:0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 26px;border-radius:var(--r-btn);font-weight:700;font-size:16px;text-decoration:none;white-space:nowrap;border:2px solid transparent;transition:transform .2s cubic-bezier(.16,1,.3,1),box-shadow .2s,background .2s;cursor:pointer}
.btn:active{transform:translateY(1px) scale(.99)}
.btn-primary{background:var(--c-btn);color:var(--c-on-btn);box-shadow:0 8px 24px -10px var(--c-btn)}
.btn-primary:hover{box-shadow:0 12px 30px -10px var(--c-btn);transform:translateY(-1px)}
.btn-ghost{color:var(--c-accent);border-color:var(--c-line)}
.btn-ghost:hover{border-color:var(--c-accent)}
.btn .ic{width:20px;height:20px}
.ph{background:linear-gradient(135deg,var(--c-tint),var(--c-tint-2));display:flex;align-items:center;justify-content:center;color:color-mix(in srgb,var(--c-accent) 35%,transparent)}
.ph .ic{width:40px;height:40px}
.ph-edit{flex-direction:column;gap:6px;font-size:14px;font-weight:600;border:2px dashed color-mix(in srgb,var(--c-accent) 25%,transparent)}

/* header */
.hdr{position:sticky;top:0;z-index:20;transition:background .25s,box-shadow .25s,backdrop-filter .25s}
.hdr.scrolled{background:color-mix(in srgb,var(--c-bg) 82%,transparent);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 1px 0 var(--c-line)}
.hdr-in{display:flex;align-items:center;gap:20px;height:68px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:var(--f-display);font-weight:700;font-size:20px;color:var(--c-accent);margin-right:auto;min-width:0}
.brand img{height:34px;width:auto;max-width:160px;object-fit:contain}
.nav{display:none;gap:26px}
.nav a{text-decoration:none;font-size:15px;font-weight:600;color:var(--c-muted)}
.nav a:hover{color:var(--c-accent)}
.lang{display:inline-flex;border:1px solid var(--c-line);border-radius:999px;padding:3px;font-size:13px;font-weight:700}
.lang button{border:0;background:none;color:var(--c-muted);padding:5px 10px;border-radius:999px;cursor:pointer;font:inherit;min-height:32px}
.lang button.on{background:var(--c-accent);color:var(--c-on-accent)}
.hdr .btn{min-height:44px;padding:0 18px;font-size:15px;display:none}
.burger{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;background:none;color:var(--c-accent);cursor:pointer}
.mnav{display:none;flex-direction:column;gap:4px;padding:8px 20px 20px;background:var(--c-bg);border-bottom:1px solid var(--c-line)}
.mnav.open{display:flex}
.mnav a{padding:12px 0;font-weight:600;text-decoration:none;font-size:17px}
.hdr .mnav .btn{display:inline-flex;margin-top:8px}
@media(min-width:900px){.nav{display:flex}.hdr .btn{display:inline-flex}.burger,.mnav{display:none!important}}

/* hero */
.hero{padding:40px 0 72px}
@media(min-width:1024px){.hero{padding:56px 0 96px}}
.eyebrow{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--c-primary);margin-bottom:18px}
.h1{font-size:clamp(38px,5.6vw,66px);font-weight:800;max-width:16ch}
.hero .lead{font-size:clamp(18px,1.7vw,21px);margin-top:20px;max-width:44ch}
.cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
.hero-split{display:grid;gap:40px;align-items:center}
@media(min-width:900px){.hero-split{grid-template-columns:1.05fr .95fr;gap:56px}}
.hero-media{position:relative}
.hero-media img,.hero-media .ph{width:100%;aspect-ratio:5/4;object-fit:cover;border-radius:var(--r-lg)}
.hero-media::after{content:"";position:absolute;inset:auto -14px -14px auto;width:42%;height:46%;border-radius:var(--r-lg);background:var(--c-primary);opacity:.18;z-index:-1}
.hero-centered{text-align:center}
.hero-centered .h1,.hero-centered .lead{margin-left:auto;margin-right:auto}
.hero-centered .cta-row{justify-content:center}
.hero-centered .hero-media{margin-top:56px}
.hero-centered .hero-media img,.hero-centered .hero-media .ph{aspect-ratio:16/7}
.hero-cover{position:relative;min-height:min(78dvh,720px);display:flex;align-items:flex-end;padding:0;color:#fff;margin:0 12px;border-radius:var(--r-lg);overflow:hidden}
@media(min-width:768px){.hero-cover{margin:0 20px}}
.hero-cover>img,.hero-cover>.ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero-cover::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,12,16,.05) 20%,rgba(10,12,16,.72));z-index:1}
.hero-cover .wrap{position:relative;z-index:2;padding-top:120px;padding-bottom:56px}
.hero-cover .h1{color:#fff}.hero-cover .lead{color:rgba(255,255,255,.86)}
.hero-cover .eyebrow{color:#fff;opacity:.9}
.hero-cover .btn-ghost{color:#fff;border-color:rgba(255,255,255,.5)}

/* features: bento */
.bento{display:grid;gap:16px;grid-template-columns:1fr}
@media(min-width:768px){.bento{grid-template-columns:repeat(6,1fr)}}
.tile{background:var(--c-surface);border-radius:var(--r-lg);padding:28px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:10px}
.tile .ic{width:30px;height:30px;color:var(--c-primary)}
.tile h3{font-size:21px;font-weight:700}
.tile p{color:var(--c-muted);font-size:16px}
.tile.big{background:var(--c-accent);color:var(--c-on-accent);justify-content:flex-end;min-height:260px;padding:34px}
.tile.big h3{color:var(--c-on-accent);font-size:clamp(24px,2.4vw,32px)}
.tile.big p{color:color-mix(in srgb,var(--c-on-accent) 78%,transparent);font-size:17px;max-width:40ch}
.tile.big .ic{width:40px;height:40px;color:var(--c-primary);margin-bottom:auto}
.tile.tint{background:var(--c-tint);box-shadow:none}
@media(min-width:768px){.s2{grid-column:span 2}.s3{grid-column:span 3}.s4{grid-column:span 4}.s6{grid-column:span 6}.tall{grid-row:span 2}}
/* features: icon list */
.flist{display:grid;gap:34px 48px}
@media(min-width:768px){.flist{grid-template-columns:repeat(2,1fr)}}
.fitem{display:flex;gap:18px}
.fitem .ib{width:52px;height:52px;border-radius:var(--r);background:var(--c-tint);color:var(--c-primary);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.fitem .ib .ic{width:26px;height:26px}
.fitem h3{font-size:20px;font-weight:700;margin-bottom:6px}
.fitem p{color:var(--c-muted)}

/* steps */
.steps{display:grid;gap:20px;counter-reset:step}
@media(min-width:768px){.steps.row{grid-template-columns:repeat(var(--n,3),1fr)}}
.step{counter-increment:step;position:relative;padding-top:58px}
.step::before{content:counter(step);position:absolute;top:0;left:0;width:42px;height:42px;border-radius:999px;background:var(--c-primary);color:var(--c-on-primary);font-family:var(--f-display);font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center}
.steps.row .step::after{content:"";position:absolute;top:21px;left:54px;right:-8px;height:2px;background:var(--c-line)}
.steps.row .step:last-child::after{display:none}
@media(max-width:767px){.steps.row .step::after{display:none}}
.step h3{font-size:21px;font-weight:700;margin-bottom:6px}
.step p{color:var(--c-muted)}
.steps.timeline{max-width:720px;gap:0}
.steps.timeline .step{padding:0 0 36px 66px;min-height:42px}
.steps.timeline .step:not(:last-child){border-left:2px solid var(--c-line);margin-left:20px;padding-left:46px}
.steps.timeline .step:not(:last-child)::before{left:-22px}
.steps.timeline .step:last-child{margin-left:20px;padding-left:46px}
.steps.timeline .step:last-child::before{left:-20px}

/* pricing */
.tiers{display:grid;gap:18px;align-items:stretch}
@media(min-width:900px){.tiers{grid-template-columns:repeat(var(--n,3),minmax(0,1fr))}}
.tier{background:var(--c-surface);border:1px solid var(--c-line);border-radius:var(--r-lg);padding:30px;display:flex;flex-direction:column;gap:6px}
.tier.hl{border:2px solid var(--c-primary);box-shadow:var(--shadow)}
@media(min-width:900px){.tier.hl{transform:translateY(-10px)}}
.tier .tag{align-self:flex-start;font-size:12.5px;font-weight:700;padding:4px 10px;border-radius:999px;background:var(--c-primary);color:var(--c-on-primary);margin-bottom:6px}
.tier h3{font-size:19px;font-weight:700}
.price{font-family:var(--f-display);font-size:42px;font-weight:800;color:var(--c-accent);letter-spacing:-.02em;margin-top:6px}
.per{color:var(--c-muted);font-size:15px}
.tier ul,.menu ul{list-style:none;margin:18px 0 26px;padding:0;display:flex;flex-direction:column;gap:10px}
.tier li{display:flex;gap:10px;font-size:16px}
.tier li .ic{width:20px;height:20px;color:var(--c-primary);margin-top:3px}
.tier .btn{margin-top:auto;width:100%}
.menu{max-width:760px;background:var(--c-surface);border-radius:var(--r-lg);padding:8px 28px;box-shadow:var(--shadow)}
.mrow{display:flex;align-items:baseline;gap:14px;padding:20px 0}
.mrow+.mrow{border-top:1px solid var(--c-line)}
.mrow h3{font-size:19px;font-weight:700}
.mrow .mt{flex:1;min-width:0}
.mrow .mt p{color:var(--c-muted);font-size:15px}
.mrow .price{font-size:24px;margin:0;white-space:nowrap}
.mrow.hl h3::after{content:"\\2605";color:var(--c-primary);margin-left:8px;font-size:15px}

/* testimonials */
.quotes{display:grid;gap:18px}
@media(min-width:768px){.quotes{grid-template-columns:repeat(var(--n,2),minmax(0,1fr))}}
.qcard{background:var(--c-surface);border-radius:var(--r-lg);padding:30px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:22px}
.qcard blockquote{margin:0;font-size:19px;line-height:1.5;color:var(--c-accent);font-family:var(--f-display);font-weight:500;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.who{display:flex;align-items:center;gap:12px;margin-top:auto}
.av{width:44px;height:44px;border-radius:999px;background:var(--c-tint);color:var(--c-accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0}
.who b{display:block;font-size:15.5px}.who span{display:block;font-size:14px;color:var(--c-muted)}
.spot{max-width:880px}
.spot blockquote{margin:0;font-family:var(--f-display);font-size:clamp(26px,3.2vw,40px);line-height:1.25;color:var(--c-accent);font-weight:600;letter-spacing:-.01em}
.spot .who{margin-top:30px}
.spot-more{display:grid;gap:14px;margin-top:44px}
@media(min-width:768px){.spot-more{grid-template-columns:repeat(2,1fr)}}
.spot-more blockquote{font-size:17px;color:var(--c-text);font-family:var(--f-body);font-weight:400;margin:0}

/* gallery */
.mosaic{display:grid;gap:12px;grid-template-columns:repeat(2,1fr);grid-auto-rows:180px}
@media(min-width:768px){.mosaic{grid-template-columns:repeat(4,1fr);grid-auto-rows:220px}}
.mosaic figure{margin:0;border-radius:var(--r);overflow:hidden}
.mosaic figure:first-child{grid-column:span 2;grid-row:span 2}
.mosaic img,.mosaic .ph{width:100%;height:100%;object-fit:cover}
.strip{display:grid;grid-auto-flow:column;grid-auto-columns:min(78%,340px);gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:10px;scrollbar-width:thin}
.strip figure{margin:0;scroll-snap-align:start;border-radius:var(--r);overflow:hidden;aspect-ratio:4/5}
.strip img,.strip .ph{width:100%;height:100%;object-fit:cover}

/* video */
.vid{border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow);aspect-ratio:16/9;background:#0b0c0f}
.vid iframe,.vid video{width:100%;height:100%;border:0}
.vid .ph{width:100%;height:100%}

/* faq */
.faq{max-width:820px}
.faq details{border-bottom:1px solid var(--c-line)}
.faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 0;font-weight:700;font-size:18px;color:var(--c-accent)}
.faq summary::-webkit-details-marker{display:none}
.faq summary .ic{width:22px;height:22px;transition:transform .25s;color:var(--c-muted)}
.faq details[open] summary .ic{transform:rotate(180deg)}
.faq details p{padding:0 0 22px;color:var(--c-muted);max-width:64ch}
.qcols{display:grid;gap:30px 48px}
@media(min-width:768px){.qcols{grid-template-columns:repeat(2,1fr)}}
.qcols h3{font-size:18.5px;font-weight:700;margin-bottom:8px}
.qcols p{color:var(--c-muted)}

/* cta */
.band{background:var(--c-accent);color:var(--c-on-accent);border-radius:var(--r-lg);padding:clamp(36px,6vw,72px);display:grid;gap:28px;align-items:center;position:relative;overflow:hidden}
@media(min-width:900px){.band{grid-template-columns:1.4fr auto}}
.band h2{color:var(--c-on-accent);font-size:clamp(30px,4vw,48px);font-weight:800;max-width:18ch}
.band p{color:color-mix(in srgb,var(--c-on-accent) 80%,transparent);margin-top:12px;font-size:18px;max-width:48ch}
.band::after{content:"";position:absolute;right:-80px;top:-80px;width:260px;height:260px;border-radius:999px;background:var(--c-primary);opacity:.22}
.band>*{position:relative;z-index:1}
.ccard{display:grid;gap:0;background:var(--c-surface);border-radius:var(--r-lg);overflow:hidden;box-shadow:var(--shadow)}
@media(min-width:900px){.ccard{grid-template-columns:1fr 1fr}}
.ccard .cbody{padding:clamp(30px,5vw,56px);display:flex;flex-direction:column;justify-content:center;gap:12px}
.ccard h2{font-size:clamp(28px,3.4vw,42px);font-weight:800}
.ccard p{color:var(--c-muted);font-size:18px}
.ccard .btn{align-self:flex-start;margin-top:14px}
.ccard img,.ccard .ph{width:100%;height:100%;min-height:260px;object-fit:cover}

/* contact */
.contact{display:grid;gap:28px;background:var(--c-surface);border-radius:var(--r-lg);padding:clamp(28px,5vw,52px);box-shadow:var(--shadow)}
@media(min-width:900px){.contact{grid-template-columns:1fr 1fr;align-items:center}}
.contact dl{margin:0;display:grid;gap:18px}
.contact dl div{display:flex;gap:14px}
.contact dt .ic{width:22px;height:22px;color:var(--c-primary);margin-top:3px}
.contact dd{margin:0}
.contact dd small{display:block;font-size:13px;color:var(--c-muted);font-weight:600}
.contact dd a{text-decoration:none;font-weight:600}
.wa-card{background:var(--c-tint);border-radius:var(--r);padding:28px;display:flex;flex-direction:column;gap:14px;align-items:flex-start}
.wa-card .ic-wa{width:44px;height:44px;border-radius:999px;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center}
.wa-card .ic-wa .ic{width:26px;height:26px}
.wa-card p{font-size:16px;color:var(--c-muted)}

/* footer */
.ftr{padding:40px 0 48px;border-top:1px solid var(--c-line);margin-top:24px;font-size:15px;color:var(--c-muted)}
.ftr-in{display:flex;flex-wrap:wrap;gap:16px 28px;align-items:center;justify-content:space-between}
.ftr nav{display:flex;flex-wrap:wrap;gap:20px}
.ftr a{text-decoration:none}.ftr a:hover{color:var(--c-accent)}

/* floating WhatsApp button (phones) */
.wa-float{position:fixed;right:16px;bottom:16px;z-index:30;width:58px;height:58px;border-radius:999px;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px -8px rgba(0,0,0,.4);transition:transform .2s}
.wa-float .ic{width:30px;height:30px}
.wa-float:hover{transform:scale(1.06)}
@media(min-width:900px){.wa-float{display:none}}

/* reveal on scroll */
@media(prefers-reduced-motion:no-preference){
.js .rv{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--i,0)*70ms)}
.js .rv.in{opacity:1;transform:none}
}

/* editor-only affordances */
.editing [data-edit]{outline:1px dashed transparent;outline-offset:3px;border-radius:4px;cursor:text;transition:outline-color .15s}
.editing [data-edit]:hover{outline-color:color-mix(in srgb,var(--c-primary) 70%,transparent)}
.editing [data-edit][contenteditable=true]{outline:2px solid var(--c-primary);cursor:text}
.editing [data-section-id]{position:relative}
.editing [data-section-id].sel{box-shadow:inset 0 0 0 2px var(--c-primary)}
.editing .rv,.still .rv{opacity:1!important;transform:none!important;transition:none!important}
.editing .empty{opacity:.42;font-style:italic}
`;
