// Every platform starts disconnected. `connected: true` only ever gets set
// once real credentials are actually saved (Facebook: Page ID + Page Access
// Token; Instagram: an Instagram Business Account ID, reusing Facebook's
// token; YouTube: OAuth Client ID/Secret + Refresh Token) — see
// SocialMediaPage.jsx. Facebook and Instagram used to be hardcoded to
// `connected: true` here even with nothing behind them, which made a fresh
// deploy misleadingly show them as already connected.
export const initialProfile = {
  username: 'admin',
  domain: 'yourcompany.com',
  socials: [
    { id: 'fb', name: 'Facebook', connected: false },
    { id: 'ig', name: 'Instagram', connected: false },
    { id: 'xhs', name: 'RedNote (XHS)', connected: false },
    { id: 'yt', name: 'YouTube', connected: false },
  ],
};

export const styleOptions = ['Minimalist', 'Modern', 'Compact', 'Bold', 'Playful'];
export const toneOptions = ['Professional', 'Friendly', 'Playful', 'Premium'];
export const goalOptions = ['Sell a product', 'Promote an event', 'Build awareness'];
export const industryOptions = ['Beauty & Skincare', 'Food & Beverage', 'Software / App', 'Fashion', 'Fitness'];

export const standardFields = [
  { key: 'mainProduct', label: 'Main Product', value: '' },
  { key: 'about', label: 'What Is "the Product" About?', value: '' },
  { key: 'painPoints', label: 'Pain Points', value: '' },
  { key: 'benefit', label: 'Benefit', value: '' },
  { key: 'features', label: 'Key Features', value: '' },
  { key: 'audience', label: 'Who This Product For?', value: '' },
  { key: 'steps', label: 'Steps to Use "This Product"', value: '' },
  { key: 'setup', label: 'First Time Setup Note (optional)', value: '' },
];

export const informationalFields = [
  { key: 'newsAbout', label: 'What Is This News About', value: '' },
  { key: 'highlight', label: 'Highlight', value: '' },
  { key: 'guidingSteps', label: 'Guiding Steps', value: '' },
  { key: 'addOns', label: 'Add-Ons', value: '' },
];

export const platforms = [
  { id: 'ig', label: 'Instagram' },
  { id: 'fb', label: 'Facebook' },
  { id: 'xhs', label: 'RedNote (XHS)' },
];

export const mockCredentials = { username: 'admin123', password: 'admin123' };

// This used to ship with a handful of sample requirement docs (a fake
// "Luma_Marketing_SOP.pdf", a fake product brief, and four auto-generated
// guidance docs tied to the sample posts that were already removed from
// `content` above) — same issue as every other seeded demo data this app
// used to boot with. Starting empty means the Requirement page's document
// picker (used when generating posts/landing pages, see the post create flow's
// `docsContext`) only ever offers documents someone actually uploaded
// through the app. See AdminPanel.jsx's `documents` state — it also
// explicitly filters these old sample doc ids out of anyone's already-saved
// localStorage, since just emptying this array here wouldn't retroactively
// clear what an earlier version of the app had already written to a real
// browser's storage.
export const mockDocuments = [];

export const platformMeta = {
  ig: { label: 'Instagram', accent: 'var(--accent-violet)' },
  fb: { label: 'Facebook', accent: 'var(--accent-mint)' },
  xhs: { label: 'RedNote (XHS)', accent: 'var(--accent-coral)' },
  // YouTube isn't part of the AI-generate flow — it only shows up via the
  // manual "Upload" button on the Post page — but it still needs an entry
  // here so its label/filter pill/badge render correctly like every other
  // platform instead of falling back to the raw 'yt' kind string.
  yt: { label: 'YouTube', accent: 'var(--accent-coral)' },
};

// ---- Member management demo data ----

// Superadmin is the one true "always full access" tier — it's who admin123
// logs in as (see LoginScreen.jsx), and it's the only role that can reach
// the Superadmin page (managing real logins) and edit this table. Admin is
// one level down: full access to every "admin function" (Generate through
// API) by default, but — unlike Superadmin — its row here is real, stored,
// editable data, so Superadmin can restrict an Admin's access later if
// ever needed.
export const roleOptions = ['Superadmin', 'Admin', 'Manager', 'Member'];

// Roles assignable from the regular Team Members list (invite / change-role
// pills). Superadmin is deliberately excluded here — granting that tier is
// only ever done from the real Superadmin login dashboard, not from a pill
// click on a demo member card.
export const assignableRoles = ['Admin', 'Manager', 'Member'];

// Branches used to be a fixed hardcoded list here (HQ, Downtown, Uptown,
// Mall Plaza, Online) — that's gone now. Real branches are company-specific,
// so they live in AdminPanel.jsx's `branches` state (persisted to
// localStorage) and get created/removed from the Members page's new
// "Branches" section instead of shipping with sample names baked in.
//
// The sample "Team Members" (Jane Chen, Alex Wong, etc.) that used to seed
// this list are gone too, for the same reason every other part of this app
// dropped its placeholder data — a live deployment shouldn't show anyone
// who was never actually invited. Real members are added via "Invite
// Member" and persist in AdminPanel.jsx's `members` state.

// Each row here is a real menu item in the side menu (see SideMenu.jsx) — the
// checklist controls exactly what it looks like: whether that role even sees
// the item enabled, or sees it greyed out and unclickable.
//
// `adminOnly: true` rows (Domain / Social Media / API) can never be granted
// to Manager or Member from this table — they touch real Facebook tokens and
// API keys, so that lock is enforced in code regardless of what's checked.
// Superadmin and Admin can both have these ("admin functions"); Superadmin's
// column is always on, Admin's is real editable data.
//
// Superadmin itself (managing logins) IS a row in this table now
// ('superadmin', adminOnly like Domain/Social Media/API) — Admin can be
// granted it so they can create their own logins (each stamped with
// createdByAdminId) and set their own Post API key override, which
// everyone they create then falls back to before the shared default. It's
// off for Admin by default below; Superadmin always has it, same as every
// other adminOnly row. Only Superadmin can edit this table (see
// MembersPage.jsx).
//
// EDITOR/VIEW project permissions (see AssignPermissionModal) still work the
// same as before: a Member gets EDITOR automatically on projects they
// generate, a Manager gets EDITOR on every project in their own branch. The
// "Assign project permission" action itself is available to whoever can open
// the Post or Landing Page menu (derived in AdminPanel, not stored here).
export const permissionDefs = [
  { key: 'generate', label: 'Generate' },
  { key: 'requirement', label: 'Requirement' },
  { key: 'userSetting', label: 'User Setting' },
  { key: 'landingPage', label: 'Landing Page' },
  { key: 'post', label: 'Post' },
  { key: 'member', label: 'Member' },
  { key: 'domain', label: 'Domain', adminOnly: true },
  { key: 'socialMedia', label: 'Social Media', adminOnly: true },
  { key: 'api', label: 'API', adminOnly: true },
  { key: 'superadmin', label: 'Superadmin (manage logins)', adminOnly: true },
];

export const initialPermissions = {
  Superadmin: {
    generate: true, requirement: true, userSetting: true,
    landingPage: true, post: true, member: true,
    domain: true, socialMedia: true, api: true, superadmin: true,
  },
  Admin: {
    generate: true, requirement: true, userSetting: true,
    landingPage: true, post: true, member: true,
    domain: true, socialMedia: true, api: true, superadmin: false,
  },
  Manager: {
    generate: true, requirement: true, userSetting: true,
    landingPage: true, post: true, member: true,
    domain: false, socialMedia: false, api: false, superadmin: false,
  },
  Member: {
    generate: true, requirement: true, userSetting: true,
    landingPage: false, post: false, member: false,
    domain: false, socialMedia: false, api: false, superadmin: false,
  },
};
