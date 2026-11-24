import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Circle as CircleIcon, Clock, Copy, ImagePlus, Loader2, Plus, Redo2, RotateCcw, Sparkles, Square, Trash2, Type, Undo2, X, ZoomIn, ZoomOut, RectangleHorizontal, Image as ImageIcon } from 'lucide-react';
import { GlassButton } from '../../components/Glass';
import PublishScheduleModal from '../../components/PublishScheduleModal';
import { generatePosterImages } from '../../utils/aiProvider';
import { uploadPosterImage } from '../../utils/posterImages';
import { normalizeBrandKit } from '../../../shared/brand.js';
import ChatPanel from '../ChatPanel';
import { HistoryPanel } from '../landing/EditorAiPanels';
import { useHistory } from '../useHistory';
import LayersPanel from './LayersPanel';
import { useUndo } from '../useUndo';
import CaptionPanel, { stripTags } from './CaptionPanel';
import PostCanvas from './PostCanvas';
import PostInspector from './PostInspector';
import { MAX_SLIDES, SIZES, TEMPLATES, applyTemplate, pageTemplateId, createDesign, designFromOldPost, imageGenSize, layerId, newImageLayer, newShapeLayer, newTextLayer, PLATFORM_SIZE } from './design';
import { designHash, exportAndUpload } from './exportDesign';

// The post composer: a canvas you drag things around on, with templates,
// sizes, slides, a caption panel and an Ask AI chat. Every change is
// undoable and autosaved; the finished pictures (post.images, which
// publishing uses) are re-exported whenever the design changed.

const PLATFORM_LABEL = { ig: 'Instagram', fb: 'Facebook', xhs: 'RedNote', yt: 'YouTube' };
const AUTOSAVE_MS = 700;
const PANEL_ERRORS = ['caption', 'chat']; // shown inside their own tab, not in the top bar
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3]; // times "fit to screen"
const CLIPBOARD_KEY = 'postClipboard'; // a copied layer, so it pastes into other slides and posts

const readClipboard = () => { try { return JSON.parse(localStorage.getItem(CLIPBOARD_KEY) || 'null'); } catch { return null; } };
const writeClipboard = (l) => { try { localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(l)); } catch { /* private mode etc. */ } };
const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

const imageAspect = (url) => new Promise((resolve) => { const i = new window.Image(); i.onload = () => resolve(i.height / i.width || 1); i.onerror = () => resolve(1); i.src = url; });

// The words a slide leads with, so Ask AI knows what the other carousel slides say.
const slideHeadline = (p) => (p.layers.find((l) => l.type === 'text' && l.role === 'headline') || p.layers.find((l) => l.type === 'text'))?.text || '';
const readAsDataUrl = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status}).`);
  return data;
}

function LeftBlock({ title, children }) {
  return (
    <div style={{ padding: '0 14px 16px' }}>
      <p style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>{title}</p>
      {children}
    </div>
  );
}

const tool = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(183,169,154,0.35)', background: 'white', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)', cursor: 'pointer' };

export default function PostEditor({ item, brandKit, profile, apiKeys, docsContext = '', userName = '', siblings = [], onSwitch, onChange, onClose, onOpenBrand }) {
  const kit = normalizeBrandKit(brandKit);
  const initialDesign = useMemo(() => item.post?.design || designFromOldPost(item.post, PLATFORM_SIZE[item.kind]), [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const { doc, commit, undo, redo, canUndo, canRedo, undoLabel, redoLabel } = useUndo({ design: initialDesign, caption: item.post?.caption || '' });
  const { design, caption } = doc;
  const [pageIdx, setPageIdx] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [rightTab, setRightTab] = useState('design'); // design | layers | caption | chat
  const [zoom, setZoom] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const [viewing, setViewing] = useState(null); // a history entry shown read-only
  const history = useHistory(`postHistory:${item.id}`, { page: doc, userName });
  const measureRef = useRef(null);
  const clipboard = useRef(null);
  const [saveState, setSaveState] = useState('saved');
  const [busy, setBusy] = useState(''); // '' | 'bg' | 'export' | 'caption' | 'chat'
  const [error, setError] = useState(null); // { kind, message } — kind says which panel shows it
  const [publishItem, setPublishItem] = useState(null);
  const [chat, setChat] = useState(() => item.post?.chat || []);
  const [undoable, setUndoable] = useState(null);
  const textRef = useRef(null);
  const stageBox = useRef(null);
  const bgInput = useRef(null);
  const picInput = useRef(null);
  const [dropping, setDropping] = useState(false);
  const [box, setBox] = useState({ w: 600, h: 600 });
  const itemRef = useRef(item);
  itemRef.current = item;
  const docRef = useRef(doc);
  docRef.current = doc;

  // While viewing an old version, the canvas and slides show it instead.
  const shown = viewing ? viewing.page.design : design;
  const shownIdx = Math.min(pageIdx, shown.pages.length - 1);
  const page = design.pages[pageIdx] || design.pages[0];
  const size = SIZES[shown.size] || SIZES.square;
  const layer = page.layers.find((l) => l.id === selectedId) || null;

  useEffect(() => {
    const el = stageBox.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fitScale = Math.max(0.1, Math.min(box.w / size.w, box.h / size.h)); // box is inside the stage's 20px padding
  const scale = fitScale * zoom;
  const zoomBy = (dir) => setZoom((z) => ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + dir))] ?? 1);
  // Ctrl + mouse wheel zooms (a native listener, since React's wheel events can't preventDefault).
  useEffect(() => {
    const el = stageBox.current;
    if (!el) return undefined;
    const onWheel = (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1 : -1); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- autosave (design + caption + chat) -----------------------------------------------
  // The title follows the first headline, unless it was named something else
  // (e.g. "… (copy)" from Duplicate).
  const saveItem = useCallback((extra = {}) => {
    const cur = itemRef.current;
    const d = docRef.current.design;
    const headlineOf = (des) => des?.pages?.[0]?.layers.find((l) => l.role === 'headline')?.text;
    const follows = !cur.title || !cur.post?.design || cur.title === headlineOf(cur.post.design);
    onChange({ ...cur, title: (follows && headlineOf(d)) || cur.title, post: { ...cur.post, design: d, caption: docRef.current.caption, ...extra } });
  }, [onChange]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setSaveState('saving');
    const t = setTimeout(() => { saveItem(); setSaveState('saved'); }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- edits ----------------------------------------------------------------------------
  // Reads the latest doc (not this render's), so edits made after an upload
  // finishes don't undo changes made while it was uploading.
  const setPage = (fn, label, mergeKey) => {
    const cur = docRef.current;
    const pages = cur.design.pages.map((p, i) => (i === pageIdx ? fn(p) : p));
    commit({ ...cur, design: { ...cur.design, pages } }, { label, mergeKey });
  };
  const changeLayer = (id, patch, label = 'Moved', mergeKey) => setPage((p) => ({ ...p, layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }), label, mergeKey || `${id}.${Object.keys(patch).join(',')}`);
  const addLayer = (l) => { setPage((p) => ({ ...p, layers: [...p.layers, l] }), 'Added'); setSelectedId(l.id); setRightTab('design'); };
  const removeLayer = (id) => { setPage((p) => ({ ...p, layers: p.layers.filter((l) => l.id !== id) }), 'Deleted'); setSelectedId(null); };
  const reorderLayer = (id, toFront) => setPage((p) => {
    const l = p.layers.find((x) => x.id === id);
    const rest = p.layers.filter((x) => x.id !== id);
    return { ...p, layers: toFront ? [...rest, l] : [l, ...rest] };
  }, toFront ? 'Brought to front' : 'Sent to back');
  const pasteLayer = (l) => addLayer({ ...l, id: layerId(), x: Math.min(0.9, l.x + 0.03), y: Math.min(0.9, l.y + 0.03) });
  const duplicateLayer = (id) => {
    const l = page.layers.find((x) => x.id === id);
    if (l) pasteLayer(l);
  };
  // Layers panel: move to a position in the stack (0 = back).
  const moveLayerTo = (id, to) => setPage((p) => {
    const l = p.layers.find((x) => x.id === id);
    const rest = p.layers.filter((x) => x.id !== id);
    rest.splice(Math.max(0, Math.min(rest.length, to)), 0, l);
    return { ...p, layers: rest };
  }, 'Reordered layers');
  // Align buttons: shift the layer so its box lines up with the post's edge or centre.
  const alignLayer = (id, where) => {
    const l = page.layers.find((x) => x.id === id);
    const b = measureRef.current?.(id);
    if (!l || !b) return;
    const target = { left: [0], center: [0.5 - b.w / 2], right: [1 - b.w], top: [null, 0], middle: [null, 0.5 - b.h / 2], bottom: [null, 1 - b.h] }[where];
    changeLayer(id, target[0] != null ? { x: l.x + target[0] - b.x } : { y: l.y + target[1] - b.y }, 'Aligned');
  };
  // Whole-design edits; like setPage, they start from the latest doc.
  const setDesign = (fn, label) => { const cur = docRef.current; commit({ ...cur, design: fn(cur.design) }, { label }); };
  const setTemplate = (tid) => setDesign((d) => ({ ...d, templateId: tid, pages: d.pages.map((p, i) => (i === pageIdx ? applyTemplate(p, tid) : p)) }), 'Changed layout');
  const setSize = (sid) => setDesign((d) => ({ ...d, size: sid }), 'Changed size');
  const setCaption = (text, label = 'Edited caption', mergeKey) => commit({ ...docRef.current, caption: text }, { label, mergeKey });

  // Keyboard (not while typing, or while looking at an old version):
  // Ctrl+C / V / D copy, paste, duplicate; Ctrl+= / - / 0 zoom; Delete and
  // arrows act on the selected layer; Escape deselects.
  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(e.target) || viewing) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomBy(1); return; }
      if (mod && k === '-') { e.preventDefault(); zoomBy(-1); return; }
      if (mod && k === '0') { e.preventDefault(); setZoom(1); return; }
      if (mod && k === 'v') {
        const l = readClipboard() || clipboard.current;
        if (l) { e.preventDefault(); pasteLayer(l); }
        return;
      }
      if (!selectedId || !layer) return;
      if (mod && k === 'c' && !window.getSelection()?.toString()) { clipboard.current = layer; writeClipboard(layer); return; }
      if (mod && k === 'd') { e.preventDefault(); duplicateLayer(selectedId); return; }
      if (e.key === 'Escape') { setSelectedId(null); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeLayer(selectedId); return; }
      const step = e.shiftKey ? 0.02 : 0.004;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d && !layer.locked) { e.preventDefault(); changeLayer(selectedId, { x: layer.x + d[0], y: layer.y + d[1] }, 'Nudged', `${selectedId}.nudge`); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- slides -----------------------------------------------------------------------------
  // Instagram and Facebook carousels take at most 10 pictures.
  const full = design.pages.length >= MAX_SLIDES;
  const addSlide = () => {
    if (full) return;
    setDesign((d) => {
      const cur = d.pages[pageIdx] || d.pages[0];
      const blank = createDesign({ sizeId: d.size, templateId: pageTemplateId(d, cur), copy: { headline: 'Next slide', subline: '' }, backgroundUrl: cur.background.url }).pages[0];
      return { ...d, pages: [...d.pages, blank] };
    }, 'Added slide');
    setPageIdx(design.pages.length);
  };
  const duplicateSlide = () => {
    if (full) return;
    setDesign((d) => {
      const cur = d.pages[pageIdx] || d.pages[0];
      const copy = { ...structuredClone(cur), id: layerId(), layers: cur.layers.map((l) => ({ ...l, id: layerId() })) };
      const pages = [...d.pages];
      pages.splice(pageIdx + 1, 0, copy);
      return { ...d, pages };
    }, 'Duplicated slide');
    setPageIdx(pageIdx + 1);
  };
  const moveSlide = (dir) => {
    const to = pageIdx + dir;
    if (to < 0 || to >= design.pages.length) return;
    setDesign((d) => {
      const pages = [...d.pages];
      [pages[pageIdx], pages[to]] = [pages[to], pages[pageIdx]];
      return { ...d, pages };
    }, 'Moved slide');
    setPageIdx(to);
  };
  const removeSlide = () => {
    if (design.pages.length < 2) return;
    setDesign((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== pageIdx) }), 'Deleted slide');
    setPageIdx(Math.max(0, pageIdx - 1));
  };

  // --- background ---------------------------------------------------------------------------
  // Jobs can nest (Ask AI may make a new photo), so busy is a stack: the
  // inner job finishing hands busy back to the outer one. Resolves true on success.
  const busyStack = useRef([]);
  const run = async (kind, fn) => {
    busyStack.current.push(kind);
    setBusy(kind);
    setError(null);
    try { await fn(); return true; } catch (err) { setError({ kind, message: err.message }); return false; } finally {
      busyStack.current.splice(busyStack.current.lastIndexOf(kind), 1);
      setBusy(busyStack.current[busyStack.current.length - 1] || '');
    }
  };
  const uploadBg = (file) => file && run('bg', async () => {
    const url = await uploadPosterImage(await readAsDataUrl(file));
    setPage((p) => ({ ...p, background: { ...p.background, url } }), 'Changed photo');
  });
  // A picture layer on top of the background (drag, resize, rotate like text).
  const addPicture = (file) => file?.type?.startsWith('image/') && run('pic', async () => {
    const url = await uploadPosterImage(await readAsDataUrl(file));
    addLayer(newImageLayer(url, await imageAspect(url), size.w / size.h));
  });
  const replacePicture = (id, file) => file && run('pic', async () => {
    const url = await uploadPosterImage(await readAsDataUrl(file));
    changeLayer(id, { url }, 'Replaced picture');
  });
  const pictureToBackground = (l) => {
    setPage((p) => ({ ...p, background: { ...p.background, url: l.url }, layers: p.layers.filter((x) => x.id !== l.id) }), 'Used picture as background');
    setSelectedId(null);
  };
  const newAiBackground = (prompt) => run('bg', async () => {
    if (!apiKeys?.post) throw new Error('No image AI key is set yet. Add one under Settings → API.');
    const [img] = await generatePosterImages({ provider: apiKeys.postProvider || 'openai', model: apiKeys.postModel, apiKey: apiKeys.post, n: 1, size: imageGenSize(design.size),
      prompt: `${prompt || item.post?.imagePrompt || 'A clean, bright product photo with empty space for text.'} Photographic. No text, words, letters or logos in the image.` });
    const url = await uploadPosterImage(img);
    const pages = docRef.current.design.pages.map((p, i) => (i === pageIdx ? { ...p, background: { ...p.background, url } } : p));
    const next = { ...docRef.current, design: { ...docRef.current.design, pages } };
    commit(next, { label: '✨ New photo' });
    history.checkpoint('✨ New photo', next);
  });

  // --- caption AI ---------------------------------------------------------------------------
  const rewriteCaption = (action, label, keepTags) => run('caption', async () => {
    const { caption: text } = await post('/api/posts/caption', { caption: stripTags(caption), action, platform: item.kind, language: item.post?.language, brand: kit });
    const tags = (item.post?.hashtags || []).map((h) => `#${String(h).replace(/^#/, '')}`).join(' ');
    setCaption(keepTags && tags ? `${text}\n\n${tags}` : text, `✨ ${label}`);
  });

  // --- chat ---------------------------------------------------------------------------------
  const saveChat = (next) => { setChat(next); saveItem({ chat: next.slice(-60) }); };
  const sendChat = (text) => run('chat', async () => {
    const userMsg = { id: `u${Date.now()}`, role: 'user', text };
    const withUser = [...chat, userMsg];
    setChat(withUser);
    try {
      const before = docRef.current;
      const plan = await post('/api/posts/chat', { request: text, history: chat.map((m) => ({ role: m.role, text: m.text })), design: { ...before.design, templateId: pageTemplateId(before.design, before.design.pages[pageIdx]), pages: [before.design.pages[pageIdx]] }, slideIndex: pageIdx, slideCount: before.design.pages.length, otherSlides: before.design.pages.filter((_, i) => i !== pageIdx).map(slideHeadline), caption: before.caption, platform: item.kind, language: item.post?.language, brand: kit, context: docsContext });
      let next = before;
      const changes = [];
      const editPage = (fn) => { next = { ...next, design: { ...next.design, pages: next.design.pages.map((p, i) => (i === pageIdx ? fn(p) : p)) } }; };
      // Words first (they refer to the current layers), then a layout switch,
      // which carries the words over by role.
      if (plan.text_changes?.length) {
        editPage((p) => ({ ...p, layers: p.layers.map((l) => { const c = plan.text_changes.find((x) => x.layer_id === l.id); return c ? { ...l, text: c.text } : l; }) }));
        changes.push(`Changed ${plan.text_changes.length} text${plan.text_changes.length > 1 ? 's' : ''} on the image`);
      }
      if (plan.template && plan.template !== pageTemplateId(next.design, next.design.pages[pageIdx])) {
        next = { ...next, design: { ...next.design, templateId: plan.template } };
        editPage((p) => applyTemplate(p, plan.template));
        changes.push(`Layout: ${TEMPLATES.find((t) => t.id === plan.template)?.label}`);
      }
      if (plan.overlay) {
        editPage((p) => ({ ...p, background: { ...p.background, overlay: plan.overlay === 'none' ? null : { color: p.background.overlay?.color || 'black', opacity: p.background.overlay?.opacity ?? 0.35, gradient: plan.overlay === 'fade' ? 'bottom' : undefined } } }));
        changes.push('Changed photo darkening');
      }
      if (plan.caption?.trim()) { next = { ...next, caption: plan.caption }; changes.push('Rewrote the caption'); }
      const aiMsg = { id: `a${Date.now()}`, role: 'ai', text: plan.reply || (changes.length ? 'Done.' : 'No changes made.'), changes };
      if (changes.length) {
        commit(next, { label: `💬 ${text.slice(0, 40)}` });
        history.checkpoint(`💬 ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`, next);
        setUndoable({ id: aiMsg.id, before });
      }
      saveChat([...withUser, aiMsg]);
      if (plan.new_background && await newAiBackground(plan.background_prompt)) {
        saveChat([...withUser, { ...aiMsg, changes: [...changes, 'Made a new photo'] }]);
      }
    } catch (err) {
      saveChat(withUser);
      throw err;
    }
  });
  const undoChat = (id) => {
    if (undoable?.id !== id) return;
    commit(undoable.before, { label: 'Undid AI change' });
    saveChat(chat.map((m) => (m.id === id ? { ...m, undone: true } : m)));
    setUndoable(null);
  };

  // --- export + close / publish ---------------------------------------------------------------
  const exportIfNeeded = async () => {
    const hash = designHash(docRef.current.design, kit);
    if (hash === itemRef.current.post?.exportedHash && itemRef.current.post?.images?.length) return itemRef.current.post.images;
    const images = await exportAndUpload(docRef.current.design, kit);
    saveItem({ images, exportedHash: hash });
    return images;
  };
  // Save anything the autosave hasn't written yet, then export. If the export
  // fails, a second click on X closes anyway (the design itself is saved).
  const [closeAnyway, setCloseAnyway] = useState(false);
  const leave = async (then) => {
    saveItem();
    history.flushEdits();
    if (closeAnyway) { then(); return; }
    if (await run('export', exportIfNeeded)) then();
    else setCloseAnyway(true);
  };
  const close = () => leave(onClose);
  const openPublish = () => run('export', async () => {
    const images = await exportIfNeeded();
    const cur = itemRef.current;
    setPublishItem({ ...cur, post: { ...cur.post, design: docRef.current.design, caption: docRef.current.caption, images } });
  });

  const restore = (entry) => {
    commit(entry.page, { label: 'Restored a version' });
    history.checkpoint(`Restored "${entry.label}"`, entry.page);
    setViewing(null);
    setShowHistory(false);
    setPageIdx(0);
    setSelectedId(null);
  };
  const closeHistory = () => { setShowHistory(false); setViewing(null); };

  const options = item.post?.captionOptions || [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: '#F2F1EF', display: 'flex', flexDirection: 'column' }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(80,69,56,0.1)', background: 'rgba(255,255,255,0.7)', flexWrap: 'wrap' }}>
        <button type="button" onClick={close} disabled={busy === 'export'} aria-label="Close editor" title="Close"
          style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(80,69,56,0.12)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          {busy === 'export' ? <Loader2 size={16} className="spin" /> : <X size={17} />}
        </button>
        <div style={{ minWidth: 0, flex: '1 1 160px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{PLATFORM_LABEL[item.kind] || 'Post'} · {item.title}</p>
          <p style={{ fontSize: 11.5, color: 'var(--ink-500)', display: 'flex', alignItems: 'center', gap: 5 }}>
            {saveState === 'saving' ? <><Loader2 size={11} className="spin" /> Saving…</> : <><Check size={11} /> Saved</>}
          </p>
        </div>
        {siblings.length > 1 && (
          // The same post was made for several platforms: each is its own draft.
          <div title="This post was also made for these platforms. Each one is a separate draft you edit and publish on its own."
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 3, borderRadius: 10, background: 'rgba(80,69,56,0.06)' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-500)', padding: '0 6px' }}>Same post for</span>
            {siblings.map((sib) => (
              <button key={sib.id} type="button" disabled={sib.id === item.id || busy === 'export'} onClick={() => leave(() => onSwitch?.(sib.id))}
                style={{ padding: '6px 10px', borderRadius: 8, border: 0, fontSize: 12, fontWeight: 700, cursor: sib.id === item.id ? 'default' : 'pointer',
                  background: sib.id === item.id ? 'white' : 'transparent', color: sib.id === item.id ? 'var(--ink-900)' : 'var(--ink-500)', boxShadow: sib.id === item.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {PLATFORM_LABEL[sib.kind] || sib.kind}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={undo} disabled={!canUndo} title={canUndo ? `Undo: ${undoLabel}` : 'Nothing to undo'} aria-label="Undo" style={topBtn(!canUndo)}><Undo2 size={16} /></button>
        <button type="button" onClick={redo} disabled={!canRedo} title={canRedo ? `Redo: ${redoLabel}` : 'Nothing to redo'} aria-label="Redo" style={topBtn(!canRedo)}><Redo2 size={16} /></button>
        <button type="button" onClick={() => (showHistory ? closeHistory() : setShowHistory(true))} title="History: saved versions of this post" aria-label="History"
          style={{ ...topBtn(false), width: 'auto', padding: '0 12px', gap: 6, fontSize: 12.5, fontWeight: 600, background: showHistory ? 'rgba(242,170,36,0.14)' : 'white', borderColor: showHistory ? 'var(--accent-violet)' : 'rgba(80,69,56,0.12)' }}>
          <Clock size={15} /> History
        </button>
        <GlassButton variant="primary" onClick={openPublish} disabled={!!busy} style={{ padding: '9px 18px', fontSize: 13 }}>
          {item.status === 'published' ? 'Post again' : 'Publish'}
        </GlassButton>
      </div>
      {error && !PANEL_ERRORS.includes(error.kind) && (
        <p style={{ padding: '8px 16px', fontSize: 12.5, color: 'var(--accent-coral)', background: 'rgba(217,0,0,0.06)' }}>
          {error.message}{closeAnyway && error.kind === 'export' && ' Your design is saved. Click X again to close without updating the pictures.'}
        </p>
      )}
      {viewing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: 'rgba(242,170,36,0.14)', fontSize: 13, flexWrap: 'wrap' }}>
          <Clock size={14} />
          <span style={{ flex: 1 }}>Viewing an earlier version: <b>{viewing.label}</b> ({new Date(viewing.at).toLocaleString()}). Read-only.</span>
          <GlassButton variant="primary" icon={RotateCcw} onClick={() => restore(viewing)} style={{ padding: '6px 14px', fontSize: 12.5 }}>Restore this version</GlassButton>
          <GlassButton variant="ghost" onClick={() => setViewing(null)} style={{ padding: '6px 14px', fontSize: 12.5 }}>Back to current</GlassButton>
        </div>
      )}

      <div className="lp-editor-body" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '250px minmax(0,1fr) 310px' }}>
        {/* left */}
        <aside inert={viewing ? true : undefined} style={{ borderRight: '1px solid rgba(80,69,56,0.1)', background: 'rgba(255,255,255,0.45)', minHeight: 0, overflowY: 'auto', paddingTop: 14, opacity: viewing ? 0.45 : 1 }}>
          <LeftBlock title="Add">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button type="button" style={tool} onClick={() => addLayer(newTextLayer())}><Type size={14} /> Text</button>
              <button type="button" style={tool} disabled={busy === 'pic'} onClick={() => picInput.current?.click()}>{busy === 'pic' ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} Picture</button>
              <button type="button" style={tool} title={kit.logoUrl ? 'Add your logo' : 'Set up your logo first'} onClick={() => (kit.logoUrl ? addLayer({ id: layerId(), type: 'logo', x: 0.4, y: 0.06, w: 0.2 }) : onOpenBrand?.())}><ImageIcon size={14} /> Logo</button>
              <button type="button" style={tool} onClick={() => addLayer(newShapeLayer('rect'))}><Square size={14} /> Box</button>
              <button type="button" style={tool} onClick={() => addLayer(newShapeLayer('circle'))}><CircleIcon size={14} /> Circle</button>
              <button type="button" style={tool} onClick={() => addLayer({ ...newShapeLayer('pill'), radius: 99 })}><RectangleHorizontal size={14} /> Pill</button>
            </div>
            <input ref={picInput} type="file" accept="image/*" hidden onChange={(e) => { addPicture(e.target.files?.[0]); e.target.value = ''; }} />
            <p style={{ fontSize: 11.5, color: 'var(--ink-300)', marginTop: 8 }}>Tip: drag a picture from your computer onto the post.</p>
          </LeftBlock>
          <LeftBlock title="Background photo">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" style={tool} disabled={busy === 'bg'} onClick={() => bgInput.current?.click()}><ImagePlus size={14} /> Change background</button>
              <button type="button" style={{ ...tool, borderColor: 'rgba(242,170,36,0.45)', background: 'rgba(242,170,36,0.08)', color: '#8A5A00' }} disabled={busy === 'bg'} onClick={() => newAiBackground()}>
                {busy === 'bg' ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {busy === 'bg' ? 'Making a photo…' : 'New AI photo'}
              </button>
              <input ref={bgInput} type="file" accept="image/*" hidden onChange={(e) => { uploadBg(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </LeftBlock>
          <LeftBlock title="Layout">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                  style={{ ...tool, justifyContent: 'center', fontSize: 12, borderColor: pageTemplateId(design, page) === t.id ? 'var(--accent-violet)' : 'rgba(183,169,154,0.35)', background: pageTemplateId(design, page) === t.id ? 'rgba(242,170,36,0.12)' : 'white' }}>{t.label}</button>
              ))}
            </div>
          </LeftBlock>
          <LeftBlock title="Size">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.values(SIZES).map((sz) => (
                <button key={sz.id} type="button" onClick={() => setSize(sz.id)}
                  style={{ ...tool, borderColor: design.size === sz.id ? 'var(--accent-violet)' : 'rgba(183,169,154,0.35)', background: design.size === sz.id ? 'rgba(242,170,36,0.12)' : 'white' }}>
                  <span style={{ width: 16, height: 16 * (sz.h / sz.w), maxHeight: 22, border: '1.5px solid currentColor', borderRadius: 3, flexShrink: 0 }} /> {sz.label}
                </button>
              ))}
            </div>
          </LeftBlock>
        </aside>

        {/* canvas + slides */}
        <main style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div ref={stageBox}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropping(false); }}
            onDrop={(e) => { e.preventDefault(); setDropping(false); addPicture(e.dataTransfer.files?.[0]); }}
            style={{ flex: 1, minHeight: 0, display: 'flex', overflow: zoom > 1 ? 'auto' : 'hidden', padding: 20, position: 'relative', outline: dropping ? '3px dashed var(--accent-violet)' : 'none', outlineOffset: -10 }}>
            {(dropping || busy === 'pic') && (
              <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 2, padding: '8px 14px', borderRadius: 999, background: 'var(--ink-900)', color: 'white', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
                {busy === 'pic' ? <><Loader2 size={13} className="spin" /> Adding picture…</> : 'Drop to add the picture'}
              </div>
            )}
            <div style={{ margin: 'auto', flexShrink: 0, boxShadow: '0 12px 40px rgba(80,69,56,0.18)', borderRadius: 6, overflow: 'hidden', lineHeight: 0 }}>
              <PostCanvas design={shown} pageIndex={shownIdx} brand={kit} scale={scale} editable={!viewing} selectedId={viewing ? null : selectedId} measureRef={measureRef}
                onSelect={(id) => { setSelectedId(id); if (id && rightTab !== 'layers') setRightTab('design'); }}
                onChangeLayer={(id, patch) => changeLayer(id, patch)}
                onEditText={(id) => { setSelectedId(id); setRightTab('design'); setTimeout(() => textRef.current?.focus(), 50); }} />
            </div>
          </div>
          {/* zoom (also Ctrl + wheel, Ctrl + = / - / 0) */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', right: 14, bottom: 10, zIndex: 3, display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 10, background: 'white', border: '1px solid rgba(80,69,56,0.12)', boxShadow: '0 2px 8px rgba(80,69,56,0.1)' }}>
              <button type="button" title="Zoom out" aria-label="Zoom out" disabled={zoom === ZOOMS[0]} onClick={() => zoomBy(-1)} style={zoomBtn(zoom === ZOOMS[0])}><ZoomOut size={15} /></button>
              <span style={{ minWidth: 44, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--ink-700)' }}>{Math.round(scale * 100)}%</span>
              <button type="button" title="Zoom in" aria-label="Zoom in" disabled={zoom === ZOOMS[ZOOMS.length - 1]} onClick={() => zoomBy(1)} style={zoomBtn(zoom === ZOOMS[ZOOMS.length - 1])}><ZoomIn size={15} /></button>
              <button type="button" title="Fit to screen" onClick={() => setZoom(1)} style={{ ...zoomBtn(zoom === 1), width: 'auto', padding: '0 8px', fontSize: 12, fontWeight: 600 }}>Fit</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid rgba(80,69,56,0.1)', overflowX: 'auto' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4, whiteSpace: 'nowrap' }}>{shown.pages.length > 1 ? `Slide ${shownIdx + 1} / ${shown.pages.length}` : 'Slides'}</span>
            {shown.pages.map((p, i) => (
              <button key={p.id} type="button" onClick={() => { setPageIdx(i); setSelectedId(null); }}
                style={{ padding: 2, borderRadius: 8, border: `2px solid ${i === shownIdx ? 'var(--accent-violet)' : 'transparent'}`, background: 'none', cursor: 'pointer', lineHeight: 0, flexShrink: 0 }}>
                <div style={{ pointerEvents: 'none', borderRadius: 5, overflow: 'hidden' }}><PostCanvas design={shown} pageIndex={i} brand={kit} scale={56 / size.h} /></div>
              </button>
            ))}
            {!viewing && <>
            <button type="button" title={full ? `${MAX_SLIDES} slides is the most a carousel can have` : 'Add a slide'} disabled={full} onClick={addSlide} style={{ ...tool, padding: '8px', opacity: full ? 0.4 : 1 }}><Plus size={15} /></button>
            <button type="button" title="Duplicate this slide" disabled={full} onClick={duplicateSlide} style={{ ...tool, padding: '8px', opacity: full ? 0.4 : 1 }}><Copy size={15} /></button>
            {design.pages.length > 1 && <>
              <button type="button" title="Move this slide left" disabled={pageIdx === 0} onClick={() => moveSlide(-1)} style={{ ...tool, padding: '8px', opacity: pageIdx === 0 ? 0.4 : 1 }}><ChevronLeft size={15} /></button>
              <button type="button" title="Move this slide right" disabled={pageIdx === design.pages.length - 1} onClick={() => moveSlide(1)} style={{ ...tool, padding: '8px', opacity: pageIdx === design.pages.length - 1 ? 0.4 : 1 }}><ChevronRight size={15} /></button>
            </>}
            {design.pages.length > 1 && <button type="button" title="Delete this slide" onClick={removeSlide} style={{ ...tool, padding: '8px', color: 'var(--accent-coral)' }}><Trash2 size={15} /></button>}
            </>}
          </div>
        </main>

        {/* right */}
        <aside style={{ borderLeft: '1px solid rgba(80,69,56,0.1)', background: 'rgba(255,255,255,0.6)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {showHistory ? (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 12 }}>
              <HistoryPanel entries={history.entries} previewId={viewing?.id} onPreview={setViewing} onRestore={restore} onClose={closeHistory} what="post" />
            </div>
          ) : <>
          <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0' }}>
            {[['design', 'Design'], ['layers', 'Layers'], ['caption', 'Caption'], ['chat', 'Ask AI']].map(([id, text]) => (
              <button key={id} type="button" onClick={() => setRightTab(id)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 0, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: rightTab === id ? 'white' : 'transparent', color: rightTab === id ? 'var(--ink-900)' : 'var(--ink-500)', boxShadow: rightTab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {text}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: rightTab === 'chat' ? 'hidden' : 'auto' }}>
            {rightTab === 'design' && (
              <PostInspector ref={textRef} layer={layer} page={page} colors={kit.colors} hasLogo={!!kit.logoUrl} onOpenBrand={onOpenBrand}
                picture={layer?.type === 'image' ? { busy: busy === 'pic', onReplace: (file) => replacePicture(layer.id, file), onMakeBackground: () => pictureToBackground(layer) } : null}
                onLayer={(patch, label, mergeKey) => changeLayer(layer.id, patch, label, mergeKey)}
                onPage={(bgPatch) => setPage((p) => ({ ...p, background: { ...p.background, ...bgPatch } }), 'Changed photo darkening', 'overlay')}
                actions={layer ? { onDelete: () => removeLayer(layer.id), onDuplicate: () => duplicateLayer(layer.id), onForward: () => reorderLayer(layer.id, true), onBackward: () => reorderLayer(layer.id, false), onAlign: (where) => alignLayer(layer.id, where) } : null} />
            )}
            {rightTab === 'layers' && (
              <LayersPanel layers={page.layers} selectedId={selectedId} onSelect={setSelectedId} onMove={moveLayerTo}
                onPatch={(id, patch, label) => changeLayer(id, patch, label, `${id}.meta`)} />
            )}
            {rightTab === 'caption' && (
              <CaptionPanel caption={caption} options={options} hashtags={item.post?.hashtags || []} busy={busy === 'caption'} error={error?.kind === 'caption' ? error.message : ''}
                onChange={setCaption} onRewrite={rewriteCaption} />
            )}
            {rightTab === 'chat' && (
              <ChatPanel messages={chat} busy={busy === 'chat' || (busy === 'bg' && rightTab === 'chat')} error={error?.kind === 'chat' ? error.message : ''} onSend={sendChat} onUndo={undoChat} undoableId={undoable?.id}
                placeholder="e.g. Make the headline shout the 20% discount"
                suggestions={['Make it feel more premium', 'Shorter caption with a stronger hook', 'Give me a brighter photo']} />
            )}
          </div>
          </>}
        </aside>
      </div>

      {publishItem && (
        <PublishScheduleModal item={publishItem} profile={profile} onClose={() => setPublishItem(null)}
          onSave={(status, extra) => {
            onChange({ ...publishItem, status, ...extra });
            if (status === 'published') history.checkpoint('Published', docRef.current);
            setPublishItem(null);
            if (status !== 'draft') onClose();
          }} />
      )}
    </div>
  );
}

const zoomBtn = (disabled) => ({
  width: 28, height: 28, borderRadius: 8, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, color: 'var(--ink-700)',
});

const topBtn = (disabled) => ({
  width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(80,69,56,0.12)', background: 'white',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, color: 'var(--ink-700)',
});
