// Wraps a generated landing page's fragments ({ html, css, js } -- body
// content, a stylesheet body, a script body) into one full HTML document.
// Plain ESM with no browser or Node APIs, so the same builder is used by the
// browser preview (ContentPreview.jsx), the browser Download zip
// (src/utils/landingZip.js) and the server's Netlify zip (server/landing.js)
// -- all three render the exact same page.
//
// - inline: true  -> CSS/JS inlined in <style>/<script> (iframe srcDoc preview)
// - inline: false -> links style.css / script.js (the hosted/downloaded zip)

// The model is asked for body content only, but it's also told to load
// Google Fonts "in the head" -- so those <link> tags (and the odd <meta> or
// <title>) arrive inside the body fragment. Hoist them into the real <head>,
// where they belong.
const HEAD_TAG_RE = /<(?:link|meta)\b[^>]*>|<title\b[^>]*>[\s\S]*?<\/title>/gi;

function splitFragment(html) {
  let body = html || '';
  let head = '';

  // Occasionally the model ignores "body content only" and returns a whole
  // document. Unwrap it rather than nesting <html> inside <body>.
  const headMatch = body.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) head += headMatch[1];
  const bodyMatch = body.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];
  body = body.replace(/<!doctype[^>]*>|<\/?html\b[^>]*>|<head\b[^>]*>[\s\S]*?<\/head>|<\/?body\b[^>]*>/gi, '');

  body = body.replace(HEAD_TAG_RE, (tag) => {
    head += `\n${tag}`;
    return '';
  });

  // Drop anything the wrapper below already provides.
  head = head
    .replace(/<meta\b[^>]*(?:charset|name=["']viewport["'])[^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/gi, '');
  const hasTitle = /<title\b/i.test(head);

  return { head: head.trim(), body: body.trim(), hasTitle };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Inline <script> content must never contain a literal "</script" or it ends
// the tag early.
function escapeInlineScript(js) {
  return js.replace(/<\/script/gi, '<\\/script');
}

// The page always references ./logo/logo.png and ./logo/favicon.png (the zip
// ships those files). An inline srcDoc preview has no such files, so point
// them straight at the uploaded logo instead when there is one.
function withLogoUrl(doc, logoUrl) {
  if (!logoUrl) return doc;
  return doc.replace(/(?:\.\/)?logo\/(?:logo|favicon)\.png/g, logoUrl);
}

export function buildLandingDocument({ html, css, js } = {}, { inline = false, title = '', logoUrl = '' } = {}) {
  const { head, body, hasTitle } = splitFragment(html);
  const titleTag = !hasTitle && title ? `<title>${escapeHtml(title)}</title>\n` : '';
  const styles = inline ? `<style>${css || ''}</style>` : '<link rel="stylesheet" href="style.css" />';
  const script = inline ? `<script>${escapeInlineScript(js || '')}</script>` : '<script src="script.js"></script>';

  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${titleTag}<link rel="icon" href="./logo/favicon.png" />
${head ? `${head}\n` : ''}${styles}
</head>
<body>
${body}
${script}
</body>
</html>`;
  return inline ? withLogoUrl(doc, logoUrl) : doc;
}
