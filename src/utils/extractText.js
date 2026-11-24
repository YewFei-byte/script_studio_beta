// Real text extraction for uploaded documents, so the "Marketing SOP" (or any
// other requirement doc) actually informs generation instead of just being a
// filename shown in a list.
//
// Supported today: .txt (trivial) and .pdf (via pdfjs-dist, entirely in the
// browser — no server needed). .doc/.docx aren't parsed yet — those still
// upload fine, they just won't contribute real extracted content until a
// docx parser is added.

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_CHARS = 12000; // keep prompts reasonably sized

async function extractPdfText(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => it.str).join(' ') + '\n';
    if (text.length > MAX_CHARS) break;
  }
  return text.trim();
}

async function extractPlainText(file) {
  return await file.text();
}

// Returns { content, error }. content is '' (not null) when extraction isn't
// supported for this file type yet, so callers can treat it uniformly.
export async function extractDocumentText(file) {
  try {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf')) {
      return { content: (await extractPdfText(file)).slice(0, MAX_CHARS), error: null };
    }
    if (name.endsWith('.txt') || name.endsWith('.md')) {
      return { content: (await extractPlainText(file)).slice(0, MAX_CHARS), error: null };
    }
    return { content: '', error: `Content extraction isn't supported yet for "${file.name}" — only .pdf and .txt are read so far.` };
  } catch (err) {
    return { content: '', error: err.message || `Could not read "${file.name}".` };
  }
}
