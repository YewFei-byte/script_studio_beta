import React, { useRef, useState } from 'react';
import { ArrowLeft, Check, FileText, ImagePlus, Loader2, Minus, Plus, ShieldCheck, Sparkles, UploadCloud, X } from 'lucide-react';
import Modal from '../../components/Modal';
import { GlassButton } from '../../components/Glass';
import { Bone, SkeletonStatus } from '../../components/Skeleton';
import { extractDocumentText } from '../../utils/extractText';
import { uploadPosterImage } from '../../utils/posterImages';
import { generatePosterImages } from '../../utils/aiProvider';
import { normalizeBrandKit } from '../../../shared/brand.js';
import { icon } from '../../../shared/landing/icons.js';
import PostCanvas from './PostCanvas';
import { MAX_SLIDES, PLATFORM_SIZE, SIZES, TEMPLATES, createCarouselDesign, createDesign, imageGenSize } from './design';
import { exportAndUpload, designHash } from './exportDesign';

// "Create post": documents → platforms, format & count → goal & language →
// pick AI angles → template → (optional) photo → generation → a draft per
// platform, each at its own size, opened in the composer.
//   Single posts: one picked angle per post, each with its own photo.
//   Carousel:     one angle told over N slides, all sharing one photo.

const PLATFORMS = [
  { id: 'ig', label: 'Instagram', hint: 'Portrait 4:5' },
  { id: 'fb', label: 'Facebook', hint: 'Square 1:1' },
  { id: 'xhs', label: 'RedNote', hint: 'Tall 3:4' },
];
const GOALS = [
  { id: 'product', label: 'Show a product', icon: 'shopping-bag' },
  { id: 'promo', label: 'Promotion or sale', icon: 'gift' },
  { id: 'awareness', label: 'Introduce the business', icon: 'building-store' },
  { id: 'event', label: 'Announce an event', icon: 'calendar' },
  { id: 'tips', label: 'Share a tip', icon: 'sparkles' },
  { id: 'festive', label: 'Festive greeting', icon: 'star' },
];
const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '中文' },
  { id: 'ms', label: 'Bahasa Malaysia' },
];
const FORMATS = {
  single: { label: 'Single post', hint: 'One picture per post', min: 1, max: 4, start: 1, count: 'Posts' },
  carousel: { label: 'Carousel', hint: 'Swipeable slides, one story', min: 3, max: MAX_SLIDES, start: 5, count: 'Slides' },
};
const CANCELLED = new Error('cancelled');
const STEPS = ['docs', 'setup', 'angle', 'template'];
const SAMPLE_COPY = { headline: 'Your headline here', subline: 'A short line about the offer', cta: 'WhatsApp us', badge: '20% OFF' };
// Sample words for a carousel slide by its place: cover, a middle point, the last call to action.
const slideSample = (i, n) =>
  i === 0 ? { headline: 'Your hook here', subline: 'Swipe to see more' }
  : i === n - 1 ? { headline: 'Ready to try?', subline: 'Message us today', cta: 'WhatsApp us' }
  : { headline: `Point number ${i}`, subline: 'One clear detail about it' };
const slideName = (i, n) => (i === 0 ? 'Cover' : i === n - 1 ? 'Last' : `Slide ${i + 1}`);

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status}).`);
  return data;
}

function Pill({ active, onClick, children, sub }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
        border: `2px solid ${active ? 'var(--accent-violet)' : 'rgba(183,169,154,0.3)'}`, background: active ? 'rgba(242,170,36,0.10)' : 'rgba(255,255,255,0.6)' }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)', display: 'flex', alignItems: 'center', gap: 6 }}>{active && <Check size={14} />}{children}</span>
      {sub && <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>{sub}</span>}
    </button>
  );
}

function Stepper({ value, min, max, onChange, unit }) {
  const btn = (disabled) => ({ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(183,169,154,0.45)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, color: 'var(--ink-700)' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} role="group" aria-label={unit}>
      <button type="button" aria-label="Fewer" disabled={value <= min} onClick={() => onChange(value - 1)} style={btn(value <= min)}><Minus size={15} /></button>
      <span style={{ minWidth: 64, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>{value} {(value === 1 ? unit.slice(0, -1) : unit).toLowerCase()}</span>
      <button type="button" aria-label="More" disabled={value >= max} onClick={() => onChange(value + 1)} style={btn(value >= max)}><Plus size={15} /></button>
    </div>
  );
}

function PostSkeleton({ sizeId, slides }) {
  const w = 220;
  const h = Math.round(w * (SIZES[sizeId].h / SIZES[sizeId].w));
  return (
    <div style={{ display: 'flex', gap: 22, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }} aria-hidden="true">
      <div>
        <div className="skeleton" style={{ width: w, height: h, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Bone w="80%" h={18} style={{ background: 'rgba(255,255,255,0.55)' }} />
          <Bone w="55%" h={18} style={{ background: 'rgba(255,255,255,0.55)' }} />
          <Bone w="70%" h={9} style={{ background: 'rgba(255,255,255,0.45)', marginTop: 6 }} />
          <span style={{ flex: 1 }} />
          <Bone w={92} h={26} r={999} style={{ background: 'rgba(255,255,255,0.55)' }} />
        </div>
        {slides > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {Array.from({ length: Math.min(slides, 6) }, (_, i) => <Bone key={i} w={30} h={Math.round(30 * (h / w))} r={5} style={{ opacity: i ? 0.6 : 1 }} />)}
          </div>
        )}
      </div>
      <div style={{ width: 230, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 4 }}>
        <Bone w={70} h={10} />
        <Bone h={10} /><Bone h={10} /><Bone w="85%" h={10} /><Bone w="60%" h={10} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {[64, 80, 52, 72].map((x, i) => <Bone key={i} w={x} h={20} r={999} />)}
        </div>
      </div>
    </div>
  );
}

const label = { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-500)', margin: '0 0 8px' };

export default function PostCreateFlow({ documents, brandKit, apiKeys, onAddDocument, onCancel, onCreated }) {
  const kit = normalizeBrandKit(brandKit);
  const [stage, setStage] = useState('docs');
  const usable = documents.filter((d) => d.type !== 'guidance');
  const sop = usable.filter((d) => d.type === 'sop');
  const others = usable.filter((d) => d.type !== 'sop');
  const [selected, setSelected] = useState(() => others.map((d) => d.id));
  const [platforms, setPlatforms] = useState(['ig']);
  const [goal, setGoal] = useState('product');
  const [language, setLanguage] = useState('en');
  const [notes, setNotes] = useState('');
  const [angles, setAngles] = useState(null);
  const [picked, setPicked] = useState([]);
  const [format, setFormat] = useState('single');
  const [count, setCount] = useState(1);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  // Carousel: a layout per slide (index -> id; unset slides use templateId) and the slide being picked for.
  const [slideTemplates, setSlideTemplates] = useState({});
  const [activeSlide, setActiveSlide] = useState(0);
  const [photo, setPhoto] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [readingDoc, setReadingDoc] = useState(false);
  const docInput = useRef(null);
  const photoInput = useRef(null);

  const context = usable
    .filter((d) => (selected.includes(d.id) || d.type === 'sop') && d.content)
    .map((d) => `--- ${d.name} ---\n${d.content}`)
    .join('\n\n');
  const base = { brand: kit, goal, language, context, notes: notes.trim() };
  const imageKey = apiKeys?.post;
  const sizeId = PLATFORM_SIZE[platforms[0]] || 'square';
  const carousel = format === 'carousel';
  // Several single posts: one angle each, so the angle step picks up to `count`.
  const multi = !carousel && count > 1;
  const chooseFormat = (f) => { setFormat(f); setCount(FORMATS[f].start); };
  const tplFor = (i) => slideTemplates[i] || templateId;
  const slide = Math.min(activeSlide, count - 1);
  const pickTemplate = (id) => {
    if (!carousel) return setTemplateId(id);
    setSlideTemplates((s) => ({ ...s, [slide]: id }));
    if (slide < count - 1) setActiveSlide(slide + 1); // move on to the next slide
  };
  const useForAll = () => { setTemplateId(tplFor(slide)); setSlideTemplates({}); };
  const allSame = Array.from({ length: count }, (_, i) => tplFor(i)).every((id, _, a) => id === a[0]);

  const addDoc = async (file) => {
    if (!file) return;
    setReadingDoc(true);
    setError('');
    try {
      const { content } = await extractDocumentText(file);
      const id = `d${Date.now()}`;
      onAddDocument({ id, name: file.name, type: 'other', uploadedAt: new Date().toISOString().slice(0, 10), content: content || undefined });
      setSelected((s) => [...s, id]);
    } catch {
      setError(`Couldn't read "${file.name}". Try a different PDF or a .txt file.`);
    } finally {
      setReadingDoc(false);
    }
  };

  const loadAngles = async () => {
    setStage('angle');
    setBusy('angles');
    setError('');
    setPicked([]);
    try {
      const { angles: list } = await post('/api/posts/angles', { ...base, count: multi ? count : 1 });
      setAngles(list);
      setPicked(list.slice(0, multi ? count : 1));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const onPhoto = (file) => {
    if (!file) return;
    setUploading(true);
    const r = new FileReader();
    r.onload = async () => {
      try { setPhoto(await uploadPosterImage(r.result)); } catch { setError(`Couldn't upload "${file.name}".`); } finally { setUploading(false); }
    };
    r.onerror = () => setUploading(false);
    r.readAsDataURL(file);
  };

  const pickAngle = (a) => {
    if (!multi) return setPicked([a]);
    setPicked((s) => (s.includes(a) ? s.filter((x) => x !== a) : s.length < count ? [...s, a] : s));
  };

  // The user's photo, else one AI photo for this copy (if an image key is set).
  const photoFor = async (copy, of = '') => {
    if (photo || !imageKey) return photo;
    setBusy(`Creating the photo${of}`);
    const [img] = await generatePosterImages({
      provider: apiKeys.postProvider || 'openai',
      model: apiKeys.postModel,
      apiKey: imageKey,
      n: 1,
      size: imageGenSize(sizeId),
      prompt: `${copy.imagePrompt} Brand colours to echo subtly: ${kit.colors.primary}, ${kit.colors.accent}.`,
    });
    return uploadPosterImage(img);
  };

  // One draft per platform for this copy; makeDesign(sizeId) lays it out.
  const buildItems = async (copy, makeDesign, idPart, a) => {
    const items = [];
    const tags = copy.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ');
    for (const p of platforms) {
      const design = makeDesign(PLATFORM_SIZE[p]);
      const options = copy.captions.find((c) => c.platform === p)?.options || copy.captions[0]?.options || [];
      const images = await exportAndUpload(design, kit);
      items.push({
        id: `new-${idPart}-${p}`,
        status: 'draft',
        createdAt: new Date().toISOString().slice(0, 10),
        kind: p,
        title: (copy.slides?.[0] || copy).headline,
        guidance: `${GOALS.find((g) => g.id === goal)?.label}. ${a?.title || ''}`,
        sourceDocIds: selected,
        post: {
          design,
          images,
          exportedHash: designHash(design, kit),
          caption: options[0] ? `${options[0]}\n\n${tags}` : tags,
          captionOptions: options,
          hashtags: copy.hashtags,
          language,
          goal,
          imagePrompt: copy.imagePrompt,
          ...(carousel ? { format: 'carousel' } : {}),
        },
      });
    }
    // The same post in several sizes: each draft knows the others, so the
    // editor can switch between them.
    if (items.length > 1) {
      const siblings = items.map((it) => it.id);
      items.forEach((it) => { it.post.siblings = siblings; });
    }
    return items;
  };

  // Cancel can't stop requests already sent; it just ignores their answers
  // (checked after every step, so a cancelled run never creates drafts).
  const runId = useRef(0);
  const cancelCreate = () => { runId.current += 1; setBusy(''); setStage('template'); };

  const create = async () => {
    const run = ++runId.current;
    // Throws once cancelled, so no further photos are made and no drafts created.
    const live = (v) => { if (run !== runId.current) throw CANCELLED; return v; };
    setStage('generating');
    setError('');
    try {
      const stamp = Date.now();
      const items = [];
      if (carousel) {
        setBusy(`Writing the ${count} slides`);
        const copy = live(await post('/api/posts/copy', { ...base, angle: picked[0], platforms, format: 'carousel', slides: count }));
        const background = live(await photoFor(copy));
        setBusy('Laying out your carousel');
        items.push(...live(await buildItems(copy, (sz) => createCarouselDesign({ sizeId: sz, templateIds: copy.slides.map((_, i) => tplFor(i)), slides: copy.slides, backgroundUrl: background }), stamp, picked[0])));
      } else {
        const n = picked.length;
        setBusy(n > 1 ? `Writing ${n} posts` : 'Writing the post');
        const copies = live(await Promise.all(picked.map((a) => post('/api/posts/copy', { ...base, angle: a, platforms }))));
        for (const [k, copy] of copies.entries()) {
          const of = n > 1 ? ` for post ${k + 1} of ${n}` : '';
          const background = live(await photoFor(copy, of));
          setBusy(`Laying out your post${of}`);
          const words = { headline: copy.headline, subline: copy.subline, cta: copy.cta, badge: copy.badge };
          items.push(...live(await buildItems(copy, (sz) => createDesign({ sizeId: sz, templateId, copy: words, backgroundUrl: background }), n > 1 ? `${stamp}-${k}` : stamp, picked[k])));
        }
      }
      onCreated(items);
    } catch (err) {
      if (err === CANCELLED || run !== runId.current) return;
      setError(err.message);
      setStage('template');
    } finally {
      if (run === runId.current) setBusy('');
    }
  };

  const stepIdx = STEPS.indexOf(stage);
  const drafts = (carousel ? 1 : picked.length || 1) * platforms.length;
  const createLabel = carousel
    ? `Create ${count}-slide carousel${platforms.length > 1 ? ` (${platforms.length} sizes)` : ''}`
    : `Create ${drafts > 1 ? `${drafts} posts` : 'post'}`;
  const footer = (onBack, onNext, nextLabel = 'Continue', disabled = false, nextIcon) => (
    <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
      {onBack && <GlassButton variant="ghost" icon={ArrowLeft} onClick={onBack} style={{ padding: '11px 18px' }}>Back</GlassButton>}
      <GlassButton variant="primary" icon={nextIcon} disabled={disabled} onClick={onNext} style={{ flex: 1, justifyContent: 'center' }}>{nextLabel}</GlassButton>
    </div>
  );

  return (
    <Modal open onClose={onCancel} dismissible={stage !== 'generating'} width={stage === 'template' ? 900 : 720}>
      {stage !== 'generating' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }} aria-hidden="true">
          {STEPS.map((s, k) => <span key={s} style={{ height: 4, flex: 1, borderRadius: 4, background: k <= stepIdx ? 'var(--accent-violet)' : 'rgba(80,69,56,0.12)' }} />)}
        </div>
      )}

      {stage === 'docs' && (
        <>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>What should the post be about?</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 16 }}>The AI only uses facts from these.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {sop.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(242,170,36,0.45)', background: 'rgba(242,170,36,0.07)' }}>
                <ShieldCheck size={17} color="var(--accent-violet)" /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{d.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)' }}>Always included</span>
              </div>
            ))}
            {others.map((d) => {
              const on = selected.includes(d.id);
              return (
                <button key={d.id} type="button" onClick={() => setSelected((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id]))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', border: `1px solid ${on ? 'rgba(242,170,36,0.45)' : 'rgba(183,169,154,0.3)'}`, background: on ? 'rgba(242,170,36,0.07)' : 'rgba(255,255,255,0.55)' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? 'var(--accent-violet)' : 'rgba(80,69,56,0.3)'}`, background: on ? 'var(--accent-violet)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <Check size={13} color="white" strokeWidth={3} />}</span>
                  <FileText size={16} color="var(--ink-500)" /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{d.name}</span>
                </button>
              );
            })}
            {!usable.length && <p style={{ fontSize: 13, color: 'var(--ink-500)' }}>No documents yet. Add a product sheet so the post has real details.</p>}
          </div>
          <input ref={docInput} type="file" accept=".pdf,.txt,.md" hidden onChange={(e) => { addDoc(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" onClick={() => docInput.current?.click()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 10, padding: 11, borderRadius: 12, border: '1.5px dashed rgba(183,169,154,0.6)', background: 'transparent', color: 'var(--ink-500)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {readingDoc ? <Loader2 size={16} className="spin" /> : <UploadCloud size={16} />} {readingDoc ? 'Reading…' : 'Add a document'}
          </button>
          {error && <p style={{ fontSize: 13, color: 'var(--accent-coral)', marginTop: 10 }}>{error}</p>}
          {footer(null, () => setStage('setup'))}
        </>
      )}

      {stage === 'setup' && (
        <>
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>Where, what and in which language?</h2>
          <p style={label}>Platforms (one post each, sized for it)</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p.id);
              return <Pill key={p.id} active={on} sub={p.hint} onClick={() => setPlatforms((s) => (on ? (s.length > 1 ? s.filter((x) => x !== p.id) : s) : [...s, p.id]))}>{p.label}</Pill>;
            })}
          </div>
          <p style={label}>Format</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
            {Object.entries(FORMATS).map(([id, f]) => <Pill key={id} active={format === id} sub={f.hint} onClick={() => chooseFormat(id)}>{f.label}</Pill>)}
            <span style={{ flex: 1 }} />
            <Stepper value={count} min={FORMATS[format].min} max={FORMATS[format].max} unit={FORMATS[format].count} onChange={setCount} />
          </div>
          <p style={label}>Goal</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8, marginBottom: 18 }}>
            {GOALS.map((g) => (
              <button key={g.id} type="button" onClick={() => setGoal(g.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', border: `2px solid ${goal === g.id ? 'var(--accent-violet)' : 'rgba(183,169,154,0.3)'}`, background: goal === g.id ? 'rgba(242,170,36,0.10)' : 'rgba(255,255,255,0.6)' }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(242,170,36,0.16)', color: '#B7791F', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: icon(g.icon, { size: 18 }) }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)' }}>{g.label}</span>
              </button>
            ))}
          </div>
          <p style={label}>Language</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {LANGUAGES.map((l) => <Pill key={l.id} active={language === l.id} onClick={() => setLanguage(l.id)}>{l.label}</Pill>)}
          </div>
          <p style={label}>Anything specific? <span style={{ fontWeight: 500, color: 'var(--ink-300)' }}>(optional)</span></p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={600} placeholder="e.g. 10% off drip bags this weekend only"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(183,169,154,0.45)', background: 'white', fontSize: 13.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          {footer(() => setStage('docs'), loadAngles, 'Suggest ideas', false, Sparkles)}
        </>
      )}

      {stage === 'angle' && (
        <>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>{multi ? `Pick up to ${count} ideas` : 'Pick an idea'}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 16 }}>
            {multi ? `Each idea becomes its own post (${picked.length} of ${count} picked).` : carousel ? `The carousel tells this idea over ${count} slides.` : 'Three different takes.'} You can edit every word later.
          </p>
          {busy === 'angles' && (
            <div role="status" aria-label="Thinking of ideas" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from({ length: multi ? Math.max(3, Math.min(count, 6)) : 3 }, (_, i) => (
                <div key={i} style={{ padding: '14px 16px', borderRadius: 14, border: '2px solid rgba(183,169,154,0.2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Bone w={`${40 + ((i * 17) % 25)}%`} h={14} />
                  <Bone w="92%" h={10} />
                </div>
              ))}
            </div>
          )}
          {angles && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {angles.map((a, i) => (
                <button key={i} type="button" onClick={() => pickAngle(a)}
                  style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 14, cursor: 'pointer', border: `2px solid ${picked.includes(a) ? 'var(--accent-violet)' : 'rgba(183,169,154,0.3)'}`, background: picked.includes(a) ? 'rgba(242,170,36,0.10)' : 'rgba(255,255,255,0.6)' }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>{a.title}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)', lineHeight: 1.5 }}>{a.hook}</span>
                </button>
              ))}
            </div>
          )}
          {error && <p style={{ fontSize: 13, color: 'var(--accent-coral)', marginTop: 12 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <GlassButton variant="ghost" icon={ArrowLeft} onClick={() => setStage('setup')} style={{ padding: '11px 18px' }}>Back</GlassButton>
            <GlassButton variant="ghost" onClick={loadAngles} disabled={busy === 'angles'} style={{ padding: '11px 18px' }}>New ideas</GlassButton>
            <GlassButton variant="primary" disabled={!picked.length} onClick={() => setStage('template')} style={{ flex: 1, justifyContent: 'center' }}>Continue</GlassButton>
          </div>
        </>
      )}

      {stage === 'template' && (
        <>
          <h2 style={{ fontSize: 22, marginBottom: 4 }}>{carousel ? 'Pick a look for each slide' : 'Pick a look'}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-500)', marginBottom: 14 }}>
            {carousel ? `Choosing for ${slide === 0 ? 'the cover' : slide === count - 1 ? 'the last slide' : `slide ${slide + 1}`}. Pick one and it moves to the next slide.` : 'In your brand colours.'} Change it any time in the editor.
          </p>
          {carousel && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {Array.from({ length: count }, (_, i) => {
                const on = i === slide;
                const d = createDesign({ sizeId, templateId: tplFor(i), copy: slideSample(i, count), backgroundUrl: photo });
                return (
                  <button key={i} type="button" onClick={() => setActiveSlide(i)} aria-pressed={on} aria-label={`${slideName(i, count)}: ${TEMPLATES.find((t) => t.id === tplFor(i))?.label}`}
                    style={{ padding: 3, borderRadius: 10, cursor: 'pointer', border: `2px solid ${on ? 'var(--accent-violet)' : 'transparent'}`, background: on ? 'rgba(242,170,36,0.10)' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ borderRadius: 6, overflow: 'hidden', pointerEvents: 'none', lineHeight: 0 }}><PostCanvas design={d} brand={kit} scale={52 / SIZES[sizeId].w} /></div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: on ? 'var(--ink-900)' : 'var(--ink-500)' }}>{slideName(i, count)}</span>
                  </button>
                );
              })}
              <span style={{ flex: 1 }} />
              <GlassButton variant="ghost" icon={Check} disabled={allSame} onClick={useForAll} style={{ padding: '9px 14px', fontSize: 13 }}>
                {allSame ? 'Same look on all slides' : `Use ${TEMPLATES.find((t) => t.id === tplFor(slide))?.label} for all slides`}
              </GlassButton>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {TEMPLATES.map((t) => {
              const on = (carousel ? tplFor(slide) : templateId) === t.id;
              const d = createDesign({ sizeId, templateId: t.id, copy: carousel ? slideSample(slide, count) : SAMPLE_COPY, backgroundUrl: photo });
              const scale = 150 / SIZES[sizeId].w;
              return (
                <button key={t.id} type="button" onClick={() => pickTemplate(t.id)}
                  style={{ padding: 8, borderRadius: 14, cursor: 'pointer', border: `2px solid ${on ? 'var(--accent-violet)' : 'rgba(183,169,154,0.3)'}`, background: on ? 'rgba(242,170,36,0.10)' : 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ borderRadius: 8, overflow: 'hidden', pointerEvents: 'none' }}><PostCanvas design={d} brand={kit} scale={scale} /></div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-900)' }}>{t.label}</span>
                </button>
              );
            })}
          </div>

          <p style={{ ...label, marginTop: 18 }}>Photo</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {photo ? (
              <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden' }}>
                <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" aria-label="Remove photo" onClick={() => setPhoto('')} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 999, border: 0, background: 'rgba(0,0,0,0.55)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={11} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => photoInput.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 12, border: '1.5px dashed rgba(183,169,154,0.6)', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--ink-500)', cursor: 'pointer' }}>
                {uploading ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />} Use my own photo
              </button>
            )}
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            <span style={{ fontSize: 12.5, color: 'var(--ink-500)', flex: 1, minWidth: 200 }}>
              {photo ? 'Your photo will be used.' : imageKey ? 'Or leave it and AI creates a photo to match the post (no text in it).' : 'No image AI key is set (Settings → API), so a brand-colour background is used unless you add a photo.'}
            </span>
          </div>
          {error && <p style={{ fontSize: 13, color: 'var(--accent-coral)', marginTop: 12 }}>{error}</p>}
          {footer(() => setStage('angle'), create, error ? 'Try again' : createLabel, uploading, Sparkles)}
        </>
      )}

      {stage === 'generating' && (
        <div style={{ padding: '14px 0 6px' }}>
          <PostSkeleton sizeId={sizeId} slides={carousel ? count : 0} />
          <SkeletonStatus title={carousel ? 'Creating your carousel' : picked.length > 1 ? 'Creating your posts' : 'Creating your post'} step={busy}
            hint={`Usually 20 to 60 seconds${picked.length > 1 && !carousel ? ' per post' : ''}${!photo && imageKey ? ' (the photo takes the longest)' : ''}.`} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <GlassButton variant="ghost" onClick={cancelCreate} style={{ padding: '9px 18px', fontSize: 13 }}>Cancel</GlassButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
