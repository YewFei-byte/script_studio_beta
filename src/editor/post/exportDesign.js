import React from 'react';
import { createRoot } from 'react-dom/client';
import { uploadPosterImage } from '../../utils/posterImages';
import PostCanvas from './PostCanvas';

// Renders every page of a design off-screen at full size (e.g. 1080x1350),
// waits for fonts and photos, and returns PNG data: URLs. Used when a post
// is created and when the composer closes, so post.images (what publishing
// to Facebook / Instagram and the preview use) always match the design.

function renderPage(design, pageIndex, brand) {
  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;opacity:0';
    document.body.appendChild(host);
    const root = createRoot(host);
    const stageRef = { current: null };
    let done = false;
    const finish = (fn) => {
      if (done) return;
      done = true;
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new Error('The post took too long to render.'))), 20000);
    const onReady = () => {
      // One more frame so Konva has drawn the loaded fonts and photos.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        clearTimeout(timer);
        try {
          const url = stageRef.current.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
          finish(() => resolve(url));
        } catch {
          finish(() => reject(new Error("This photo can't be exported (it's from another website). Upload it instead.")));
        }
      }));
    };
    root.render(React.createElement(PostCanvas, { design, pageIndex, brand, scale: 1, stageRef, onReady }));
  });
}

export async function exportDesignImages(design, brand) {
  const urls = [];
  for (let i = 0; i < design.pages.length; i += 1) {
    urls.push(await renderPage(design, i, brand));
  }
  return urls;
}

// Exports and uploads -> post.images entries ({ id, img }).
export async function exportAndUpload(design, brand) {
  const dataUrls = await exportDesignImages(design, brand);
  const hosted = await Promise.all(dataUrls.map(uploadPosterImage));
  return hosted.map((img, i) => ({ id: i + 1, img }));
}

// Fingerprint of everything that affects the exported pictures.
export function designHash(design, brand) {
  const s = JSON.stringify([design, brand?.colors, brand?.fontPair, brand?.logoUrl]);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
