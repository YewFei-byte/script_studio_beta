import React, { useState } from 'react';
import { Upload, CalendarDays } from 'lucide-react';
import ContentGrid from '../components/ContentGrid';
import SearchSortBar from '../components/SearchSortBar';
import FilterSelect from '../components/FilterSelect';
import { GlassPill, GlassButton } from '../components/Glass';
import UploadPostModal from '../components/UploadPostModal';
import PostCalendarModal from '../components/PostCalendarModal';
import { platformMeta } from '../data/mockData';
import { SORT_OPTIONS, STATUS_OPTIONS, filterContent, sortContent } from '../utils/contentFilters';

const POST_FILTERS = [{ id: 'all', label: 'All' }, ...Object.entries(platformMeta).map(([id, meta]) => ({ id, label: meta.label }))];

export default function PostPage({ content, branches, onPreview, onPublishClick, onModify, onUnpublish, onPublishNow, onRegenerate, onDuplicate, onDeleteMany, onUploadPost }) {
  const [filter, setFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('modified-desc');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const posts = content.filter((c) => c.kind !== 'landing');
  const sorted = sortContent(filterContent(posts, { kind: filter, branch: branchFilter, status: statusFilter, search }), sortBy);
  const handlers = { onPreview, onPublishClick, onModify, onUnpublish, onPublishNow, onRegenerate };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '10px 24px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 30, marginBottom: 4 }}>Post</h1>
          <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>All generated social posts + copywriting.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <GlassButton variant="ghost" icon={CalendarDays} style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setCalendarOpen(true)}>
            Calendar
          </GlassButton>
          <GlassButton variant="primary" icon={Upload} style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => setUploadOpen(true)}>
            Upload
          </GlassButton>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {POST_FILTERS.map((f) => (
          <GlassPill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </GlassPill>
        ))}
      </div>

      <SearchSortBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search posts by title, caption or creator…"
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOptions={SORT_OPTIONS}
      >
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} allLabel="Any status" />
        <FilterSelect value={branchFilter} onChange={setBranchFilter} options={branches || []} allLabel="All branches" />
      </SearchSortBar>

      <ContentGrid items={sorted} handlers={handlers} onDuplicate={onDuplicate} onDeleteMany={onDeleteMany}
        resetKey={`${filter}|${branchFilter}|${statusFilter}|${search}|${sortBy}`}
        emptyText={posts.length ? 'No posts match this filter.' : 'No posts yet. Generate one, or upload your own.'} />

      {uploadOpen && (
        <UploadPostModal
          onClose={() => setUploadOpen(false)}
          onUpload={(item) => onUploadPost?.(item)}
        />
      )}

      {calendarOpen && <PostCalendarModal content={content} onClose={() => setCalendarOpen(false)} />}
    </div>
  );
}
