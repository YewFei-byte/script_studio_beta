// HTML for each section type. Pure functions: (section, ctx) -> string.
// ctx = { page, lang, editor, index } — see render.js.
//
// Every visible string goes through T(), which escapes it, writes both
// languages as data-en / data-zh (the page's EN/中文 switch swaps them) and,
// in the editor, a data-edit="path" so it can be clicked and edited.

import { icon } from './icons.js';
import { tx, isEmptyText } from './schema.js';
import { whatsappLink } from '../brand.js';
import { styleTarget, textStyleCss } from './textStyle.js';

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Only http(s)/mailto/tel/wa.me/#anchor URLs ever reach an href or src.
export function safeUrl(url) {
  const u = String(url || '').trim();
  if (/^(https?:|mailto:|tel:)/i.test(u) || u.startsWith('#') || u.startsWith('/')) return u;
  return '';
}

// One bilingual text element. Empty text renders nothing on the published
// page, but stays as a faint "Add …" slot in the editor so it can be filled.
export function T(value, path, ctx, { tag = 'span', cls = '', attrs = '', placeholder = '' } = {}) {
  const empty = isEmptyText(value);
  if (empty && !ctx.editor) return '';
  const en = tx(value, 'en');
  const zh = typeof value === 'object' && value ? value.zh || '' : '';
  const shown = empty ? placeholder : tx(value, ctx.lang);
  const data = ` data-en="${esc(en)}"${zh ? ` data-zh="${esc(zh)}"` : ''}`;
  const edit = ctx.editor ? ` data-edit="${esc(path)}"${empty ? ` data-empty="1"` : ''}` : '';
  const classes = [cls, empty ? 'empty' : ''].filter(Boolean).join(' ');
  const css = textStyleCss(String(path).startsWith('sections.') ? ctx.section?.styles?.[styleTarget(path).key] : ctx.page?.styles?.[path]);
  const style = css ? ` style="${esc(css)}"` : '';
  return `<${tag}${classes ? ` class="${classes}"` : ''}${data}${edit}${style}${attrs ? ` ${attrs}` : ''}>${esc(shown)}</${tag}>`;
}

const plainText = (value, lang) => esc(tx(value, lang));

// An image slot: the picture when there is one, otherwise a brand-tinted
// placeholder (an "Add photo" target in the editor).
export function img(image, path, ctx, { cls = '', eager = false, sizes = '' } = {}) {
  const url = safeUrl(image?.url);
  const editAttr = ctx.editor ? ` data-edit-img="${esc(path)}"` : '';
  if (url) {
    const alt = tx(image.alt, ctx.lang);
    return `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${sizes ? ` sizes="${sizes}"` : ''}${editAttr}>`;
  }
  if (ctx.editor) return `<div class="ph ph-edit ${cls}"${editAttr}>${icon('photo')}<span>Add photo</span></div>`;
  return `<div class="ph ${cls}" aria-hidden="true">${icon('photo')}</div>`;
}

export function waHref(page, lang) {
  return whatsappLink(page.whatsapp?.number, tx(page.whatsapp?.message, lang)) || '#contact';
}

// The page's single call-to-action: always WhatsApp, same label everywhere.
export function ctaButton(ctx, { cls = 'btn btn-primary', withIcon = true } = {}) {
  const { page, lang } = ctx;
  const en = waHref(page, 'en');
  const zh = waHref(page, 'zh');
  const external = en.startsWith('http');
  return `<a class="${cls}" href="${esc(lang === 'zh' ? zh : en)}" data-wa-en="${esc(en)}" data-wa-zh="${esc(zh)}" data-track="whatsapp"${external ? ' target="_blank" rel="noopener"' : ''}>${withIcon ? icon('brand-whatsapp') : ''}${T(page.cta?.label, 'cta.label', ctx, { placeholder: 'Button text' })}</a>`;
}

const open = (s, ctx, cls, id) =>
  `<section class="${cls}"${id ? ` id="${id}"` : ''}${ctx.editor ? ` data-section-id="${esc(s.id)}"` : ''}>`;

const head = (c, base, ctx, { center = false, intro = 'intro' } = {}) => {
  const lead = c[intro] !== undefined ? T(c[intro], `${base}.${intro}`, ctx, { tag: 'p', cls: 'lead', placeholder: 'Add a short intro (optional)' }) : '';
  return `<div class="head${center ? ' center' : ''} rv">${T(c.title, `${base}.title`, ctx, { tag: 'h2', cls: 'h2', placeholder: 'Section title' })}${lead}</div>`;
};

const initials = (name) =>
  String(name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// --- section renderers ---------------------------------------------------------

function hero(s, ctx, base) {
  const c = s.content;
  const text = `${T(c.eyebrow, `${base}.eyebrow`, ctx, { cls: 'eyebrow', placeholder: 'Small label (optional)' })}
${T(c.title, `${base}.title`, ctx, { tag: 'h1', cls: 'h1', placeholder: 'Your headline' })}
${T(c.subtitle, `${base}.subtitle`, ctx, { tag: 'p', cls: 'lead', placeholder: 'One sentence about what you offer' })}
<div class="cta-row">${ctaButton(ctx)}</div>`;

  if (s.variant === 'cover') {
    return `${open(s, ctx, 'hero hero-cover')}${img(c.image, `${base}.image`, ctx, { eager: true })}<div class="wrap">${text}</div></section>`;
  }
  if (s.variant === 'centered') {
    return `${open(s, ctx, 'hero hero-centered')}<div class="wrap"><div class="rv">${text}</div><div class="hero-media rv" style="--i:2">${img(c.image, `${base}.image`, ctx, { eager: true })}</div></div></section>`;
  }
  return `${open(s, ctx, 'hero')}<div class="wrap hero-split"><div class="rv">${text}</div><div class="hero-media rv" style="--i:2">${img(c.image, `${base}.image`, ctx, { eager: true })}</div></div></section>`;
}

// Bento spans per item count: always exactly one cell per item.
const BENTO = {
  1: [['s6', 'big']],
  2: [['s3', 'big'], ['s3', '']],
  3: [['s4 tall', 'big'], ['s2', ''], ['s2', 'tint']],
  4: [['s4 tall', 'big'], ['s2', ''], ['s2', 'tint'], ['s6', '']],
  5: [['s4 tall', 'big'], ['s2', ''], ['s2', 'tint'], ['s3', 'tint'], ['s3', '']],
  6: [['s4 tall', 'big'], ['s2', ''], ['s2', 'tint'], ['s2', ''], ['s2', 'tint'], ['s2', '']],
};

function features(s, ctx, base, cls) {
  const c = s.content;
  const items = (c.items || []).slice(0, 6);
  let body;
  if (s.variant === 'list') {
    body = `<div class="flist">${items.map((it, i) => `<div class="fitem rv" style="--i:${i}"><span class="ib">${icon(it.icon)}</span><div>${T(it.title, `${base}.items.${i}.title`, ctx, { tag: 'h3' })}${T(it.text, `${base}.items.${i}.text`, ctx, { tag: 'p' })}</div></div>`).join('')}</div>`;
  } else {
    const spans = BENTO[items.length] || BENTO[6];
    body = `<div class="bento">${items.map((it, i) => {
      const [span, look] = spans[i];
      return `<div class="tile ${span} ${look} rv" style="--i:${i}">${icon(it.icon)}${T(it.title, `${base}.items.${i}.title`, ctx, { tag: 'h3' })}${T(it.text, `${base}.items.${i}.text`, ctx, { tag: 'p' })}</div>`;
    }).join('')}</div>`;
  }
  return `${open(s, ctx, cls, ctx.anchor)}<div class="wrap">${head(c, base, ctx)}${body}</div></section>`;
}

function steps(s, ctx, base, cls) {
  const c = s.content;
  const items = (c.items || []).slice(0, 5);
  const variant = s.variant === 'timeline' ? 'timeline' : 'row';
  return `${open(s, ctx, cls, ctx.anchor)}<div class="wrap">${head(c, base, ctx, { intro: null })}<ol class="steps ${variant}" style="--n:${items.length};list-style:none;margin:0;padding:0">${items
    .map((it, i) => `<li class="step rv" style="--i:${i}">${T(it.title, `${base}.items.${i}.title`, ctx, { tag: 'h3' })}${T(it.text, `${base}.items.${i}.text`, ctx, { tag: 'p' })}</li>`)
    .join('')}</ol></div></section>`;
}

function pricing(s, ctx, base, cls) {
  const c = s.content;
  const plans = (c.plans || []).slice(0, 4);
  let body;
  if (s.variant === 'menu') {
    body = `<div class="menu rv">${plans.map((p, i) => `<div class="mrow${p.highlighted ? ' hl' : ''}"><div class="mt">${T(p.name, `${base}.plans.${i}.name`, ctx, { tag: 'h3' })}${T(p.period, `${base}.plans.${i}.period`, ctx, { tag: 'p' })}</div><span class="price"${ctx.editor ? ` data-edit="${base}.plans.${i}.price" data-plain="1"` : ''}>${esc(p.price)}</span></div>`).join('')}</div>`;
  } else {
    body = `<div class="tiers" style="--n:${plans.length}">${plans
      .map(
        (p, i) => `<div class="tier${p.highlighted ? ' hl' : ''} rv" style="--i:${i}">${p.highlighted ? `<span class="tag" data-en="Most popular" data-zh="最受欢迎">${ctx.lang === 'zh' ? '最受欢迎' : 'Most popular'}</span>` : ''}${T(p.name, `${base}.plans.${i}.name`, ctx, { tag: 'h3' })}<div class="price"${ctx.editor ? ` data-edit="${base}.plans.${i}.price" data-plain="1"` : ''}>${esc(p.price)}</div>${T(p.period, `${base}.plans.${i}.period`, ctx, { cls: 'per' })}<ul>${(p.features || [])
          .slice(0, 6)
          .map((f, j) => `<li>${icon('check')}${T(f, `${base}.plans.${i}.features.${j}`, ctx)}</li>`)
          .join('')}</ul>${ctaButton(ctx, { cls: p.highlighted ? 'btn btn-primary' : 'btn btn-ghost', withIcon: false })}</div>`
      )
      .join('')}</div>`;
  }
  return `${open(s, ctx, cls, ctx.anchor)}<div class="wrap">${head(c, base, ctx)}${body}</div></section>`;
}

function who(it, base, i, ctx) {
  return `<div class="who"><span class="av" aria-hidden="true">${esc(initials(it.name))}</span><div><b${ctx.editor ? ` data-edit="${base}.items.${i}.name" data-plain="1"` : ''}>${esc(it.name)}</b>${T(it.role, `${base}.items.${i}.role`, ctx)}</div></div>`;
}

function testimonials(s, ctx, base, cls) {
  const c = s.content;
  const items = (c.items || []).slice(0, 4);
  if (s.variant === 'spotlight' && items.length) {
    const [first, ...rest] = items;
    return `${open(s, ctx, cls, ctx.anchor)}<div class="wrap"><figure class="spot rv" style="margin:0">${T(first.quote, `${base}.items.0.quote`, ctx, { tag: 'blockquote' })}${who(first, base, 0, ctx)}</figure>${
      rest.length
        ? `<div class="spot-more">${rest.map((it, k) => `<figure class="qcard rv" style="--i:${k};margin:0">${T(it.quote, `${base}.items.${k + 1}.quote`, ctx, { tag: 'blockquote' })}${who(it, base, k + 1, ctx)}</figure>`).join('')}</div>`
        : ''
    }</div></section>`;
  }
  return `${open(s, ctx, cls, ctx.anchor)}<div class="wrap">${head(c, base, ctx, { intro: null })}<div class="quotes" style="--n:${Math.min(items.length, 3)}">${items
    .map((it, i) => `<figure class="qcard rv" style="--i:${i};margin:0">${T(it.quote, `${base}.items.${i}.quote`, ctx, { tag: 'blockquote' })}${who(it, base, i, ctx)}</figure>`)
    .join('')}</div></div></section>`;
}

function gallery(s, ctx, base, cls) {
  const c = s.content;
  let images = (c.images || []).slice(0, 10);
  if (!images.length && ctx.editor) images = [null, null, null];
  if (!images.length) return '';
  const fig = (im, i) => `<figure class="rv" style="--i:${i}">${img(im, `${base}.images.${i}`, ctx)}</figure>`;
  const layout = s.variant === 'strip' ? 'strip' : 'mosaic';
  return `${open(s, ctx, cls, ctx.anchor)}<div class="wrap">${head(c, base, ctx, { intro: null })}<div class="${layout}">${images.map(fig).join('')}</div></div></section>`;
}

// YouTube / Vimeo links become privacy-friendly embeds; anything else is
// treated as a direct video file.
export function videoEmbed(url) {
  const u = safeUrl(url);
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm[1]}` };
  return { kind: 'video', src: u };
}

function video(s, ctx, base, cls) {
  const c = s.content;
  const v = videoEmbed(c.url);
  if (!v && !ctx.editor) return '';
  const editAttr = ctx.editor ? ` data-edit-video="${base}.url"` : '';
  const player = !v
    ? `<div class="ph ph-edit"${editAttr}>${icon('player-play')}<span>Paste a YouTube or Vimeo link</span></div>`
    : v.kind === 'iframe'
      ? `<iframe src="${esc(v.src)}" title="${plainText(c.title, ctx.lang)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen${editAttr}></iframe>`
      : `<video src="${esc(v.src)}" controls preload="metadata" playsinline${editAttr}></video>`;
  return `${open(s, ctx, cls, ctx.anchor)}<div class="wrap">${head(c, base, ctx, { intro: 'text' })}<div class="vid rv">${player}</div></div></section>`;
}

function faq(s, ctx, base, cls) {
  const c = s.content;
  const items = (c.items || []).slice(0, 10);
  const body =
    s.variant === 'columns'
      ? `<div class="qcols">${items.map((it, i) => `<div class="rv" style="--i:${i % 4}">${T(it.q, `${base}.items.${i}.q`, ctx, { tag: 'h3' })}${T(it.a, `${base}.items.${i}.a`, ctx, { tag: 'p' })}</div>`).join('')}</div>`
      : `<div class="faq rv">${items
          .map((it, i) => `<details${ctx.editor ? ' open' : ''}><summary>${T(it.q, `${base}.items.${i}.q`, ctx)}${icon('chevron-down')}</summary>${T(it.a, `${base}.items.${i}.a`, ctx, { tag: 'p' })}</details>`)
          .join('')}</div>`;
  return `${open(s, ctx, cls, ctx.anchor)}<div class="wrap">${head(c, base, ctx, { intro: null })}${body}</div></section>`;
}

function cta(s, ctx, base) {
  const c = s.content;
  const title = T(c.title, `${base}.title`, ctx, { tag: 'h2', placeholder: 'A final push' });
  const text = T(c.text, `${base}.text`, ctx, { tag: 'p', placeholder: 'One reassuring line (optional)' });
  if (s.variant === 'card') {
    return `${open(s, ctx, 'sec sec-tight', ctx.anchor)}<div class="wrap"><div class="ccard rv"><div class="cbody">${title}${text}${ctaButton(ctx)}</div>${img(c.image, `${base}.image`, ctx)}</div></div></section>`;
  }
  return `${open(s, ctx, 'sec sec-tight', ctx.anchor)}<div class="wrap"><div class="band rv"><div>${title}${text}</div><div>${ctaButton(ctx)}</div></div></div></section>`;
}

function contact(s, ctx, base) {
  const c = s.content;
  const row = (ic, label, value) => (value ? `<div>${`<dt>${icon(ic)}</dt>`}<dd><small>${label}</small>${value}</dd></div>` : '');
  const lbl = (en, zh) => `<span data-en="${en}" data-zh="${zh}">${ctx.lang === 'zh' ? zh : en}</span>`;
  const edit = (path) => (ctx.editor ? ` data-edit="${path}" data-plain="1"` : '');
  const tel = String(c.phone || '').replace(/[^\d+]/g, '');
  const details = [
    row('map-pin', lbl('Address', '地址'), T(c.address, `${base}.address`, ctx, { placeholder: 'Add your address' })),
    row('clock', lbl('Opening hours', '营业时间'), T(c.hours, `${base}.hours`, ctx, { placeholder: 'Add opening hours' })),
    row('phone', lbl('Phone', '电话'), c.phone || ctx.editor ? `<a href="tel:${esc(tel)}"${edit(`${base}.phone`)}>${esc(c.phone || (ctx.editor ? 'Add phone' : ''))}</a>` : ''),
    row('mail', lbl('Email', '电邮'), c.email || ctx.editor ? `<a href="mailto:${esc(c.email)}"${edit(`${base}.email`)}>${esc(c.email || (ctx.editor ? 'Add email' : ''))}</a>` : ''),
  ].join('');
  const map = safeUrl(c.mapUrl) ? `<a href="${esc(safeUrl(c.mapUrl))}" target="_blank" rel="noopener" class="btn btn-ghost" style="margin-top:6px">${icon('map-pin')}<span data-en="Get directions" data-zh="导航">${ctx.lang === 'zh' ? '导航' : 'Get directions'}</span></a>` : '';
  return `${open(s, ctx, 'sec sec-tight', ctx.anchor)}<div class="wrap"><div class="contact rv"><div>${T(c.title, `${base}.title`, ctx, { tag: 'h2', cls: 'h2', placeholder: 'Contact' })}${T(c.text, `${base}.text`, ctx, { tag: 'p', cls: 'lead', placeholder: 'Add a short line (optional)' })}<dl style="margin-top:28px">${details}</dl>${map}</div><div class="wa-card"><span class="ic-wa">${icon('brand-whatsapp')}</span><p><span data-en="Fastest reply on WhatsApp" data-zh="WhatsApp 回复最快">${ctx.lang === 'zh' ? 'WhatsApp 回复最快' : 'Fastest reply on WhatsApp'}</span></p>${ctaButton(ctx)}</div></div></div></section>`;
}

export const RENDERERS = { hero, features, steps, pricing, testimonials, gallery, video, faq, cta, contact };
