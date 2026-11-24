// page JSON -> a complete, self-contained HTML document. The same function
// renders the editor preview (editor: true) and the published site, so what
// people see while editing is exactly what goes live.

import { googleFontsHref, normalizeBrandKit } from '../brand.js';
import { icon } from './icons.js';
import { RUNTIME_JS } from './runtime.js';
import { EDITOR_BRIDGE_JS } from './editorBridge.js';
import { SECTION_TYPES, tx } from './schema.js';
import { RENDERERS, ctaButton, esc, safeUrl, waHref } from './sections.js';
import { BASE_CSS, themeVars } from './styles.js';

// Does any text in the page have a Chinese version? (Decides whether the
// EN / 中文 switch and the Chinese font are included.)
function hasChinese(page) {
  let found = false;
  JSON.stringify(page.sections || [], (key, value) => {
    if (key === 'zh' && typeof value === 'string' && value.trim()) found = true;
    return value;
  });
  return found;
}

// Sections that default to a tinted background, for rhythm. Two tinted
// sections never sit next to each other.
const TINT_BY_DEFAULT = new Set(['steps', 'testimonials', 'gallery']);

function navItems(sections) {
  const seen = new Set();
  const items = [];
  for (const s of sections) {
    const meta = SECTION_TYPES[s.type];
    if (!meta?.nav || seen.has(s.type) || s.hidden) continue;
    seen.add(s.type);
    items.push({ href: `#${s.type}`, label: meta.nav });
  }
  return items.slice(0, 4);
}

function header(page, ctx, nav, bilingual) {
  const brand = page.brand || {};
  const logo = safeUrl(brand.logoUrl);
  const brandMark = logo ? `<img src="${esc(logo)}" alt="${esc(brand.name || '')}">` : `<span>${esc(brand.name || '')}</span>`;
  const links = nav.map((n) => `<a href="${n.href}" data-en="${esc(n.label.en)}" data-zh="${esc(n.label.zh)}">${esc(tx(n.label, ctx.lang))}</a>`).join('');
  const lang = bilingual
    ? `<div class="lang" role="group" aria-label="Language"><button type="button" data-lang="en" class="${ctx.lang === 'en' ? 'on' : ''}">EN</button><button type="button" data-lang="zh" class="${ctx.lang === 'zh' ? 'on' : ''}">中文</button></div>`
    : '';
  return `<div id="top" style="position:absolute;top:0;height:1px;width:1px"></div>
<header class="hdr"><div class="wrap hdr-in"><a class="brand" href="#top">${brandMark}</a><nav class="nav" aria-label="Main">${links}</nav>${lang}${ctaButton(ctx, { cls: 'btn btn-primary' })}${
    nav.length ? `<button class="burger" type="button" aria-label="Menu" aria-expanded="false">${icon('menu-2')}</button>` : ''
  }</div>${nav.length ? `<nav class="mnav" aria-label="Mobile">${links}${ctaButton(ctx)}</nav>` : ''}</header>`;
}

function footer(page, ctx, nav) {
  const name = esc(page.brand?.name || '');
  const links = nav.map((n) => `<a href="${n.href}" data-en="${esc(n.label.en)}" data-zh="${esc(n.label.zh)}">${esc(tx(n.label, ctx.lang))}</a>`).join('');
  return `<footer class="ftr"><div class="wrap ftr-in"><span>© ${new Date().getFullYear()} ${name}</span><nav aria-label="Footer">${links}</nav></div></footer>`;
}

// Fill in defaults so partial pages (mid-generation, older versions) render.
export function normalizePage(page, brandKit) {
  const kit = normalizeBrandKit(brandKit);
  const p = page && typeof page === 'object' ? page : {};
  return {
    version: 1,
    ...p,
    theme: { fontPair: kit.fontPair, radius: 'soft', ...(p.theme || {}), colors: { ...kit.colors, ...(p.theme?.colors || {}) } },
    brand: { name: kit.companyName, logoUrl: kit.logoUrl, ...(p.brand || {}) },
    cta: p.cta || { label: { en: 'Chat on WhatsApp', zh: 'WhatsApp 咨询' } },
    whatsapp: { number: kit.whatsapp.number, message: { en: kit.whatsapp.message, zh: '' }, ...(p.whatsapp || {}) },
    sections: Array.isArray(p.sections) ? p.sections : [],
  };
}

// Returns { html, title }. Options:
//   lang     'en' | 'zh'  — language shown first
//   editor   true adds click-to-edit hooks and "Add …" placeholders
//   trackUrl hosted pages: where view / WhatsApp-click beacons go
//   still    no entrance animations (thumbnails)
export function renderPage(rawPage, { lang = 'en', editor = false, trackUrl = '', still = false } = {}) {
  const page = normalizePage(rawPage);
  const bilingual = editor || hasChinese(page);
  const visible = page.sections.filter((s) => !s.hidden && RENDERERS[s.type]);
  const nav = navItems(visible);
  const { css: vars } = themeVars(page.theme);
  const ctx = { page, lang, editor };

  const anchored = new Set();
  let prevTinted = false;
  const body = visible
    .map((s, i) => {
      const base = `sections.${page.sections.indexOf(s)}.content`;
      const wantTint = s.bg ? s.bg === 'tint' : TINT_BY_DEFAULT.has(s.type);
      const tinted = wantTint && !prevTinted && s.type !== 'hero' && s.type !== 'cta';
      prevTinted = tinted;
      const anchor = anchored.has(s.type) ? '' : s.type;
      anchored.add(s.type);
      return RENDERERS[s.type](s, { ...ctx, anchor, index: i, section: s }, base, tinted ? 'sec sec-tint' : 'sec');
    })
    .join('\n');

  const hero = visible.find((s) => s.type === 'hero');
  const title = [page.brand?.name, tx(hero?.content?.title, lang)].filter(Boolean).join(' | ') || 'Landing page';
  const description = tx(hero?.content?.subtitle, lang);
  const ogImage = safeUrl(hero?.content?.image?.url);
  const logo = safeUrl(page.brand?.logoUrl);
  const fonts = googleFontsHref(page.theme.fontPair, { withChinese: bilingual });

  const html = `<!doctype html>
<html lang="${lang === 'zh' ? 'zh-Hans' : 'en'}" data-lang="${lang}"${editor ? ' class="editing"' : still ? ' class="still"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<meta property="og:title" content="${esc(title)}">
${description ? `<meta property="og:description" content="${esc(description)}">` : ''}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
${logo ? `<link rel="icon" href="${esc(logo)}">` : ''}
<meta name="theme-color" content="${esc(page.theme.colors.bg)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(fonts)}">
<style>${vars}${BASE_CSS}</style>
</head>
<body>
${header(page, ctx, nav, bilingual)}
<main>
${body || (editor ? '<section class="sec"><div class="wrap"><p class="lead">This page has no sections yet. Add one from the left.</p></div></section>' : '')}
</main>
${footer(page, ctx, nav)}
<a class="wa-float" href="${esc(waHref(page, lang))}" data-wa-en="${esc(waHref(page, 'en'))}" data-wa-zh="${esc(waHref(page, 'zh'))}" data-track="whatsapp" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('brand-whatsapp')}</a>
${trackUrl ? `<script>window.SS_TRACK_URL=${JSON.stringify(trackUrl)}</script>` : ''}
<script>${RUNTIME_JS}</script>${editor ? `
<script>${EDITOR_BRIDGE_JS}</script>` : ''}
</body>
</html>`;
  return { html, title };
}

