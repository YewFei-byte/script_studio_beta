// Pure edits on a landing page object (shared/landing/schema.js). Each takes
// a page and returns a new one; nothing is mutated, so undo/redo is just
// keeping old pages around.

import { createSection, newSectionId } from '../../../shared/landing/schema.js';

const clone = (v) => structuredClone(v);

const parsePath = (path) => String(path).split('.').map((k) => (/^\d+$/.test(k) ? Number(k) : k));

export function getAtPath(obj, path) {
  return parsePath(path).reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setAtPath(obj, path, value) {
  const keys = parsePath(path);
  const next = clone(obj);
  let o = next;
  keys.slice(0, -1).forEach((k, i) => {
    if (o[k] == null) o[k] = typeof keys[i + 1] === 'number' ? [] : {};
    o = o[k];
  });
  o[keys[keys.length - 1]] = value;
  return next;
}

// Text edits: bilingual fields ({en, zh}) get just one language replaced;
// plain string fields (prices, names, phone) are replaced as-is.
export function setText(page, path, lang, value, plain = false) {
  const current = getAtPath(page, path);
  if (plain || typeof current === 'string') return setAtPath(page, path, value);
  return setAtPath(page, path, { en: '', zh: '', ...(current || {}), [lang]: value });
}

const sectionIndex = (page, id) => page.sections.findIndex((s) => s.id === id);

export function moveSection(page, id, delta) {
  const i = sectionIndex(page, id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= page.sections.length) return page;
  const sections = [...page.sections];
  [sections[i], sections[j]] = [sections[j], sections[i]];
  return { ...page, sections };
}

export function reorderSections(page, ids) {
  const byId = new Map(page.sections.map((s) => [s.id, s]));
  return { ...page, sections: ids.map((id) => byId.get(id)).filter(Boolean) };
}

export function duplicateSection(page, id) {
  const i = sectionIndex(page, id);
  if (i < 0) return page;
  const copy = { ...clone(page.sections[i]), id: newSectionId(page.sections[i].type) };
  const sections = [...page.sections];
  sections.splice(i + 1, 0, copy);
  return { ...page, sections };
}

export function removeSection(page, id) {
  return { ...page, sections: page.sections.filter((s) => s.id !== id) };
}

// Inserts after `afterId` (or at the end), keeping the contact section last
// when adding to the end.
export function addSection(page, type, afterId) {
  const section = createSection(type);
  const sections = [...page.sections];
  let at = afterId ? sectionIndex(page, afterId) + 1 : sections.length;
  if (!afterId && sections[sections.length - 1]?.type === 'contact' && type !== 'contact') at = sections.length - 1;
  sections.splice(at, 0, section);
  return { page: { ...page, sections }, id: section.id };
}

export function updateSection(page, id, patch) {
  return { ...page, sections: page.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function updateSectionContent(page, id, patch) {
  return { ...page, sections: page.sections.map((s) => (s.id === id ? { ...s, content: { ...s.content, ...patch } } : s)) };
}

// Lists inside a section (features.items, faq.items, pricing.plans, gallery.images…).
export function addListItem(page, id, key, item) {
  const s = page.sections.find((x) => x.id === id);
  return updateSectionContent(page, id, { [key]: [...(s?.content?.[key] || []), item] });
}

export function removeListItem(page, id, key, index) {
  const s = page.sections.find((x) => x.id === id);
  return updateSectionContent(page, id, { [key]: (s?.content?.[key] || []).filter((_, i) => i !== index) });
}

export function moveListItem(page, id, key, index, delta) {
  const s = page.sections.find((x) => x.id === id);
  const list = [...(s?.content?.[key] || [])];
  const j = index + delta;
  if (j < 0 || j >= list.length) return page;
  [list[index], list[j]] = [list[j], list[index]];
  return updateSectionContent(page, id, { [key]: list });
}

export function setTheme(page, patch) {
  return { ...page, theme: { ...page.theme, ...patch, colors: { ...page.theme?.colors, ...(patch.colors || {}) } } };
}
