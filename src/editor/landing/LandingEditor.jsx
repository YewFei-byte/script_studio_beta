import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, CloudUpload, ExternalLink, Loader2, Monitor, Redo2, RotateCcw, Smartphone, Undo2, X } from 'lucide-react';
import { GlassButton } from '../../components/Glass';
import PublishScheduleModal from '../../components/PublishScheduleModal';
import { Segmented } from '../../components/settings/SettingsUI';
import { publishLandingPage } from '../../utils/hosting';
import { announcePublished } from '../../utils/publishEvents';
import { uploadPosterImage } from '../../utils/posterImages';
import { FONT_PAIRS, PALETTES, fontPairById, googleFontsHref, normalizeBrandKit } from '../../../shared/brand.js';
import ChatPanel from '../ChatPanel';
import { renderPage } from '../../../shared/landing/render.js';
import { useUndo } from '../useUndo';
import EditorInspector from './EditorInspector';
import EditorOutline from './EditorOutline';
import { addSection, duplicateSection, getAtPath, removeSection, reorderSections, setAtPath, setText, setTheme, updateSection } from './pageOps';
import { rewriteText, writeSection } from './aiApi';
import { useHistory } from '../useHistory';
import { SECTION_TYPES, tx } from '../../../shared/landing/schema.js';
import { setTextStyle } from '../../../shared/landing/textStyle.js';

// The landing page editor. Everything is a click or a drag; the AI is not
// involved here (that's step 5's ✨ buttons). Every change is undoable and
// autosaved to the item; a live page only changes when "Publish changes"
// is pressed.

const AUTOSAVE_MS = 700;
const DESKTOP_WIDTH = 1280; // the desktop preview is rendered this wide, then zoomed to fit

// Small, stable fingerprint of a page, to tell whether the live version is
// behind the edited one.
export function pageHash(page) {
  const s = JSON.stringify(page || {});
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

function useEditorFonts() {
  useEffect(() => {
    const links = FONT_PAIRS.map((p) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = googleFontsHref(p.id);
      document.head.appendChild(l);
      return l;
    });
    return () => links.forEach((l) => l.remove());
  }, []);
}

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export default function LandingEditor({ item, brandKit, profile, docsContext = '', userName = '', onChange, onClose }) {
  useEditorFonts();
  const kit = normalizeBrandKit(brandKit);
  const { doc: page, commit, undo, redo, canUndo, canRedo, undoLabel, redoLabel } = useUndo(item.landing.page);
  const [lang, setLang] = useState('en');
  const [device, setDevice] = useState('desktop');
  const [selectedId, setSelectedId] = useState(null);
  const [imagePath, setImagePath] = useState(null);
  const [textPath, setTextPath] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [viewing, setViewing] = useState(null); // a History entry being looked at
  const pageRef = useRef(page);
  pageRef.current = page;
  const history = useHistory(`lpHistory:${item.id}`, { page, userName });

  // --- 💬 Ask AI chat -----------------------------------------------------------------
  const [rightTab, setRightTab] = useState('edit'); // edit | chat
  const [chat, setChat] = useState(() => item.landing.chat || []);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [undoable, setUndoable] = useState(null); // { id, before } — the latest AI change, this session
  const saveChat = (next) => {
    setChat(next);
    onChange({ ...itemRef.current, landing: { ...itemRef.current.landing, page: pageRef.current, chat: next.slice(-60) } });
  };
  const sendChat = async (text) => {
    const userMsg = { id: `u${Date.now()}`, role: 'user', text };
    const withUser = [...chat, userMsg];
    setChat(withUser);
    setChatBusy(true);
    setChatError('');
    try {
      const before = pageRef.current;
      const res = await fetch('/api/landing/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: before, request: text, history: chat.map((m) => ({ role: m.role, text: m.text })), brand: kit, goal: item.landing.goal, context: docsContext }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `Something went wrong (${res.status}).`);

      let next = pageRef.current;
      const changes = [];
      const label = (type) => SECTION_TYPES[type]?.label || type;
      for (const e of body.edits || []) {
        const s = next.sections.find((x) => x.id === e.section_id);
        if (!s) continue;
        next = updateSection(next, s.id, { content: { ...s.content, ...e.content } });
        changes.push(`Rewrote ${label(s.type)}`);
      }
      for (const a of body.added || []) {
        const { page: withNew, id } = addSection(next, a.type, a.after_section_id);
        const fresh = withNew.sections.find((x) => x.id === id);
        next = updateSection(withNew, id, { content: { ...fresh.content, ...a.content } });
        changes.push(`Added ${label(a.type)}`);
      }
      for (const id of body.removed || []) {
        const s = next.sections.find((x) => x.id === id);
        if (!s) continue;
        next = removeSection(next, id);
        changes.push(`Removed ${label(s.type)}`);
      }
      const palette = PALETTES.find((p) => p.id === body.palette);
      if (palette) { next = setTheme(next, { colors: { ...palette.colors } }); changes.push(`Colours: ${palette.label}`); }
      if (body.font) { next = setTheme(next, { fontPair: body.font }); changes.push(`Fonts: ${fontPairById(body.font).label}`); }
      if (body.colors && Object.keys(body.colors).length) { next = setTheme(next, { colors: body.colors }); changes.push('Changed page colours'); }
      if (body.button?.bg || body.button?.text) {
        const b = { ...(next.theme?.button || {}) };
        if (body.button.bg) b.bg = body.button.bg;
        if (body.button.text) b.text = body.button.text;
        next = setTheme(next, { button: b });
        changes.push('Changed the WhatsApp button colours');
      }
      for (const st of body.text_styles || []) {
        const idx = next.sections.findIndex((x) => x.id === st.section_id);
        const path = st.section_id === 'page' ? st.field : idx >= 0 ? `sections.${idx}.content.${st.field}` : null;
        if (!path) continue;
        const patch = {};
        if (st.color) patch.color = st.color;
        if (st.size) patch.size = st.size === 'm' ? null : st.size;
        if (st.bold) patch.bold = st.bold === 'bold';
        if (st.align) patch.align = st.align;
        if (!Object.keys(patch).length) continue;
        next = setTextStyle(next, path, patch);
        if (!changes.includes('Changed how some text looks')) changes.push('Changed how some text looks');
      }

      const aiMsg = { id: `a${Date.now()}`, role: 'ai', text: body.reply || (changes.length ? 'Done.' : 'No changes made.'), changes };
      if (changes.length) {
        const short = text.length > 40 ? `${text.slice(0, 40)}…` : text;
        commit(next, { label: `💬 ${short}` });
        history.checkpoint(`💬 ${short}`, next);
        setUndoable({ id: aiMsg.id, before });
      }
      saveChat([...withUser, aiMsg]);
    } catch (err) {
      setChatError(err.message);
      saveChat(withUser);
    } finally {
      setChatBusy(false);
    }
  };
  const undoChat = (id) => {
    if (undoable?.id !== id) return;
    commit(undoable.before, { label: 'Undid AI change' });
    saveChat(chat.map((m) => (m.id === id ? { ...m, undone: true } : m)));
    setUndoable(null);
  };
  const [saveState, setSaveState] = useState('saved'); // saved | saving
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishModal, setPublishModal] = useState(false);
  const iframeRef = useRef(null);
  const stageRef = useRef(null);
  const [stage, setStage] = useState({ w: 1000, h: 700 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const zoom = Math.min(1, stage.w / DESKTOP_WIDTH);
  const scrollY = useRef(0);
  const itemRef = useRef(item);
  itemRef.current = item;

  // --- autosave: every change is written back to the item (and from there
  // to the server, see useContentSync) shortly after it's made.
  const firstRender = useRef(true);
  const unsaved = useRef(false); // an edit is waiting for the autosave timer
  const saveNow = useCallback(() => {
    unsaved.current = false;
    onChange({ ...itemRef.current, landing: { ...itemRef.current.landing, page: pageRef.current } });
    setSaveState('saved');
  }, [onChange]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return undefined; }
    setSaveState('saving');
    unsaved.current = true;
    const t = setTimeout(saveNow, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [page, saveNow]);

  // --- preview ---------------------------------------------------------------------
  const html = useMemo(
    () => (viewing ? renderPage(viewing.page, { lang, still: true }).html : renderPage(page, { lang, editor: true }).html),
    [page, lang, viewing]
  );

  const post = useCallback((msg) => iframeRef.current?.contentWindow?.postMessage(msg, '*'), []);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow || !e.data?.ssEditor) return;
      const m = e.data;
      if (m.type === 'ready') {
        if (scrollY.current) post({ type: 'scrollTo', y: scrollY.current });
        if (selectedId) post({ type: 'select', id: selectedId });
      } else if (m.type === 'scroll') {
        scrollY.current = m.y;
      } else if (m.type === 'select') {
        setSelectedId(m.id);
        setImagePath(null);
        setTextPath(null);
        setAiError('');
      } else if (m.type === 'textFocus') {
        setTextPath(m.plain ? null : m.path);
      } else if (m.type === 'text') {
        commit(setText(page, m.path, lang, m.value, m.plain), { label: 'Edited text' });
      } else if (m.type === 'image') {
        setImagePath(m.path);
        setTextPath(null);
      } else if (m.type === 'video') {
        setImagePath(null);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [page, lang, commit, post, selectedId]);

  const selectFromOutline = (id) => {
    setSelectedId(id);
    setImagePath(null);
    post({ type: 'select', id, scroll: true });
  };

  const upload = useCallback(async (file) => {
    try {
      const url = await uploadPosterImage(await readAsDataUrl(file));
      return url;
    } catch {
      return null;
    }
  }, []);

  // --- ✨ AI ------------------------------------------------------------------------
  const runAi = async (fn) => {
    setAiBusy(true);
    setAiError('');
    try {
      await fn();
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiBusy(false);
    }
  };

  const ai = {
    busy: aiBusy,
    error: aiError,
    // One text: both languages are rewritten together.
    rewrite: (path, action, label) => runAi(async () => {
      const current = pageRef.current;
      const idx = Number(String(path).split('.')[1]);
      const hero = current.sections.find((s) => s.type === 'hero');
      const value = getAtPath(current, path);
      const res = await rewriteText({
        text: typeof value === 'string' ? { en: value, zh: '' } : value,
        path,
        sectionType: current.sections[idx]?.type,
        action,
        brand: kit,
        pageTitle: tx(hero?.content?.title, 'en'),
      });
      const next = setAtPath(pageRef.current, path, { en: res.en, zh: res.zh });
      commit(next, { label: `✨ ${label}` });
      history.checkpoint(`✨ ${label}`, next);
    }),
    // One section: written from the documents, or changed per the request.
    // Photos, links and other non-text fields are kept.
    writeSection: (id, request) => runAi(async () => {
      const current = pageRef.current;
      const section = current.sections.find((s) => s.id === id);
      if (!section) return;
      const others = current.sections
        .filter((s) => s.id !== id)
        .map((s) => `${SECTION_TYPES[s.type]?.label}: ${tx(s.content?.title, 'en')}`)
        .join('; ');
      const { content } = await writeSection({
        type: section.type,
        goal: item.landing.goal,
        brand: kit,
        context: docsContext,
        pageSummary: `${current.brand?.name || kit.companyName}. ${others}`,
        current: request ? section.content : undefined,
        request,
      });
      const latest = pageRef.current.sections.find((s) => s.id === id) || section;
      const next = updateSection(pageRef.current, id, { content: { ...latest.content, ...content } });
      const short = request && request.length > 40 ? `${request.slice(0, 40)}…` : request;
      const label = request ? `✨ ${short}` : `✨ Wrote ${SECTION_TYPES[section.type]?.label || 'section'}`;
      commit(next, { label });
      history.checkpoint(label, next);
    }),
  };

  const restore = (entry) => {
    commit(entry.page, { label: 'Restored a version' });
    history.checkpoint(`Restored "${entry.label}"`, entry.page);
    setViewing(null);
    setShowHistory(false);
  };

  const close = () => {
    if (unsaved.current) saveNow(); // don't lose the last moment of typing
    history.flushEdits();
    onClose();
  };

  // --- publishing ------------------------------------------------------------------
  const isLive = item.status === 'published' && !!item.siteSlug;
  const hash = pageHash(page);
  const behind = isLive && item.landing.publishedHash !== hash;

  const publishChanges = async () => {
    setPublishing(true);
    setPublishError('');
    try {
      const current = { ...itemRef.current, landing: { ...itemRef.current.landing, page } };
      const { link, siteSlug } = await publishLandingPage(current, item.siteSlug);
      onChange({ ...current, link, siteSlug, landing: { ...current.landing, publishedHash: hash } });
      history.checkpoint('Published changes', page);
      announcePublished({ ...current, link, siteSlug }, { republished: true });
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const outline = {
    onSelect: selectFromOutline,
    onReorder: (ids) => commit(reorderSections(page, ids), { label: 'Reordered sections', mergeKey: 'reorder' }),
    onToggleHidden: (id) => {
      const s = page.sections.find((x) => x.id === id);
      commit(updateSection(page, id, { hidden: !s?.hidden }), { label: s?.hidden ? 'Showed section' : 'Hid section' });
    },
    onDuplicate: (id) => commit(duplicateSection(page, id), { label: 'Duplicated section' }),
    onRemove: (id) => {
      commit(removeSection(page, id), { label: 'Deleted section' });
      if (selectedId === id) setSelectedId(null);
    },
    onAdd: (type) => {
      const { page: next, id } = addSection(page, type, selectedId);
      commit(next, { label: 'Added section' });
      setSelectedId(id);
      setTimeout(() => post({ type: 'select', id, scroll: true }), 400);
    },
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: '#F2F1EF', display: 'flex', flexDirection: 'column' }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(80,69,56,0.1)', background: 'rgba(255,255,255,0.7)', flexWrap: 'wrap' }}>
        <button type="button" onClick={close} aria-label="Close editor" title="Close"
          style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(80,69,56,0.12)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <X size={17} />
        </button>
        <div style={{ minWidth: 0, flex: '1 1 160px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
          <p style={{ fontSize: 11.5, color: 'var(--ink-500)', display: 'flex', alignItems: 'center', gap: 5 }}>
            {saveState === 'saving' ? <><Loader2 size={11} className="spin" /> Saving…</> : <><Check size={11} /> Saved</>}
            {isLive && (behind ? ' · Live page has older changes' : ' · Live page is up to date')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={undo} disabled={!canUndo} title={canUndo ? `Undo: ${undoLabel}` : 'Nothing to undo'} aria-label="Undo" style={toolBtn(!canUndo)}><Undo2 size={16} /></button>
          <button type="button" onClick={redo} disabled={!canRedo} title={canRedo ? `Redo: ${redoLabel}` : 'Nothing to redo'} aria-label="Redo" style={toolBtn(!canRedo)}><Redo2 size={16} /></button>
        </div>
        <button type="button" onClick={() => { setShowHistory((v) => !v); setViewing(null); }} title="History: saved versions of this page" aria-label="History"
          style={{ ...toolBtn(false), width: 'auto', padding: '0 12px', gap: 6, fontSize: 12.5, fontWeight: 600, background: showHistory ? 'rgba(242,170,36,0.14)' : 'white', borderColor: showHistory ? 'var(--accent-violet)' : 'rgba(80,69,56,0.12)' }}>
          <Clock size={15} /> History
        </button>
        <Segmented options={[{ id: 'desktop', label: 'Desktop', icon: Monitor }, { id: 'mobile', label: 'Phone', icon: Smartphone }]} value={device} onChange={setDevice} />
        <Segmented options={[{ id: 'en', label: 'EN' }, { id: 'zh', label: '中文' }]} value={lang} onChange={setLang} />
        {isLive && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" title="Open the live page"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--accent-violet)', textDecoration: 'none' }}>
            <ExternalLink size={13} /> View live
          </a>
        )}
        {isLive ? (
          <GlassButton variant="primary" icon={publishing ? Loader2 : CloudUpload} disabled={!behind || publishing} onClick={publishChanges} style={{ padding: '9px 16px', fontSize: 13 }}>
            {publishing ? 'Publishing…' : behind ? 'Publish changes' : 'Published'}
          </GlassButton>
        ) : (
          <GlassButton variant="primary" onClick={() => setPublishModal(true)} style={{ padding: '9px 18px', fontSize: 13 }}>Publish</GlassButton>
        )}
      </div>
      {publishError && <p style={{ padding: '8px 16px', fontSize: 12.5, color: 'var(--accent-coral)', background: 'rgba(217,0,0,0.06)' }}>Couldn't publish: {publishError}</p>}
      {viewing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'rgba(242,170,36,0.14)', fontSize: 13, flexWrap: 'wrap' }}>
          <Clock size={14} />
          <span style={{ flex: 1 }}>Viewing an earlier version: <b>{viewing.label}</b> ({new Date(viewing.at).toLocaleString()}). Read-only.</span>
          <GlassButton variant="primary" icon={RotateCcw} onClick={() => restore(viewing)} style={{ padding: '6px 14px', fontSize: 12.5 }}>Restore this version</GlassButton>
          <GlassButton variant="ghost" onClick={() => setViewing(null)} style={{ padding: '6px 14px', fontSize: 12.5 }}>Back to current</GlassButton>
        </div>
      )}

      {/* body */}
      <div className="lp-editor-body" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '264px minmax(0,1fr) 300px' }}>
        <aside style={{ borderRight: '1px solid rgba(80,69,56,0.1)', background: 'rgba(255,255,255,0.45)', minHeight: 0 }}>
          <EditorOutline page={page} selectedId={selectedId} videoEnabled={kit.optionalSections.video} {...outline} />
        </aside>
        <main style={{ minHeight: 0, overflow: device === 'mobile' ? 'auto' : 'clip', display: 'flex', justifyContent: 'center', padding: device === 'mobile' ? '20px 0' : 12 }}>
          <div ref={stageRef} style={{ position: 'relative', width: '100%', height: device === 'mobile' ? 'auto' : '100%', display: 'flex', justifyContent: 'center' }}>
            {device === 'mobile' ? (
              <iframe ref={iframeRef} title="Page editor" srcDoc={html} sandbox="allow-scripts"
                style={{ width: 390, height: 800, border: '10px solid #1d1d1f', borderRadius: 36, background: 'white', flexShrink: 0, boxShadow: '0 10px 40px rgba(80,69,56,0.10)' }} />
            ) : (
              <div style={{ width: DESKTOP_WIDTH * zoom, height: stage.h, borderRadius: 12, overflow: 'clip', border: '1px solid rgba(80,69,56,0.12)', boxShadow: '0 10px 40px rgba(80,69,56,0.10)', background: 'white', flexShrink: 0 }}>
                <iframe ref={iframeRef} title="Page editor" srcDoc={html} sandbox="allow-scripts"
                  style={{ width: DESKTOP_WIDTH, height: stage.h / zoom, border: 0, transform: `scale(${zoom})`, transformOrigin: '0 0', display: 'block' }} />
              </div>
            )}
          </div>
        </main>
        <aside style={{ borderLeft: '1px solid rgba(80,69,56,0.1)', background: 'rgba(255,255,255,0.6)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {!showHistory && (
            <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0' }}>
              {[['edit', 'Edit'], ['chat', 'Ask AI']].map(([id, text]) => (
                <button key={id} type="button" onClick={() => setRightTab(id)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 0, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: rightTab === id ? 'white' : 'transparent', color: rightTab === id ? 'var(--ink-900)' : 'var(--ink-500)', boxShadow: rightTab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                  {text}
                </button>
              ))}
            </div>
          )}
          {rightTab === 'chat' && !showHistory ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <ChatPanel messages={chat} busy={chatBusy} error={chatError} onSend={sendChat} onUndo={undoChat} undoableId={undoable?.id}
                placeholder="e.g. Add a section about our 3 outlets"
                suggestions={['Make the whole page sound more premium', 'Add an FAQ about delivery times', 'Use calmer colours']} />
            </div>
          ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
          <EditorInspector page={page} brandKit={kit} lang={lang} selectedId={selectedId} imagePath={imagePath} textPath={textPath}
            commit={commit} upload={upload} onSelect={(id) => { setSelectedId(id); post({ type: 'select', id }); }}
            onCloseImage={() => setImagePath(null)} onCloseText={() => setTextPath(null)} ai={ai}
            history={showHistory ? { entries: history.entries, previewId: viewing?.id, onPreview: setViewing, onRestore: restore, onClose: () => { setShowHistory(false); setViewing(null); } } : null} />
          </div>
          )}
        </aside>
      </div>

      {publishModal && (
        <PublishScheduleModal item={{ ...item, landing: { ...item.landing, page } }} profile={profile} onClose={() => setPublishModal(false)}
          onSave={(status, extra) => {
            const published = status === 'published';
            onChange({ ...itemRef.current, status, ...extra, landing: { ...itemRef.current.landing, page, ...(published ? { publishedHash: hash } : {}) } });
            if (published) history.checkpoint('Published', page);
            setPublishModal(false);
          }} />
      )}
    </div>
  );
}

const toolBtn = (disabled) => ({
  width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(80,69,56,0.12)', background: 'white',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, color: 'var(--ink-700)',
});
