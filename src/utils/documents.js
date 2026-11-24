// Documents used to be filterable by which platform they were "for"
// (Landing Page / Instagram / Facebook / RedNote) — but that only ever
// meant anything for auto-recorded AI Guidance docs (tagged with the post/
// landing item that spawned them, via relatedItemId), and those are no
// longer shown on the Requirements page at all (see AdminPanel.jsx's
// visibleDocuments). Every real Requirement doc a user uploads is meant to
// be reusable across both post and landing page generation — the same
// product brief or brand guideline informs both — so there's no platform
// to classify it by any more.
//
// There also used to be a separate "Product Info" vs. "Document" (a.k.a.
// "other") split, guessed from the filename (DocumentsPage.jsx's old
// guessDocType). In practice every non-SOP doc uploaded here IS product/
// requirement info for whatever's being generated — there was never a
// real second category to distinguish it from — so that split is gone
// too. Everything that isn't your Marketing SOP (or a hidden AI Guidance
// note) now just reads as "Product Info". A doc uploaded under the old
// system with type 'product' still displays correctly here (see the
// fallback in matchesDocFilter/TYPE_LABEL usage below) — nothing needs
// migrating.
export const TYPE_LABEL = { sop: 'Marketing SOP', guidance: 'AI Guidance' };
export const DEFAULT_TYPE_LABEL = 'Product Info';

export const KIND_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'sop', label: 'Marketing SOP' },
  { id: 'other', label: 'Product Info' },
];

export function matchesDocFilter(doc, filterId) {
  if (filterId === 'all') return true;
  if (filterId === 'sop') return doc.type === 'sop';
  // 'other' (Product Info) — anything that isn't a Marketing SOP or a
  // hidden AI Guidance note, including any pre-existing doc still tagged
  // with the old 'product' type.
  return doc.type !== 'sop' && doc.type !== 'guidance';
}

export const DOC_SORT_OPTIONS = [
  { id: 'modified-desc', label: 'Modified date (newest first)' },
  { id: 'modified-asc', label: 'Modified date (oldest first)' },
  { id: 'name-asc', label: 'Name (A–Z)' },
];

export function sortDocs(docs, sortBy) {
  return [...docs].sort((a, b) => {
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    const diff = new Date(b.uploadedAt) - new Date(a.uploadedAt);
    return sortBy === 'modified-asc' ? -diff : diff;
  });
}
