import React, { useState } from 'react';
import ContentGrid from '../components/ContentGrid';
import SearchSortBar from '../components/SearchSortBar';
import FilterSelect from '../components/FilterSelect';
import { SORT_OPTIONS, STATUS_OPTIONS, filterContent, sortContent } from '../utils/contentFilters';

export default function LandingPagePage({ content, branches, siteStats = {}, onPreview, onPublishClick, onModify, onUnpublish, onPublishNow, onRegenerate, onDuplicate, onDeleteMany }) {
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('modified-desc');

  const landingPages = content.filter((c) => c.kind === 'landing');
  const sorted = sortContent(filterContent(landingPages, { branch: branchFilter, status: statusFilter, search }), sortBy);
  const handlers = { onPreview, onPublishClick, onModify, onUnpublish, onPublishNow, onRegenerate };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '10px 24px 80px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, marginBottom: 4 }}>Landing Page</h1>
        <p style={{ color: 'var(--ink-500)', fontSize: 14 }}>All generated landing pages.</p>
      </div>

      <SearchSortBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search landing pages by name or product…"
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOptions={SORT_OPTIONS}
      >
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} allLabel="Any status" />
        <FilterSelect value={branchFilter} onChange={setBranchFilter} options={branches || []} allLabel="All branches" />
      </SearchSortBar>

      <ContentGrid items={sorted} stats={siteStats} handlers={handlers} onDuplicate={onDuplicate} onDeleteMany={onDeleteMany}
        resetKey={`${branchFilter}|${statusFilter}|${search}|${sortBy}`}
        emptyText={landingPages.length === 0 ? 'No landing pages generated yet.' : 'No landing pages match your search.'} />
    </div>
  );
}
