import JSZip from 'jszip';
import { buildLandingDocument } from '../../shared/landingDocument.js';
import { renderPage } from '../../shared/landing/render.js';

// 1x1 transparent PNG — fallback so ./logo/logo.png and ./logo/favicon.png
// (referenced by the generated HTML) don't 404 when no logo was uploaded.
const PLACEHOLDER_LOGO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUAAdafFsIAAAAASUVORK5CYII=';

async function fetchLogo(logoUrl) {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

// Same zip layout the server deploys to Netlify (server/landing.js), for the
// Download button.
export async function buildLandingZip({ html, css, js } = {}, { page, logoUrl, title } = {}) {
  const zip = new JSZip();
  // Section-based pages are one self-contained index.html.
  if (page?.sections) {
    zip.file('index.html', renderPage(page).html);
    return zip.generateAsync({ type: 'blob' });
  }
  zip.file('index.html', buildLandingDocument({ html, css, js }, { title }));
  zip.file('style.css', css || '');
  zip.file('script.js', js || '');

  const logo = await fetchLogo(logoUrl);
  for (const name of ['logo/logo.png', 'logo/favicon.png']) {
    if (logo) zip.file(name, logo);
    else zip.file(name, PLACEHOLDER_LOGO_BASE64, { base64: true });
  }
  return zip.generateAsync({ type: 'blob' });
}
