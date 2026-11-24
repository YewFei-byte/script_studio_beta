// Filtering and sorting for the Post and Landing Page lists.

export const SORT_OPTIONS = [
  { id: 'modified-desc', label: 'Modified date (newest first)' },
  { id: 'modified-asc', label: 'Modified date (oldest first)' },
  { id: 'name-asc', label: 'Name (A–Z)' },
];

// FilterSelect options are plain strings; each maps to an item status.
export const STATUS_OPTIONS = ['Draft', 'Scheduled', 'Published'];

// Everything a search can match: title, caption, who made it, product name.
const searchText = (c) =>
  [c.title, c.post?.caption, c.creatorName, c.createdByName, c.landing?.productName].filter(Boolean).join(' ').toLowerCase();

export function filterContent(list, { kind = 'all', branch = 'all', status = 'all', search = '' } = {}) {
  const q = search.trim().toLowerCase();
  return list.filter((c) =>
    (kind === 'all' || c.kind === kind)
    && (branch === 'all' || c.branch === branch)
    && (status === 'all' || (c.status || 'draft') === status.toLowerCase())
    && (!q || searchText(c).includes(q)));
}

export function sortContent(list, sortBy) {
  return [...list].sort((a, b) => {
    if (sortBy === 'name-asc') return (a.title || '').localeCompare(b.title || '');
    const diff = new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    return sortBy === 'modified-asc' ? -diff : diff;
  });
}
