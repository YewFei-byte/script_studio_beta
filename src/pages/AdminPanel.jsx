import React, { useCallback, useEffect, useRef, useState } from 'react';
import TopBar from '../components/TopBar';
import ContentPreviewModal from '../components/ContentPreviewModal';
import PublishScheduleModal from '../components/PublishScheduleModal';
import MembersPage from './MembersPage';
import DocumentsPage from './DocumentsPage';
import LandingPagePage from './LandingPagePage';
import PostPage from './PostPage';
import GeneratePage from './GeneratePage';
import UserSettingPage from './UserSettingPage';
import DomainPage from './DomainPage';
import SocialMediaPage from './SocialMediaPage';
import ApiKeysPage from './ApiKeysPage';
import SuperadminPage from './SuperadminPage';
import BrandKitPage from './BrandKitPage';
import { X } from 'lucide-react';
import { GlassButton } from '../components/Glass';
import PublishedDialog from '../components/PublishedDialog';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import { onPublished } from '../utils/publishEvents';
import LandingCreateFlow from '../editor/landing/LandingCreateFlow';
import LandingEditor from '../editor/landing/LandingEditor';
import RebuildModal from '../editor/landing/RebuildModal';
import PostCreateFlow from '../editor/post/PostCreateFlow';
import PostEditor from '../editor/post/PostEditor';
import { fetchSiteStats, unpublishLandingPage } from '../utils/hosting';
import { initialProfile, mockDocuments, initialPermissions } from '../data/mockData';
import { fetchCredentials } from '../utils/credentialsApi';
import { fetchData, saveData } from '../utils/dataApi';
import { useContentSync, serializableItem } from '../hooks/useContentSync';
import { listUsers } from '../utils/usersApi';
import { syncCalendarEvent, deleteCalendarEvent } from '../utils/googleCalendarSync';

// Exact ids of the old sample Requirement docs this app used to ship with
// (see the removed entries in mockData.js's mockDocuments) — used to strip
// them out of a browser's already-saved localStorage below.
const SAMPLE_DOCUMENT_IDS = new Set(['d1', 'd2', 'd3', 'doc-c1', 'doc-c2', 'doc-c3', 'doc-c4']);

// Union-by-id merge for the content list synced with Postgres (see the
// reconciliation effect below) — deliberately never a blind replace. Every
// post/landing page from either side survives; only when the exact same id
// shows up on both sides does one version win, decided by whichever has the
// newer updatedAt/createdAt. An empty list on either side just contributes
// nothing, instead of being treated as "the truth" and wiping the other
// side out.
function mergeContentLists(a, b) {
  const byId = new Map();
  const timeOf = (item) => new Date(item.updatedAt || item.createdAt || 0).getTime() || 0;
  [...a, ...b].forEach((item) => {
    if (!item || !item.id) return;
    const existing = byId.get(item.id);
    if (!existing || timeOf(item) >= timeOf(existing)) byId.set(item.id, item);
  });
  return Array.from(byId.values());
}

// Same cross-device gap as mergeContentLists above, but for a plain array of
// branch-name strings (no id/updatedAt to compare) -- a simple union is all
// that's needed since a branch name either exists or it doesn't, and only
// removeBranch (guarded against branches still in use) ever takes one away.
function mergeStringList(a, b) {
  const set = new Set([...(a || []), ...(b || [])]);
  return Array.from(set);
}

// Shown in place of a settings page the current user's role isn't allowed
// into — e.g. a Manager navigating straight to a URL/state for "Domain"
// after an Admin toggled off their Company Settings permission mid-session.
// The nav (SideMenu) already hides links to these, this is just the
// belt-and-suspenders check on the page itself.
function NoAccess() {
  return (
    <div style={{ maxWidth: 620, margin: '60px auto', textAlign: 'center', color: 'var(--ink-500)' }}>
      <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>You don't have access to this page</p>
      <p style={{ fontSize: 13 }}>Ask an Admin if you think this is wrong.</p>
    </div>
  );
}

export default function AdminPanel({ user, onLogout, onUpdateUser }) {
  const [view, setView] = useState('generate');
  // Facebook's connected state (Page id/name/access token) is real, so it
  // needs to survive a page reload — unlike the rest of `profile`, which is
  // still mock/demo data. Only the fb entry is persisted here, so nothing
  // else about profile's behavior changes.
  const [profile, setProfile] = useState(() => {
    try {
      const savedFb = JSON.parse(localStorage.getItem('scriptStudioFbConnection') || 'null');
      if (savedFb) {
        return {
          ...initialProfile,
          socials: initialProfile.socials.map((s) => (s.id === 'fb' ? { ...s, ...savedFb } : s)),
        };
      }
    } catch {
      // ignore malformed storage, fall through to the default profile
    }
    return initialProfile;
  });

  useEffect(() => {
    const fb = profile.socials?.find((s) => s.id === 'fb');
    if (fb) {
      localStorage.setItem(
        'scriptStudioFbConnection',
        JSON.stringify({
          connected: fb.connected,
          pageId: fb.pageId,
          pageName: fb.pageName,
          pageAccessToken: fb.pageAccessToken,
        })
      );
    }
  }, [profile]);

  // Postgres is the cross-device source of truth (see server.js /
  // src/utils/credentialsApi.js) — on load, ask it if it has a saved
  // connection for each platform and, if so, adopt it over whatever
  // localStorage had (e.g. a fresh browser/device that's never saved
  // anything locally, or a different person logging in on their own
  // machine). This used to only run for Facebook — Instagram and YouTube
  // were being *saved* to Postgres from the Social Media page but never
  // *read back*, so someone logging in on a different browser would see
  // Facebook connected but Instagram/YouTube looking disconnected even
  // though real credentials existed on the server the whole time. Now all
  // three do the same round-trip. If the API isn't reachable (local dev
  // without `node server.js`, or Postgres not attached yet), each of these
  // silently resolves to null and nothing changes — localStorage keeps
  // doing exactly what it did before.
  useEffect(() => {
    fetchCredentials('fb').then((saved) => {
      if (!saved) return;
      setProfile((p) => ({
        ...p,
        socials: p.socials.map((s) =>
          s.id === 'fb'
            ? { ...s, connected: true, pageId: saved.pageId, pageName: saved.pageName, pageAccessToken: saved.accessToken }
            : s
        ),
      }));
    });
    fetchCredentials('ig').then((saved) => {
      if (!saved) return;
      setProfile((p) => ({
        ...p,
        socials: p.socials.map((s) => (s.id === 'ig' ? { ...s, connected: true, businessId: saved.businessId } : s)),
      }));
    });
    fetchCredentials('yt').then((saved) => {
      if (!saved) return;
      setProfile((p) => ({
        ...p,
        socials: p.socials.map((s) =>
          s.id === 'yt'
            ? { ...s, connected: true, clientId: saved.clientId, clientSecret: saved.clientSecret, refreshToken: saved.refreshToken }
            : s
        ),
      }));
    });
  }, []);

  // Generated posts/landing pages and their Requirement docs used to live
  // only in memory — any full page reload (a dev-server restart, a Railway
  // redeploy, the user just refreshing) silently wiped them back to the
  // built-in demo/mock data, with no warning that anything was lost. Loading
  // from (and saving to) localStorage here fixes that, the same way the
  // Facebook connection and API keys already survive reloads below.
  const [documents, setDocuments] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scriptStudioDocuments') || 'null');
      const list = Array.isArray(saved) ? saved : mockDocuments;
      // Strip out the old sample requirement docs (fake SOP/product brief +
      // their auto-generated guidance docs) by exact id, in case an earlier
      // version of the app already wrote them into this browser's
      // localStorage — mockDocuments being empty now only stops NEW browsers
      // from getting them, it doesn't clean up ones that already have them.
      // Matched by exact id, not a pattern, so a real uploaded doc (ids are
      // `d${Date.now()}`) or a real guidance doc (ids are `doc-${realItemId}`)
      // never gets caught by this.
      return list.filter((d) => !SAMPLE_DOCUMENT_IDS.has(d.id));
    } catch {
      return [];
    }
  });
  const [content, setContent] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scriptStudioContent') || 'null');
      if (Array.isArray(saved)) {
        // This app used to boot straight into the built-in demo posts
        // (ids like 'c1'..'c16') before they were persisted — strip any of
        // those back out so a live deployment never shows placeholder
        // content, while leaving every real generated/uploaded post (ids
        // like `new-...` / `upload-...`) untouched.
        return saved.filter((c) => !/^c\d+$/.test(c.id));
      }
    } catch {
      // fall through to an empty, sample-free list
    }
    return [];
  });

  // Surfaced when a server save actually fails, instead of the app carrying
  // on as if it worked and the change vanishing on the next reload.
  const [contentSaveWarning, setContentSaveWarning] = useState('');

  // This browser's copy, so the list still shows instantly on reload (and
  // works with no server at all in local dev).
  useEffect(() => {
    try {
      localStorage.setItem('scriptStudioContent', JSON.stringify(content.map(serializableItem)));
    } catch (err) {
      console.warn('Could not save generated posts to localStorage:', err);
    }
  }, [content]);

  // Cross-device copy: each post/landing page is its own row on the server
  // (server/content.js), saved individually when it changes, with other
  // devices' changes and deletes pulled in every 15s. See useContentSync.js.
  useContentSync(content, setContent, {
    onSaveOk: () => setContentSaveWarning(''),
    onSaveError: (err) => {
      console.error('Could not save content to the server:', err);
      setContentSaveWarning(
        `Your latest change couldn't be saved to the server (${err.message}). It's still visible here and will be retried automatically — don't reload until this goes away.`
      );
    },
  });

  // Same cross-device gap as content/apiKeys above: Requirement docs
  // (guidance docs + real uploaded SOPs) used to be localStorage-only, so a
  // teammate logging in on their own computer always saw an empty
  // Requirements page even though docs had genuinely been generated/
  // uploaded elsewhere. Same seed-then-mirror pattern as content.
  const documentsSynced = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('scriptStudioDocuments', JSON.stringify(documents));
    } catch (err) {
      console.warn('Could not save documents to localStorage:', err);
    }
    if (documentsSynced.current) saveData('documents', documents).catch(() => {});
  }, [documents]);

  useEffect(() => {
    fetchData('documents').then((serverValue) => {
      const serverList = Array.isArray(serverValue) ? serverValue : [];
      const merged = mergeContentLists(serverList, documents);
      if (merged.length !== documents.length) setDocuments(merged);
      if (merged.length > 0) saveData('documents', merged).catch(() => {});
      documentsSynced.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fbAppId isn't secret (it's meant to be public/client-side), so saving it
  // to localStorage alongside the other keys just means you don't have to
  // retype it every time you reload — unlike a real secret, this is fine.
  // Brand Kit (Settings → Brand): one per company, shared by everyone in it
  // and used as the starting point for every new landing page / post.
  // Superadmin / company-less logins use the 'default' kit.
  const brandKitKey = `brandKit:${user?.company || 'default'}`;
  const [brandKit, setBrandKit] = useState(null);
  useEffect(() => {
    fetchData(brandKitKey).then((v) => setBrandKit(v || null));
    const id = setInterval(() => fetchData(brandKitKey).then((v) => v !== undefined && setBrandKit(v || null)), 60000);
    return () => clearInterval(id);
  }, [brandKitKey]);
  const saveBrandKit = (kit) => {
    setBrandKit(kit);
    saveData(brandKitKey, kit).catch((err) => setContentSaveWarning(`The brand couldn't be saved (${err.message}). Try again in a moment.`));
  };
  // Unsaved Brand edits, so leaving the Brand page (or closing the Brand
  // pop-up) asks before throwing them away.
  const brandDraft = useRef(null);
  const onBrandDraft = useCallback((d) => { brandDraft.current = d; }, []);
  const [leaveBrand, setLeaveBrand] = useState(null); // what to do once the "save?" question is answered
  const guardBrand = (then) => (brandDraft.current ? setLeaveBrand(() => then) : then());
  const answerLeaveBrand = (save) => {
    if (save && brandDraft.current) saveBrandKit(brandDraft.current);
    brandDraft.current = null;
    const then = leaveBrand;
    setLeaveBrand(null);
    then();
  };
  // The Brand page as a pop-up over a create flow or editor, so whatever
  // was being made stays open underneath.
  const [brandOverlay, setBrandOverlay] = useState(false);

  // "It's live" dialog after anything is published.
  const [justPublished, setJustPublished] = useState(null);
  useEffect(() => onPublished(setJustPublished), []);

  const [apiKeys, setApiKeys] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scriptStudioApiKeys') || '{}');
      // postProvider: which AI the "Post API Key" belongs to — 'openai' or
      // 'gemini' — set via the pills next to that field on Settings -> API.
      // Defaults to 'openai' so keys saved before this field existed keep
      // working exactly as before.
      return { landing: '', post: '', postProvider: 'openai', fbAppId: '', ...saved };
    } catch {
      return { landing: '', post: '', postProvider: 'openai', fbAppId: '' };
    }
  });

  // Same cross-device gap as content above: API keys used to be
  // localStorage-only, so a different login/browser always saw them blank
  // even though they were saved and working here. Same seed-then-mirror
  // pattern — see the `documentsSynced` effect for why the ref guard matters.
  const apiKeysSynced = useRef(false);

  useEffect(() => {
    localStorage.setItem('scriptStudioApiKeys', JSON.stringify(apiKeys));
    if (apiKeysSynced.current) saveData('apiKeys', apiKeys).catch(() => {});
  }, [apiKeys]);

  useEffect(() => {
    fetchData('apiKeys').then((serverValue) => {
      // Only adopt a key from the server if it's actually got a value — an
      // empty string (e.g. from a browser/session that never had a key set)
      // must never blank out a real key this browser already has, same
      // reasoning as the content merge above. Computed synchronously here
      // (rather than inside a setApiKeys updater) so the exact same merged
      // object gets both applied locally and pushed back to the server —
      // pushing the pre-merge local value instead would risk overwriting a
      // real server-side key with this browser's blank one.
      const merged = { ...apiKeys };
      if (serverValue && typeof serverValue === 'object') {
        Object.entries(serverValue).forEach(([key, value]) => {
          if (value) merged[key] = value;
        });
      }
      setApiKeys(merged);
      saveData('apiKeys', merged).catch(() => {});
      apiKeysSynced.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Team Members used to boot straight into 8 sample people (Jane Chen,
  // Alex Wong, etc.) that were never real — same issue as the old seeded
  // demo posts. Starting empty and persisting to localStorage means only
  // people actually invited through this app ever show up here, and they
  // survive refreshes/logouts like everything else on this page.
  const [members, setMembers] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scriptStudioMembers') || 'null');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  // Same cross-device gap as content/apiKeys/documents above -- and the most
  // consequential one, since content visibility (visibleContent below) is
  // keyed off `members` via loginId/createdBy. Being localStorage-only meant
  // a teammate logging in on their own computer got an EMPTY members list,
  // so currentMemberId resolved to null and they saw none of their own
  // posts/landing pages, nobody else on the roster, and (via the same
  // mechanism) no Requirement docs either -- not a permissions problem, the
  // roster link itself just never left the browser that created it.
  const membersSynced = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('scriptStudioMembers', JSON.stringify(members));
    } catch (err) {
      console.warn('Could not save members to localStorage:', err);
    }
    if (membersSynced.current) saveData('members', members).catch(() => {});
  }, [members]);

  useEffect(() => {
    fetchData('members').then((serverValue) => {
      const serverList = Array.isArray(serverValue) ? serverValue : [];
      const merged = mergeContentLists(serverList, members);
      if (merged.length !== members.length) setMembers(merged);
      if (merged.length > 0) saveData('members', merged).catch(() => {});
      membersSynced.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Branches used to be a fixed hardcoded list (HQ, Downtown, Uptown, Mall
  // Plaza, Online) — every company's real branches are different, so this
  // starts empty and gets built up from the Members page's "Branches"
  // section instead (see MembersPage.jsx). Persisted the same way as
  // members, so real branch names survive refreshes/logouts too.
  const [branches, setBranches] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scriptStudioBranches') || 'null');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  // Same cross-device gap as members above.
  const branchesSynced = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('scriptStudioBranches', JSON.stringify(branches));
    } catch (err) {
      console.warn('Could not save branches to localStorage:', err);
    }
    if (branchesSynced.current) saveData('branches', branches).catch(() => {});
  }, [branches]);

  useEffect(() => {
    fetchData('branches').then((serverValue) => {
      const serverList = Array.isArray(serverValue) ? serverValue : [];
      const merged = mergeStringList(serverList, branches);
      if (merged.length !== branches.length) setBranches(merged);
      if (merged.length > 0) saveData('branches', merged).catch(() => {});
      branchesSynced.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Companies sit one level above Branch (Company -> Branch -> Member),
  // added so a Superadmin running more than one company through this same
  // deployment can give each company's Admin visibility scoped to just
  // their own company's branches, instead of every Admin seeing every
  // other company's posts too. Managed the same way as branches (add/
  // remove list, Superadmin-only) -- see MembersPage.jsx's "Companies"
  // section.
  const [companies, setCompanies] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scriptStudioCompanies') || 'null');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const companiesSynced = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('scriptStudioCompanies', JSON.stringify(companies));
    } catch (err) {
      console.warn('Could not save companies to localStorage:', err);
    }
    if (companiesSynced.current) saveData('companies', companies).catch(() => {});
  }, [companies]);

  useEffect(() => {
    fetchData('companies').then((serverValue) => {
      const serverList = Array.isArray(serverValue) ? serverValue : [];
      const merged = mergeStringList(serverList, companies);
      if (merged.length !== companies.length) setCompanies(merged);
      if (merged.length > 0) saveData('companies', merged).catch(() => {});
      companiesSynced.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which company owns each branch -- a plain { branchName: companyName }
  // map, since branches themselves stay a flat string list (changing that
  // shape would mean rewiring every branch dropdown in the app). Merged
  // the same way as the Role Permissions object below: the server copy
  // wins wherever it has an entry, since this is hand-edited settings data
  // with no per-field timestamps to compare.
  const [branchCompany, setBranchCompany] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scriptStudioBranchCompany') || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch {
      // fall through to default
    }
    return {};
  });
  const branchCompanySynced = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('scriptStudioBranchCompany', JSON.stringify(branchCompany));
    } catch (err) {
      console.warn('Could not save branch/company map to localStorage:', err);
    }
    if (branchCompanySynced.current) saveData('branchCompany', branchCompany).catch(() => {});
  }, [branchCompany]);

  useEffect(() => {
    fetchData('branchCompany').then((serverValue) => {
      if (serverValue && typeof serverValue === 'object') {
        const merged = { ...branchCompany, ...serverValue };
        setBranchCompany(merged);
        saveData('branchCompany', merged).catch(() => {});
      } else if (branchCompany) {
        saveData('branchCompany', branchCompany).catch(() => {});
      }
      branchCompanySynced.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Role Permissions table used to live only in this component's React
  // state, which gets wiped every time the user logs out (AdminPanel
  // unmounts — see App.jsx). That was harmless while login was a single
  // shared admin123 session, but now that real per-user login exists, an
  // Admin's checklist changes would silently vanish the instant anyone
  // logged out. Persisting to localStorage fixes that, the same pattern
  // already used for content/documents/API keys above.
  const [permissions, setPermissions] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('scriptStudioPermissions') || 'null');
      if (saved && typeof saved === 'object') return { ...initialPermissions, ...saved };
    } catch {
      // fall through to defaults
    }
    return initialPermissions;
  });

  // Same cross-device gap as members/branches above -- an Admin's Role
  // Permissions changes need to actually apply for teammates logging in
  // elsewhere, not just on the browser that made the change.
  const permissionsSynced = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('scriptStudioPermissions', JSON.stringify(permissions));
    } catch (err) {
      console.warn('Could not save role permissions to localStorage:', err);
    }
    if (permissionsSynced.current) saveData('permissions', permissions).catch(() => {});
  }, [permissions]);

  useEffect(() => {
    fetchData('permissions').then((serverValue) => {
      // Unlike the list merges above, this is a small hand-edited settings
      // object with no per-field timestamps -- the server copy (the shared
      // source of truth every other device already sees) wins wherever it
      // has a value; a brand-new browser with nothing but defaults simply
      // contributes nothing and can't stomp on a real server-side change.
      if (serverValue && typeof serverValue === 'object') {
        const merged = { ...permissions, ...serverValue };
        setPermissions(merged);
        saveData('permissions', merged).catch(() => {});
      } else if (permissions) {
        saveData('permissions', permissions).catch(() => {});
      }
      permissionsSynced.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic re-sync while this session sits open, catching changes made
  // on another login/device -- deletions especially. The one-time
  // reconciliation effects above (documentsSynced/membersSynced/etc.) only
  // ever union data together, which is the right call for a first-ever
  // sync (an empty new browser must never wipe out real server data) but
  // structurally can NEVER represent a delete -- nothing that only ever
  // merges-in can make an item disappear. So without this, deleting a
  // post/member/document/branch on one device would only actually vanish
  // for everyone else once (a) they refreshed the page, and worse, (b) if
  // their still-open, stale session made any edit of its own in the
  // meantime, its save-on-change effect would push its whole (stale, still
  // containing the "deleted" item) array back up and silently resurrect
  // whatever was deleted elsewhere.
  //
  // Once the initial merge above has happened at least once, the server is
  // the trustworthy shared source of truth for the rest of the session, so
  // this just adopts whatever the server currently has outright (no union)
  // every 15s -- which is what actually makes a delete performed elsewhere
  // disappear here too, without a manual reload. Comparing the fetched
  // value against current state first (JSON.stringify) avoids a pointless
  // re-render/re-save round-trip when nothing's actually changed.
  useEffect(() => {
    // (Posts/landing pages sync themselves -- see useContentSync above.)
    const tick = async () => {
      if (documentsSynced.current) {
        const serverDocs = await fetchData('documents').catch(() => null);
        if (Array.isArray(serverDocs)) {
          setDocuments((prev) => (JSON.stringify(serverDocs) === JSON.stringify(prev) ? prev : serverDocs));
        }
      }
      if (membersSynced.current) {
        const serverMembers = await fetchData('members').catch(() => null);
        if (Array.isArray(serverMembers)) {
          setMembers((prev) => (JSON.stringify(serverMembers) === JSON.stringify(prev) ? prev : serverMembers));
        }
      }
      if (branchesSynced.current) {
        const serverBranches = await fetchData('branches').catch(() => null);
        if (Array.isArray(serverBranches)) {
          setBranches((prev) => (JSON.stringify(serverBranches) === JSON.stringify(prev) ? prev : serverBranches));
        }
      }
      if (companiesSynced.current) {
        const serverCompanies = await fetchData('companies').catch(() => null);
        if (Array.isArray(serverCompanies)) {
          setCompanies((prev) => (JSON.stringify(serverCompanies) === JSON.stringify(prev) ? prev : serverCompanies));
        }
      }
      if (branchCompanySynced.current) {
        const serverBranchCompany = await fetchData('branchCompany').catch(() => null);
        if (serverBranchCompany && typeof serverBranchCompany === 'object') {
          setBranchCompany((prev) => (JSON.stringify(serverBranchCompany) === JSON.stringify(prev) ? prev : serverBranchCompany));
        }
      }
    };
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real role-based gating, derived from the (live, Admin-editable) Role
  // Permissions table in Members, plus the current logged-in user's role
  // (see App.jsx / LoginScreen.jsx for how `user` gets set). Admin always
  // has every capability regardless of the table, as a safety net against
  // an Admin accidentally locking themselves out by unchecking their own row.
  // Superadmin is the one true always-full-access tier (admin123 logs in as
  // this — see LoginScreen.jsx) and the only role that can open Superadmin
  // (managing real logins) or edit the Role Permissions table. Admin is one
  // level down: full "admin function" access by default, but — unlike
  // Superadmin — its row in the table is real, editable data, so Superadmin
  // can restrict it later if that's ever needed.
  const isSuperadmin = user?.role === 'Superadmin';
  const isAdmin = user?.role === 'Admin';
  // An Admin's own Post API key override (Post key + provider only — the
  // Landing Page key and Facebook App ID stay purely in the shared apiKeys
  // blob above, Superadmin-controlled). Stored under its own app_data key
  // per admin (apiKeys:admin:<their user id>) via the same generic
  // fetchData/saveData helpers, rather than inside the shared blob, so one
  // Admin setting their own key can never overwrite another Admin's or the
  // shared default. Only meaningful when this login is actually an Admin —
  // Superadmin's "own" key already IS the shared default (see
  // ApiKeysPage.jsx), and Manager/Member never see the API page at all.
  const [personalPostKey, setPersonalPostKeyState] = useState({ post: '', postProvider: 'openai' });
  const personalPostKeyDataKey = user?.role === 'Admin' && user?.id ? `apiKeys:admin:${user.id}` : null;

  useEffect(() => {
    if (!personalPostKeyDataKey) return;
    fetchData(personalPostKeyDataKey).then((serverValue) => {
      if (serverValue && typeof serverValue === 'object') {
        setPersonalPostKeyState((k) => ({ ...k, ...serverValue }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalPostKeyDataKey]);

  const setPersonalPostKey = (next) => {
    setPersonalPostKeyState(next);
    if (personalPostKeyDataKey) saveData(personalPostKeyDataKey, next).catch(() => {});
  };

  // For Manager/Member: the Post key override belonging to whichever
  // Admin/Superadmin created their login (see server.js's
  // created_by_admin_id, exposed on `user.createdByAdminId` at login).
  // Falls back to nothing (→ the shared default) if that admin never set
  // one, or if this login has no recorded creator at all (e.g. it predates
  // this feature, or is the admin123 master login).
  const [creatorAdminPostKey, setCreatorAdminPostKey] = useState(null);
  useEffect(() => {
    if (isSuperadmin || isAdmin || !user?.createdByAdminId) { setCreatorAdminPostKey(null); return; }
    fetchData(`apiKeys:admin:${user.createdByAdminId}`).then((v) => setCreatorAdminPostKey(v || null));
  }, [user?.createdByAdminId, isSuperadmin, isAdmin]);

  // The Post key/provider actually used for THIS logged-in user's
  // generations, in priority order: their own key (Admin only) → their
  // creator admin's key (Manager/Member only) → the Superadmin-set shared
  // default. Everything else on the API page (Landing Page key, Facebook
  // App ID) is unaffected and always comes straight from the shared
  // `apiKeys` blob.
  const effectiveApiKeys = (() => {
    if (isAdmin && personalPostKey?.post) {
      return { ...apiKeys, post: personalPostKey.post, postProvider: personalPostKey.postProvider || 'openai', postModel: personalPostKey.postModel };
    }
    if (!isSuperadmin && !isAdmin && creatorAdminPostKey?.post) {
      return { ...apiKeys, post: creatorAdminPostKey.post, postProvider: creatorAdminPostKey.postProvider || 'openai', postModel: creatorAdminPostKey.postModel };
    }
    return apiKeys;
  })();
  const rolePerms = permissions[user?.role] || {};
  // menuAccess mirrors the table 1:1 with the side menu — one flag per menu
  // item (see mockData.js permissionDefs). Domain/Social Media/API can only
  // ever be true for Superadmin (always) or Admin (per the table) — Manager
  // and Member are force-excluded here in code, not just in the stored
  // data, since those touch real Facebook tokens/API keys.
  const menuAccess = {
    generate: isSuperadmin || !!rolePerms.generate,
    requirement: isSuperadmin || !!rolePerms.requirement,
    userSetting: isSuperadmin || !!rolePerms.userSetting,
    landingPage: isSuperadmin || !!rolePerms.landingPage,
    post: isSuperadmin || !!rolePerms.post,
    member: isSuperadmin || !!rolePerms.member,
    domain: isSuperadmin || (isAdmin && !!rolePerms.domain),
    socialMedia: isSuperadmin || (isAdmin && !!rolePerms.socialMedia),
    api: isSuperadmin || (isAdmin && !!rolePerms.api),
    // Everyone can see the brand; only Superadmin/Admin can change it (see canEdit below).
    brand: true,
    superadmin: isSuperadmin || (isAdmin && !!rolePerms.superadmin),
  };
  // Assigning a project's Editor/View permission only makes sense if you can
  // even open the Post or Landing Page menu the project lives in.
  // Manage-vs-read-only on the Members page still follows role identity, not
  // the checklist: Superadmin/Admin manage every branch (both count as
  // "full admin function"), Manager manages their own branch, Member is
  // always read-only. The checklist only ever controls whether the Member
  // menu item is visible at all (menuAccess.member).
  const canManageAllMembers = isSuperadmin || isAdmin;
  const canManageBranchMembers = canManageAllMembers || user?.role === 'Manager';

  // Which Members-roster entry the logged-in identity corresponds to — that
  // roster (not the login itself) is what content ownership/sharing was
  // already keyed against (createdBy, memberPermissions — see mockData.js),
  // so real per-login visibility resolves through this link rather than
  // introducing a second identity space. SuperadminPage.jsx keeps every real
  // login's roster entry in sync via `loginId` on create/update; the
  // admin123 master login has no roster entry (and doesn't need one, since
  // Superadmin already sees everything below).
  const currentMember = members.find((m) => m.loginId === user?.id) || null;
  const currentMemberId = currentMember?.id || null;

  // Only Superadmin sees literally everything now. An Admin used to as
  // well, but that meant an Admin could see Superadmin's (or another
  // Admin's) own projects, which isn't the isolation an Admin account is
  // supposed to have — an Admin should see their own work plus the work of
  // whichever logins THEY created, nothing above or beside them. Resolving
  // "which logins did I create" needs the full user list (createdByAdminId
  // — see server.js), which Superadmin's page already fetches; Admin needs
  // its own copy here since this filter runs on every render of the
  // Landing Page / Post lists, not just the Superadmin page.
  const [allUsersForAdmin, setAllUsersForAdmin] = useState([]);
  useEffect(() => {
    if (!isAdmin) { setAllUsersForAdmin([]); return; }
    listUsers().then(setAllUsersForAdmin).catch(() => setAllUsersForAdmin([]));
  }, [isAdmin]);

  // Member ids (the roster identity content ownership is keyed against —
  // see currentMemberId above) belonging to logins this Admin personally
  // created. Cross-references allUsersForAdmin (createdByAdminId) against
  // members (loginId) to translate "login created by me" into "member id
  // whose content I should see".
  const adminCreatedLogins = isAdmin ? allUsersForAdmin.filter((u) => u.createdByAdminId === user?.id) : [];
  const adminCreatedMemberIds = new Set(adminCreatedLogins.map((u) => members.find((m) => m.loginId === u.id)?.id).filter(Boolean));
  // Same, by login id: content also records the login that made it
  // (createdByLogin, see stampOwner below), which works even when that
  // login has no Members-roster entry.
  const adminCreatedLoginIds = new Set(adminCreatedLogins.map((u) => u.id));

  // Superadmin keeps seeing every project, same as every other "full admin
  // function" checklist item above. Everyone else — including Admin now —
  // only sees what they created, what's in their own branch (Manager
  // only — matches the branch auto-EDITOR note in mockData.js), what a
  // login they personally created generated (Admin only, via
  // adminCreatedMemberIds above), or what's been explicitly shared with
  // them via Assign Permission (memberPermissions). This only filters the
  // *listing* pages (Landing Page / Post) below — action handlers still
  // operate on the full `content` list by id, so a shared/branch item still
  // opens and edits correctly once it's visible.
  const canSeeAllContent = isSuperadmin;
  // Branch scoping used to be Manager-only, then got extended to Member
  // too ("own branch" for both non-admin roles) -- but an Admin assigned
  // to a branch needs to see that branch's content as well. Admin is NOT
  // in isBranchScopedRole below (that one's for the Manager/Member
  // Requirement-doc filter further down, which is unaffected by this),
  // but IS included directly in the visibleContent branch-match clause: an
  // Admin sees everything in their own branch, PLUS anything created by a
  // login they personally created (adminCreatedMemberIds below, which can
  // span OTHER branches too -- e.g. an Admin managing teams across
  // multiple branches), PLUS their own stuff, PLUS explicit shares. Only
  // Superadmin sees literally everything with no branch restriction at
  // all. Note this only works for content that actually has a `branch`
  // stamped on it -- see handleGenerateItemComplete/handleManualUpload/
  // handleRegenerateSave below for where that happens; anything without
  // one (very old items, predating this feature) simply won't match this
  // clause for anyone.
  const isBranchScopedRole = user?.role === 'Manager' || user?.role === 'Member';
  // Admin visibility used to be "own branch, or any branch really" in
  // practice (no company concept existed), which meant a second company
  // sharing this same deployment would have its Admin seeing the first
  // company's posts too. Now Admin is scoped to their own COMPANY (every
  // branch under it), while Manager/Member stay scoped to just their own
  // BRANCH -- Superadmin remains the only role with no restriction at all.
  const visibleContent = canSeeAllContent
    ? content
    : content.filter((c) =>
        (currentMemberId && c.createdBy === currentMemberId) ||
        (user?.id && c.createdByLogin === user.id) ||
        (user?.branch && c.branch === user?.branch && isBranchScopedRole) ||
        (isAdmin && user?.company && c.company === user?.company) ||
        (isAdmin && adminCreatedMemberIds.has(c.createdBy)) ||
        (isAdmin && c.createdByLogin && adminCreatedLoginIds.has(c.createdByLogin)) ||
        (currentMemberId && !!c.memberPermissions?.[currentMemberId])
      );

  // "Created by which login" -- item.createdBy only ever stores the
  // Members-roster id (see currentMemberId above), which is meaningless to
  // look at directly in the Post/Landing Page UI. Resolved here into a
  // real display name once, rather than making every card/preview redo
  // this lookup. A null createdBy means the admin123 master login made it
  // (the one login with no roster entry at all -- see SuperadminPage.jsx's
  // upsertLinkedMember comment); anything else with a createdBy that no
  // longer matches a member (e.g. that member was since deleted) falls
  // back to a plain "Unknown" rather than silently showing nothing.
  const memberNameById = new Map(members.map((m) => [m.id, m.name]));
  const withCreatorName = (list) =>
    list.map((c) => ({
      ...c,
      creatorName: (c.createdBy && memberNameById.get(c.createdBy)) || c.createdByName || (c.createdBy ? 'Unknown' : 'Superadmin (admin123)'),
    }));
  const visibleContentWithCreator = withCreatorName(visibleContent);

  // If Superadmin revokes a menu item the current user is sitting on right
  // now (e.g. unchecks "Post" for Manager while a Manager is viewing Post),
  // bounce them somewhere they can actually see instead of leaving them on
  // a page that's about to render "No access".
  useEffect(() => {
    const viewKey = {
      generate: 'generate', requirement: 'requirement', 'setting-user': 'userSetting',
      'admin-landing': 'landingPage', 'admin-post': 'post', members: 'member',
      'setting-domain': 'domain', 'setting-social': 'socialMedia', 'setting-api': 'api', 'setting-brand': 'brand',
    }[view];
    const fallback = () => {
      const order = [
        ['generate', 'generate'], ['requirement', 'requirement'], ['setting-user', 'userSetting'],
        ['admin-landing', 'landingPage'], ['admin-post', 'post'], ['members', 'member'],
      ];
      const next = order.find(([, key]) => menuAccess[key]);
      setView(next ? next[0] : 'generate'); // generate is always true for at least Superadmin
    };
    if (view === 'superadmin' && !menuAccess.superadmin) { fallback(); return; }
    if (viewKey && !menuAccess[viewKey]) fallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isSuperadmin, JSON.stringify(menuAccess)]);

  const [previewItem, setPreviewItem] = useState(null);
  const [publishItem, setPublishItem] = useState(null);
  const [publishNowItem, setPublishNowItem] = useState(null);
  const [generateKind, setGenerateKind] = useState(null);

  // Every new document gets stamped with whoever uploaded it (by username —
  // works for real logins and the admin123 master login alike, unlike
  // currentMemberId which only real logins linked via Superadmin have).
  // This only actually restricts anything for type: 'sop' docs — see
  // visibleDocuments below; every other doc type stays shared same as
  // before.
  const addDocument = (d) => setDocuments((ds) => [...ds, { ...d, createdBy: d.createdBy ?? (user?.username || null), branch: d.branch ?? (user?.branch || null), company: d.company ?? (user?.company || null) }]);
  const removeDocument = (id) => setDocuments((ds) => ds.filter((d) => d.id !== id));

  // Marketing SOP documents are strictly per-account — your own login only,
  // never Superadmin's, never the Admin who created you, never anyone
  // else's. No exceptions for higher roles here (unlike content
  // visibility above): a Marketing SOP is personal working material, not
  // something that cascades down an org chart. Every other document type
  // (regular requirement docs) stays visible to everyone, unchanged.
  //
  // AI Guidance docs (type: 'guidance' — the auto-recorded "<title> —
  // Guidance.txt" written by upsertGuidanceDoc for every generated/modified
  // post or landing page, including notes picked up from the Speak-with-AI
  // refine chat) are deliberately excluded from what's shown here. They're
  // still written to `documents` under the hood — SpeakWithAI's "modify"
  // flow reads item.guidance directly off the content item, not from this
  // list, so nothing about regenerate/refine depends on the doc being
  // visible — this filter only stops them from cluttering the Requirement
  // page and the "pick docs to inform this generation" picker in
  // GenerateFlow with what's effectively an internal working note per post,
  // not a real source document anyone uploaded.
  const visibleDocuments = documents.filter((d) => {
    if (d.type === 'guidance') return false;
    if (d.type === 'sop') return d.createdBy === user?.username;
    if (isBranchScopedRole && user?.branch && d.branch) return d.branch === user.branch;
    // Same company-scoping as visibleContent above -- an Admin shouldn't
    // see another company's requirement docs just because both companies
    // happen to share this deployment.
    if (isAdmin && user?.company && d.company) return d.company === user.company;
    return true;
  });

  // Every status/content change stamps updatedAt, so the grid can sort by most recently modified.
  const updateContent = (id, patch) =>
    setContent((list) => list.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c)));

  // Every generate/modify records its guidance as a doc in Requirement —
  // one doc per content item (upserted by a deterministic id), so re-modifying
  // the same item updates its doc instead of piling up duplicates.
  const upsertGuidanceDoc = (item) => {
    const doc = {
      id: `doc-${item.id}`,
      name: `${item.title} — Guidance.txt`,
      type: 'guidance',
      uploadedAt: new Date().toISOString().slice(0, 10),
      content: item.guidance,
      relatedItemId: item.id,
    };
    setDocuments((docs) => {
      const exists = docs.some((d) => d.id === doc.id);
      return exists ? docs.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...docs];
    });
  };

  // Scheduling a post/landing page (status 'scheduled') also syncs a real
  // event onto Google Calendar if it's connected (see the "Google Calendar"
  // card on User Setting → src/utils/googleCalendarSync.js) — best-effort
  // and silent if not connected, so this never blocks the actual scheduling.
  // The item's own `gcalEventId`, once known, is what lets a later
  // reschedule update that same event instead of creating a duplicate.
  const syncGcalOnSchedule = (item, status, extra) => {
    if (status !== 'scheduled' || !extra?.scheduledAt) return;
    syncCalendarEvent({ ...item, ...extra }).then((eventId) => {
      if (eventId && eventId !== item.gcalEventId) updateContent(item.id, { gcalEventId: eventId });
    });
  };

  const handlePublishSave = (status, extra) => {
    const item = publishItem;
    updateContent(item.id, { status, ...extra });
    setPublishItem(null);
    setPreviewItem(null);
    syncGcalOnSchedule(item, status, extra);
  };

  // Who made an item. createdBy is the Members-roster id (used for sharing);
  // createdByLogin/createdByName come straight from the login, so a login
  // with no roster entry (or no company) still sees, and is credited for,
  // its own work. The admin123 master login has no id, so it stays null.
  const stampOwner = (newItem) => ({
    ...newItem,
    createdBy: currentMemberId || newItem.createdBy,
    createdByLogin: user?.id ?? newItem.createdByLogin ?? null,
    createdByName: user?.id ? user.displayName || user.username : newItem.createdByName,
    branch: user?.branch || newItem.branch,
    company: user?.company || newItem.company,
    updatedAt: new Date().toISOString(),
  });

  const handleGenerateItemComplete = (newItem) => {
    const stamped = stampOwner(newItem);
    setContent((list) => [stamped, ...list]);
    upsertGuidanceDoc(stamped);
  };

  // Manual "Upload" on the Post page (see UploadPostModal) — no AI guidance
  // to record, so this just drops the item straight into the same content
  // list a generated post would land in; everything downstream (Publish,
  // Schedule, Edit, the calendar) treats it identically.
  const handleManualUpload = (newItem) => {
    const stamped = stampOwner(newItem);
    setContent((list) => [stamped, ...list]);
  };

  // Unscheduling/unpublishing removes the synced Google Calendar event too
  // (if one exists) — best-effort, same as creating it.
  const handleUnpublish = (item) => {
    updateContent(item.id, { status: 'draft', gcalEventId: undefined, link: item.siteSlug ? undefined : item.link });
    if (item.gcalEventId) deleteCalendarEvent(item.gcalEventId);
    // Presoft-hosted landing pages go offline straight away.
    if (item.kind === 'landing' && item.siteSlug) {
      unpublishLandingPage(item.id).catch((err) => setContentSaveWarning(`The page couldn't be taken offline (${err.message}). Try Unpublish again.`));
    }
  };

  // Views / WhatsApp clicks for hosted landing pages, refreshed while the
  // Landing Page list is open.
  const [siteStats, setSiteStats] = useState({});
  useEffect(() => {
    if (view !== 'admin-landing') return undefined;
    fetchSiteStats().then(setSiteStats);
    const id = setInterval(() => fetchSiteStats().then(setSiteStats), 30000);
    return () => clearInterval(id);
  }, [view]);

  // Routed through PublishScheduleModal (skipping straight to its
  // 'sequence' stage) instead of updating status inline, so a real landing
  // page's async publish call gets the same progress/error/retry UI as the
  // normal Publish flow instead of firing an instant, unawaited update.
  const handlePublishNowSave = (status, extra) => {
    const item = publishNowItem;
    updateContent(item.id, { status, ...extra });
    setPublishNowItem(null);
    syncGcalOnSchedule(item, status, extra);
  };

  // Published posts can't be edited in place: Regenerate copies one into a
  // new draft (owned by whoever is regenerating) and opens it in the
  // composer, while the published original stays untouched.
  const handleRegenerate = (item) => {
    const { link, scheduledAt, video, gcalEventId, autoPublishError, autoPublishLastAttempt, createdBy, createdByLogin, createdByName, ...rest } = item; // eslint-disable-line no-unused-vars
    const copy = { ...rest, id: `new-${Date.now()}`, status: 'draft', createdAt: new Date().toISOString().slice(0, 10) };
    handleGenerateItemComplete(copy);
    setEditingPostId(copy.id);
  };

  // Duplicate: a new draft copy (owned by whoever duplicates it) that isn't
  // published, scheduled or tied to the original's hosted site.
  const handleDuplicate = (item) => {
    const { link, scheduledAt, video, gcalEventId, autoPublishError, autoPublishLastAttempt, siteSlug, netlifySiteId, createdBy, createdByLogin, createdByName, ...rest } = item; // eslint-disable-line no-unused-vars
    const copy = {
      ...rest,
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'draft',
      title: `${item.title} (copy)`,
      createdAt: new Date().toISOString().slice(0, 10),
      ...(rest.post ? { post: { ...rest.post, siblings: undefined, chat: undefined } } : {}),
      ...(rest.landing ? { landing: { ...rest.landing, publishedHash: undefined, chat: undefined } } : {}),
    };
    handleGenerateItemComplete(copy);
  };

  // Bulk delete from the lists. Removing items from `content` is enough for
  // the server (useContentSync deletes them); scheduled ones lose their
  // calendar event and hosted landing pages are taken offline first.
  const handleDeleteMany = (items) => {
    items.forEach((item) => {
      if (item.gcalEventId) deleteCalendarEvent(item.gcalEventId);
      if (item.kind === 'landing' && item.siteSlug && item.status === 'published') {
        unpublishLandingPage(item.id).catch((err) => setContentSaveWarning(`"${item.title}" was deleted but its page couldn't be taken offline (${err.message}).`));
      }
    });
    const ids = new Set(items.map((i) => i.id));
    setContent((list) => list.filter((c) => !ids.has(c.id)));
  };

  // Landing pages open in the landing editor (older HTML ones are offered a
  // rebuild first); every post opens in the post composer.
  const [editingLandingId, setEditingLandingId] = useState(null);
  const editingLanding = editingLandingId ? content.find((c) => c.id === editingLandingId && c.landing?.page) : null;
  const saveEditedLanding = useCallback((next) => updateContent(next.id, next), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Old HTML landing pages are offered a one-time rebuild into the editor.
  const [rebuildItem, setRebuildItem] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const editingPost = editingPostId ? content.find((c) => c.id === editingPostId && c.kind !== 'landing') : null;
  const openModify = (item) => {
    setPreviewItem(null);
    if (item.kind === 'landing' && item.landing?.page) setEditingLandingId(item.id);
    else if (item.kind === 'landing') setRebuildItem(item);
    else setEditingPostId(item.id);
  };
  // The documents a page was made from (plus the always-on Marketing SOP),
  // for the editor's "Write it from my documents".
  const docsContextFor = (ids = []) =>
    documents
      .filter((d) => d.content && (d.type === 'sop' || ids.includes(d.id)))
      .map((d) => `--- ${d.name} ---\n${d.content}`)
      .join('\n\n');
  const editingDocsContext = editingLanding ? docsContextFor(editingLanding.landing.sourceDocIds) : '';

  const contentCardHandlers = {
    onPreview: setPreviewItem,
    onPublishClick: setPublishItem,
    onModify: openModify,
    onUnpublish: handleUnpublish,
    onPublishNow: setPublishNowItem,
    onRegenerate: handleRegenerate,
    onDuplicate: handleDuplicate,
    onDeleteMany: handleDeleteMany,
  };

  const startGenerate = (kind) => setGenerateKind(kind);

  return (
    <div>
      <TopBar user={user} onLogout={() => guardBrand(onLogout)} view={view} onNavigate={(v) => guardBrand(() => setView(v))} isSuperadmin={isSuperadmin} menuAccess={menuAccess} />

      {contentSaveWarning && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 24px',
            background: 'rgba(220,80,60,0.12)',
            color: 'var(--accent-coral)',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <span>⚠ {contentSaveWarning}</span>
          <button
            onClick={() => setContentSaveWarning('')}
            style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {view === 'admin-landing' && (menuAccess.landingPage ? <LandingPagePage content={visibleContentWithCreator} branches={branches} siteStats={siteStats} {...contentCardHandlers} /> : <NoAccess />)}

      {view === 'admin-post' && (menuAccess.post ? <PostPage content={visibleContentWithCreator} branches={branches} {...contentCardHandlers} onUploadPost={handleManualUpload} /> : <NoAccess />)}

      {view === 'requirement' && (menuAccess.requirement ? (
        <DocumentsPage documents={visibleDocuments} content={content} onAddDocument={addDocument} onRemoveDocument={removeDocument} />
      ) : <NoAccess />)}

      {view === 'generate' && (menuAccess.generate ? <GeneratePage onSelect={startGenerate} /> : <NoAccess />)}

      {view === 'members' && (menuAccess.member ? (
        <MembersPage
          members={members}
          setMembers={setMembers}
          branches={branches}
          setBranches={setBranches}
          companies={companies}
          setCompanies={setCompanies}
          branchCompany={branchCompany}
          setBranchCompany={setBranchCompany}
          permissions={permissions}
          setPermissions={setPermissions}
          currentUser={user}
          isSuperadmin={isSuperadmin}
          canManageAll={canManageAllMembers}
          canManageBranch={canManageBranchMembers}
        />
      ) : <NoAccess />)}

      {view === 'setting-user' && (menuAccess.userSetting ? <UserSettingPage profile={profile} setProfile={setProfile} user={user} onUpdateUser={onUpdateUser} /> : <NoAccess />)}

      {view === 'setting-domain' && (menuAccess.domain ? <DomainPage profile={profile} setProfile={setProfile} /> : <NoAccess />)}

      {view === 'setting-social' && (menuAccess.socialMedia ? <SocialMediaPage profile={profile} setProfile={setProfile} apiKeys={apiKeys} /> : <NoAccess />)}

      {view === 'setting-brand' && (
        <BrandKitPage brandKit={brandKit} onSave={saveBrandKit} onDraftChange={onBrandDraft} documents={visibleDocuments} canEdit={isSuperadmin || isAdmin} />
      )}

      {view === 'setting-api' && (menuAccess.api ? (
        <ApiKeysPage
          apiKeys={apiKeys}
          setApiKeys={setApiKeys}
          user={user}
          personalPostKey={personalPostKey}
          setPersonalPostKey={setPersonalPostKey}
        />
      ) : <NoAccess />)}

      {view === 'superadmin' && (menuAccess.superadmin ? (
        <SuperadminPage currentUser={user} branches={branches} branchCompany={branchCompany} members={members} setMembers={setMembers} />
      ) : <NoAccess />)}

      <ContentPreviewModal
        item={previewItem}
        onClose={() => setPreviewItem(null)}
        onModify={openModify}
        onPublishClick={(item) => { setPreviewItem(null); setPublishItem(item); }}
        onUnpublish={(item) => { handleUnpublish(item); setPreviewItem(null); }}
        onPublishNow={(item) => { setPreviewItem(null); setPublishNowItem(item); }}
        onRegenerate={(item) => { setPreviewItem(null); handleRegenerate(item); }}
        onDuplicate={(item) => { setPreviewItem(null); handleDuplicate(item); }}
      />

      {publishItem && (
        <PublishScheduleModal item={publishItem} profile={profile} onClose={() => setPublishItem(null)} onSave={handlePublishSave} />
      )}

      {publishNowItem && (
        <PublishScheduleModal
          item={publishNowItem}
          profile={profile}
          startAtSequence
          onClose={() => setPublishNowItem(null)}
          onSave={handlePublishNowSave}
        />
      )}

      {generateKind === 'landing' && (
        <LandingCreateFlow
          documents={visibleDocuments}
          brandKit={brandKit}
          onAddDocument={addDocument}
          onCancel={() => !brandOverlay && setGenerateKind(null)}
          onCreated={(newItem) => {
            handleGenerateItemComplete(newItem);
            setGenerateKind(null);
            setView('admin-landing');
            setEditingLandingId(newItem.id);
          }}
          onOpenBrand={() => setBrandOverlay(true)}
        />
      )}

      {editingLanding && (
        <LandingEditor
          key={editingLanding.id}
          item={editingLanding}
          brandKit={brandKit}
          profile={profile}
          onChange={saveEditedLanding}
          onClose={() => setEditingLandingId(null)}
          docsContext={editingDocsContext}
          userName={user?.displayName || user?.username || ''}
        />
      )}

      {rebuildItem && (
        <RebuildModal
          item={rebuildItem}
          brandKit={brandKit}
          onClose={() => setRebuildItem(null)}
          onRebuilt={(page) => {
            updateContent(rebuildItem.id, { landing: { ...rebuildItem.landing, page, goal: 'enquiries', layout: 'complete' } });
            setEditingLandingId(rebuildItem.id);
            setRebuildItem(null);
          }}
        />
      )}

      {generateKind && generateKind !== 'landing' && (
        <PostCreateFlow
          documents={visibleDocuments}
          brandKit={brandKit}
          apiKeys={effectiveApiKeys}
          onAddDocument={addDocument}
          onCancel={() => setGenerateKind(null)}
          onCreated={(items) => {
            items.forEach(handleGenerateItemComplete);
            setGenerateKind(null);
            setView('admin-post');
            setEditingPostId(items[0].id);
          }}
        />
      )}

      {editingPost && (
        <PostEditor
          key={editingPost.id}
          item={editingPost}
          brandKit={brandKit}
          profile={profile}
          apiKeys={effectiveApiKeys}
          docsContext={docsContextFor(editingPost.sourceDocIds)}
          userName={user?.displayName || user?.username || ''}
          siblings={(editingPost.post?.siblings || []).map((id) => content.find((c) => c.id === id)).filter(Boolean)}
          onSwitch={setEditingPostId}
          onChange={saveEditedLanding}
          onOpenBrand={() => setBrandOverlay(true)}
          onClose={() => setEditingPostId(null)}
        />
      )}

      {brandOverlay && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#F2F1EF', overflowY: 'auto' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 2, display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
            <GlassButton variant="ghost" icon={X} onClick={() => guardBrand(() => setBrandOverlay(false))} style={{ padding: '8px 16px', fontSize: 13 }}>Close</GlassButton>
          </div>
          <BrandKitPage brandKit={brandKit} documents={visibleDocuments} canEdit={isSuperadmin || isAdmin} onDraftChange={onBrandDraft}
            onSave={(kit) => { saveBrandKit(kit); setBrandOverlay(false); }} />
        </div>
      )}

      {leaveBrand && <UnsavedChangesDialog what="brand" onSave={() => answerLeaveBrand(true)} onDiscard={() => answerLeaveBrand(false)} onStay={() => setLeaveBrand(null)} />}

      {justPublished && <PublishedDialog item={justPublished.item} republished={justPublished.republished} onClose={() => setJustPublished(null)} />}
    </div>
  );
}
