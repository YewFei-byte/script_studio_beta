import React, { useCallback, useEffect, useState } from 'react';
import { Share2, ImageIcon, Sparkles, User } from 'lucide-react';
import { Group, KeyEditor, Row, Segmented, SettingsPage } from '../components/settings/SettingsUI';
import { fetchServerKeyStatus, testImageKey, testServerKey } from '../utils/keyTests';
import { defaultImageModel } from '../utils/aiProvider';

// Settings → API, laid out like iOS Settings: one row per service with an
// icon, a few words on what it powers, and a status badge that's actually
// checked against the service — so it's always obvious whether a key is set
// and working, without reading paragraphs.

const LANDING_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', hint: 'Balanced' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5', hint: 'Best quality' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', hint: 'Fastest' },
];

const POST_PROVIDERS = [
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…' },
  { id: 'gemini', label: 'Gemini', placeholder: 'AIza…' },
];

// Image models come from the key itself (see testImageKey), so retired
// models drop off the list on their own. A saved choice that's no longer
// available falls back to the provider's default, same as at generation time.
function ImageModelPicker({ provider, status, value, onChange }) {
  const models = status.models || [];
  if (!models.length) return null;
  const current = models.includes(value) ? value : defaultImageModel(provider, models);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>Image model</span>
      <Segmented options={models.map((id) => ({ id, label: id }))} value={current} onChange={onChange} />
    </div>
  );
}

// --- status ------------------------------------------------------------------

// Runs `check` whenever `key` (the thing being checked) changes.
// check() -> { state: 'ok'|'server'|'bad'|'none'|'set', error? }
function useStatus(check, key) {
  const [status, setStatus] = useState({ state: 'checking' });
  const run = useCallback(() => {
    let cancelled = false;
    setStatus({ state: 'checking' });
    Promise.resolve(check()).then((s) => !cancelled && setStatus(s));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(run, [run]);
  return [status, run];
}

// --- page ----------------------------------------------------------------------

export default function ApiKeysPage({ apiKeys, setApiKeys, user, personalPostKey, setPersonalPostKey }) {
  const isAdmin = user?.role === 'Admin';
  const [open, setOpen] = useState(null);
  const toggle = (id) => setOpen((o) => (o === id ? null : id));
  const update = (patch) => setApiKeys({ ...apiKeys, ...patch });

  const [server, setServer] = useState(null);
  useEffect(() => { fetchServerKeyStatus().then(setServer); }, []);

  // A saved key is tested as-is; with none saved, fall back to whether the
  // server has its own default (and test that).
  const serverBacked = (service, key, hasDefault) => async () => {
    if (key) {
      const r = await testServerKey(service, key);
      return r.ok ? { state: 'ok' } : { state: 'bad', error: r.error };
    }
    if (!hasDefault) return { state: 'none' };
    const r = await testServerKey(service);
    return r.ok ? { state: 'server' } : { state: 'bad', error: r.error };
  };

  const [claude] = useStatus(serverBacked('claude', apiKeys.landing, server?.claude?.serverDefault), `${apiKeys.landing}|${server?.claude?.serverDefault}`);

  const postProvider = POST_PROVIDERS.find((p) => p.id === apiKeys.postProvider) || POST_PROVIDERS[0];
  const browserKey = (provider, key) => async () => {
    if (!key) return { state: 'none' };
    const r = await testImageKey(provider.id, key);
    return r.ok ? { state: 'ok', models: r.models } : { state: 'bad', error: r.error };
  };
  const [post, recheckPost] = useStatus(browserKey(postProvider, apiKeys.post), `${postProvider.id}|${apiKeys.post}`);

  const personalProvider = POST_PROVIDERS.find((p) => p.id === personalPostKey?.postProvider) || POST_PROVIDERS[0];
  const [personal, recheckPersonal] = useStatus(browserKey(personalProvider, personalPostKey?.post), `${personalProvider.id}|${personalPostKey?.post}`);

  const fbStatus = { state: apiKeys.fbAppId ? 'set' : 'none' };
  const landingModel = apiKeys.landingModel || server?.claude?.model || LANDING_MODELS[0].id;

  return (
    <SettingsPage title="API" subtitle="Connect the services that create and publish your content.">

      <Group title="Create">
        <Row icon={Sparkles} color="linear-gradient(135deg,#E0894A,#C4622D)" title="Claude" subtitle="Writes landing pages"
          status={claude} open={open === 'claude'} onToggle={() => toggle('claude')}>
          <KeyEditor value={apiKeys.landing || ''} placeholder="sk-ant-…" onSave={(v) => update({ landing: v })} />
          {!apiKeys.landing && server?.claude?.serverDefault && (
            <p style={{ fontSize: 12, color: 'var(--ink-500)' }}>Leave empty to use the server's key.</p>
          )}
          <Segmented options={LANDING_MODELS} value={landingModel} onChange={(id) => update({ landingModel: id })} />
        </Row>

        <Row icon={ImageIcon} color="linear-gradient(135deg,#2BB673,#14905A)" title={postProvider.label} subtitle="Post images & captions"
          status={post} open={open === 'post'} onToggle={() => toggle('post')} last={!isAdmin}>
          <Segmented options={POST_PROVIDERS} value={postProvider.id} onChange={(id) => update({ postProvider: id, postModel: '' })} />
          <KeyEditor value={apiKeys.post || ''} placeholder={postProvider.placeholder} onSave={(v) => (v === apiKeys.post ? recheckPost() : update({ post: v }))} />
          <ImageModelPicker provider={postProvider.id} status={post} value={apiKeys.postModel} onChange={(id) => update({ postModel: id })} />
        </Row>

        {isAdmin && (
          <Row icon={User} color="linear-gradient(135deg,#8E8E93,#636366)" title="My own image key" subtitle="Optional — overrides the shared one for you"
            status={personal} open={open === 'personal'} onToggle={() => toggle('personal')} last>
            <Segmented options={POST_PROVIDERS} value={personalProvider.id} onChange={(id) => setPersonalPostKey({ ...personalPostKey, postProvider: id, postModel: '' })} />
            <KeyEditor value={personalPostKey?.post || ''} placeholder={personalProvider.placeholder} onSave={(v) => (v === personalPostKey?.post ? recheckPersonal() : setPersonalPostKey({ ...personalPostKey, post: v }))} />
            <ImageModelPicker provider={personalProvider.id} status={personal} value={personalPostKey?.postModel}
              onChange={(id) => setPersonalPostKey({ ...personalPostKey, postModel: id })} />
          </Row>
        )}
      </Group>

      <Group title="Publish">
        <Row icon={Share2} color="linear-gradient(135deg,#3B82F6,#1D5FD6)" title="Facebook App" subtitle="Needed to post to Facebook & Instagram"
          status={fbStatus} open={open === 'fb'} onToggle={() => toggle('fb')} last>
          <KeyEditor value={apiKeys.fbAppId || ''} placeholder="App ID, e.g. 1234567890" secret={false} noun="App ID" onSave={(v) => update({ fbAppId: v })} />
        </Row>
      </Group>

      <p style={{ fontSize: 12, color: 'var(--ink-300)', textAlign: 'center' }}>
        Keys are checked automatically. Changes save instantly and sync to every device.
      </p>
    </SettingsPage>
  );
}
