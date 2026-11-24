import React, { useEffect, useRef, useState } from 'react';
import MiniPage from './MiniPage';
import { ArrowLeft, Check, FileText, ImagePlus, Loader2, Palette, ShieldCheck, Sparkles, UploadCloud, X } from 'lucide-react';
import Modal from '../../components/Modal';
import { GlassButton } from '../../components/Glass';
import { Bone, SkeletonStatus } from '../../components/Skeleton';
import { extractDocumentText } from '../../utils/extractText';
import { uploadPosterImage } from '../../utils/posterImages';
import { normalizeBrandKit } from '../../../shared/brand.js';
import { icon } from '../../../shared/landing/icons.js';
import { GOALS, LAYOUTS, goalById, layoutById, layoutPreviewPage } from '../../../shared/landing/layouts.js';
import { tx } from '../../../shared/landing/schema.js';

// "Create landing page": pick documents → goal → layout → (optional) photos
// and notes → one AI generation → preview → save or publish. All clicks; the
// only typing is the optional "anything specific?" note.

const STEPS = ['docs', 'goal', 'layout', 'extras'];
const MAX_PHOTOS = 6;

function StepDots({ stage }) {
  const i = STEPS.indexOf(stage);
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }} aria-hidden="true">
      {STEPS.map((s, k) => (
        <span key={s} style={{ height: 4, flex: 1, borderRadius: 4, background: k <= i ? 'var(--accent-violet)' : 'rgba(80,69,56,0.12)', transition: 'background .3s' }} />
      ))}
    </div>
  );
}

function Title({ children, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>{children}</h2>
      {sub && <p style={{ fontSize: 13.5, color: 'var(--ink-500)' }}>{sub}</p>}
    </div>
  );
}

function Footer({ onBack, onNext, nextLabel = 'Continue', nextDisabled, nextIcon }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
      {onBack && <GlassButton variant="ghost" icon={ArrowLeft} onClick={onBack} style={{ padding: '11px 18px' }}>Back</GlassButton>}
      <GlassButton variant="primary" icon={nextIcon} disabled={nextDisabled} onClick={onNext} style={{ flex: 1, justifyContent: 'center' }}>{nextLabel}</GlassButton>
    </div>
  );
}

function Card({ active, onClick, children, style }) {
  return (
    <button type="button" onClick={onClick}
      style={{ textAlign: 'left', padding: 12, borderRadius: 16, cursor: 'pointer', background: active ? 'rgba(242,170,36,0.10)' : 'rgba(255,255,255,0.6)', border: `2px solid ${active ? 'var(--accent-violet)' : 'rgba(183,169,154,0.3)'}`, transition: 'border-color .15s, background .15s', position: 'relative', ...style }}>
      {active && (
        <span style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 999, background: 'var(--accent-violet)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <Check size={13} strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}

// A landing page being made: browser bar, nav, hero (words + picture), three cards.
function PageSkeleton() {
  return (
    <div aria-hidden="true" style={{ maxWidth: 460, margin: '0 auto', borderRadius: 14, border: '1px solid rgba(183,169,154,0.3)', background: 'rgba(255,255,255,0.6)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 5, padding: '9px 12px', borderBottom: '1px solid rgba(183,169,154,0.2)' }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 99, background: 'rgba(80,69,56,0.15)' }} />)}
      </div>
      <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bone w={26} h={26} r={8} /><Bone w={80} h={10} /><span style={{ flex: 1 }} /><Bone w={40} h={8} /><Bone w={40} h={8} /><Bone w={64} h={22} r={999} />
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Bone w="90%" h={18} /><Bone w="65%" h={18} />
            <Bone w="80%" h={9} style={{ marginTop: 4 }} /><Bone w="70%" h={9} />
            <Bone w={96} h={28} r={999} style={{ marginTop: 6 }} />
          </div>
          <Bone w={150} h={120} r={12} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ padding: 10, borderRadius: 10, border: '1px solid rgba(183,169,154,0.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Bone w={20} h={20} r={6} /><Bone w="80%" h={8} /><Bone w="60%" h={8} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const GENERATING_LINES = ['Reading your documents', 'Writing your headline', 'Writing in English and 中文', 'Checking prices and facts', 'Putting the sections together'];

// onCreated(item): the new draft, which the caller opens in the editor.
export default function LandingCreateFlow({ documents, brandKit, onAddDocument, onCancel, onCreated, onOpenBrand }) {
  const kit = normalizeBrandKit(brandKit);
  const [stage, setStage] = useState('docs');
  const usableDocs = documents.filter((d) => d.type !== 'guidance');
  const sopDocs = usableDocs.filter((d) => d.type === 'sop');
  const otherDocs = usableDocs.filter((d) => d.type !== 'sop');
  const [selected, setSelected] = useState(() => otherDocs.map((d) => d.id));
  const [goalId, setGoalId] = useState(GOALS[0].id);
  const [layoutId, setLayoutId] = useState(GOALS[0].layout);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [lineIdx, setLineIdx] = useState(0);
  const [readingDoc, setReadingDoc] = useState(false);
  const docInput = useRef(null);
  const photoInput = useRef(null);

  const context = usableDocs
    .filter((d) => (selected.includes(d.id) || d.type === 'sop') && d.content)
    .map((d) => `--- ${d.name}${d.type === 'sop' ? ' (Marketing SOP, always applied)' : ''} ---\n${d.content}`)
    .join('\n\n');

  const pickGoal = (g) => {
    setGoalId(g.id);
    setLayoutId(g.layout);
  };

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

  const addPhotos = (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - photos.length);
    list.forEach((file) => {
      setUploading((n) => n + 1);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const url = await uploadPosterImage(reader.result);
          setPhotos((p) => (p.length < MAX_PHOTOS ? [...p, url] : p));
        } catch {
          setError(`Couldn't upload "${file.name}".`);
        } finally {
          setUploading((n) => n - 1);
        }
      };
      reader.onerror = () => setUploading((n) => n - 1);
      reader.readAsDataURL(file);
    });
  };

  // Cancel can't stop the request already sent; it just ignores the answer.
  const runId = useRef(0);
  const cancelGenerate = () => { runId.current += 1; setStage('extras'); };

  const generate = async () => {
    const run = ++runId.current;
    setStage('generating');
    setError('');
    setLineIdx(0);
    try {
      const res = await fetch('/api/landing/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalId, layout: layoutId, brand: kit, context, notes: notes.trim(), photos }),
      });
      const body = await res.json().catch(() => null);
      if (run !== runId.current) return;
      if (!res.ok || !body?.page) throw new Error(body?.error || `Something went wrong (${res.status}).`);
      onCreated(buildItem(body.page));
    } catch (err) {
      if (run !== runId.current) return;
      setError(err.message);
      setStage('extras');
    }
  };

  useEffect(() => {
    if (stage !== 'generating') return undefined;
    const id = setInterval(() => setLineIdx((i) => Math.min(i + 1, GENERATING_LINES.length - 1)), 3200);
    return () => clearInterval(id);
  }, [stage]);

  const buildItem = (page) => {
    const hero = page.sections.find((s) => s.type === 'hero');
    return {
      id: `new-${Date.now()}`,
      status: 'draft',
      createdAt: new Date().toISOString().slice(0, 10),
      kind: 'landing',
      title: tx(hero?.content?.title, 'en') || `${kit.companyName || 'New'} landing page`,
      guidance: `${goalById(goalId).label}. ${layoutById(layoutId).label} layout.`,
      landing: { productName: kit.companyName || page.brand?.name, logoUrl: kit.logoUrl, goal: goalId, layout: layoutId, sourceDocIds: selected, page },
    };
  };

  const goal = goalById(goalId);

  // --- steps ----------------------------------------------------------------------
  return (
    <Modal open onClose={onCancel} dismissible={stage !== 'generating'} width={stage === 'layout' ? 920 : 720}>
      {stage !== 'generating' && <StepDots stage={stage} />}

      {stage === 'docs' && (
        <>
          <Title sub="The AI writes only from these, so prices and details stay correct.">What should the page be about?</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {sopDocs.map((d) => (
              <div key={d.id} style={docRowStyle(true)}>
                <ShieldCheck size={17} color="var(--accent-violet)" />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)' }}>Always included</span>
              </div>
            ))}
            {otherDocs.map((d) => {
              const on = selected.includes(d.id);
              return (
                <button key={d.id} type="button" onClick={() => setSelected((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id]))} style={{ ...docRowStyle(on), cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${on ? 'var(--accent-violet)' : 'rgba(80,69,56,0.3)'}`, background: on ? 'var(--accent-violet)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {on && <Check size={13} color="white" strokeWidth={3} />}
                  </span>
                  <FileText size={16} color="var(--ink-500)" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  {!d.content && <span style={{ fontSize: 11.5, fontWeight: 650, color: '#B7791F' }}>Can't read</span>}
                </button>
              );
            })}
            {usableDocs.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--ink-500)', padding: '10px 2px' }}>No documents yet. Add a product sheet or price list so the page has real details.</p>
            )}
          </div>
          <input ref={docInput} type="file" accept=".pdf,.txt,.md" hidden onChange={(e) => { addDoc(e.target.files?.[0]); e.target.value = ''; }} />
          <button type="button" onClick={() => docInput.current?.click()} style={addRowStyle}>
            {readingDoc ? <Loader2 size={16} className="spin" /> : <UploadCloud size={16} />} {readingDoc ? 'Reading…' : 'Add a document'}
          </button>
          {error && <p style={{ marginTop: 10, fontSize: 13, color: 'var(--accent-coral)' }}>{error}</p>}
          <Footer onNext={() => setStage('goal')} />
        </>
      )}

      {stage === 'goal' && (
        <>
          <Title sub="This shapes the words and suggests a layout.">What do you want this page to do?</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {GOALS.map((g) => (
              <Card key={g.id} active={goalId === g.id} onClick={() => pickGoal(g)} style={{ padding: 16 }}>
                <span style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(242,170,36,0.16)', color: '#B7791F', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}
                  dangerouslySetInnerHTML={{ __html: icon(g.icon, { size: 21 }) }} />
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>{g.label}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-500)', marginTop: 2 }}>{g.hint}</span>
              </Card>
            ))}
          </div>
          <Footer onBack={() => setStage('docs')} onNext={() => setStage('layout')} />
        </>
      )}

      {stage === 'layout' && (
        <>
          <Title sub={`Shown in your brand colours. "${layoutById(goal.layout).label}" suits "${goal.label}".`}>Pick a layout</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {LAYOUTS.map((l) => (
              <Card key={l.id} active={layoutId === l.id} onClick={() => setLayoutId(l.id)}>
                <MiniPage page={layoutPreviewPage(l.id, kit)} height={160} scale={0.2} />
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--ink-900)', marginTop: 10 }}>
                  {l.label}{l.id === goal.layout && <span style={{ fontSize: 11, fontWeight: 700, color: '#B7791F', marginLeft: 8 }}>Suggested</span>}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-500)' }}>{l.hint} · {l.sections.length} sections</span>
              </Card>
            ))}
          </div>
          <Footer onBack={() => setStage('goal')} onNext={() => setStage('extras')} />
        </>
      )}

      {stage === 'extras' && (
        <>
          <Title sub="Both optional. Skip straight to Create if you like.">Add photos or a note</Title>

          <p style={labelStyle}>Photos <span style={{ fontWeight: 500, color: 'var(--ink-300)' }}>(the first one goes at the top)</span></p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addPhotos(e.dataTransfer.files); }}
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            {photos.map((url, i) => (
              <div key={url} style={{ position: 'relative', width: 92, height: 92, borderRadius: 12, overflow: 'hidden', outline: i === 0 ? '2px solid var(--accent-violet)' : 'none' }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" aria-label="Remove photo" onClick={() => setPhotos((p) => p.filter((x) => x !== url))}
                  style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: 0, background: 'rgba(0,0,0,0.55)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
            {photos.length + uploading < MAX_PHOTOS && (
              <button type="button" onClick={() => photoInput.current?.click()}
                style={{ width: 92, height: 92, borderRadius: 12, border: '2px dashed rgba(183,169,154,0.6)', background: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--ink-500)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                {uploading ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />}
                {uploading ? 'Uploading' : 'Add'}
              </button>
            )}
            <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
          </div>

          <p style={labelStyle}>Anything specific? <span style={{ fontWeight: 500, color: 'var(--ink-300)' }}>(optional)</span></p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={600}
            placeholder="e.g. Mention our Hari Raya promotion until 30 April"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(183,169,154,0.45)', background: 'white', fontSize: 13.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '10px 12px', borderRadius: 12, background: 'rgba(80,69,56,0.05)' }}>
            {kit.logoUrl ? <img src={kit.logoUrl} alt="" style={{ height: 24, maxWidth: 80, objectFit: 'contain' }} /> : <Palette size={18} color="var(--ink-500)" />}
            <span style={{ display: 'flex', gap: 3 }}>
              {['primary', 'accent', 'bg'].map((k) => <span key={k} style={{ width: 14, height: 14, borderRadius: 999, background: kit.colors[k], border: '1px solid rgba(0,0,0,0.08)' }} />)}
            </span>
            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--ink-500)' }}>
              {kit.companyName ? `Uses your ${kit.companyName} brand` : 'No brand set yet, using default colours'}
              {!kit.whatsapp.number && ' · No WhatsApp number yet'}
            </span>
            {onOpenBrand && <button type="button" onClick={onOpenBrand} style={{ border: 0, background: 'none', color: 'var(--accent-violet)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Edit brand</button>}
          </div>

          {error && <p style={{ marginTop: 14, fontSize: 13, color: 'var(--accent-coral)' }}>{error}</p>}
          <Footer onBack={() => setStage('layout')} onNext={generate} nextLabel={error ? 'Try again' : 'Create my page'} nextIcon={Sparkles} nextDisabled={uploading > 0} />
        </>
      )}

      {stage === 'generating' && (
        <div style={{ padding: '18px 0 6px' }}>
          <PageSkeleton />
          <SkeletonStatus title="Creating your page" step={GENERATING_LINES[lineIdx]} hint="Usually 15 to 30 seconds." />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <GlassButton variant="ghost" onClick={cancelGenerate} style={{ padding: '9px 18px', fontSize: 13 }}>Cancel</GlassButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

const docRowStyle = (on) => ({
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, width: '100%',
  border: `1px solid ${on ? 'rgba(242,170,36,0.45)' : 'rgba(183,169,154,0.3)'}`, background: on ? 'rgba(242,170,36,0.07)' : 'rgba(255,255,255,0.55)',
});

const addRowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 10, padding: '11px 12px', borderRadius: 12,
  border: '1.5px dashed rgba(183,169,154,0.6)', background: 'transparent', color: 'var(--ink-500)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

const labelStyle = { fontSize: 12.5, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 8 };
