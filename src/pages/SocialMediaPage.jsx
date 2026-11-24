import React, { useState } from 'react';
import { Link2Off } from 'lucide-react';
import { saveCredentials, deleteCredentials } from '../utils/credentialsApi';
import { FieldStack, Group, HelpDisclosure, Notice, Row, SettingsPage, SmallButton } from '../components/settings/SettingsUI';
import { FacebookTile, InstagramTile, YouTubeTile } from '../components/settings/BrandGlyphs';

// Settings → Social Media. One row per platform: status at a glance,
// tap to connect. The long "where do I find these?" steps sit behind a
// help link instead of filling the page.
//
// RedNote (XHS) isn't listed: it can never auto-publish (draft-only, see
// PublishScheduleModal), so there's nothing to connect.

export default function SocialMediaPage({ profile, setProfile }) {
  const fbSocial = profile.socials.find((s) => s.id === 'fb');
  const igSocial = profile.socials.find((s) => s.id === 'ig');
  const ytSocial = profile.socials.find((s) => s.id === 'yt');
  const isFbConnected = !!(fbSocial?.connected && fbSocial?.pageId && fbSocial?.pageAccessToken);

  const [open, setOpen] = useState(null);
  const toggle = (id) => setOpen((o) => (o === id ? null : id));
  const [errors, setErrors] = useState({});
  const setError = (id, msg) => setErrors((e) => ({ ...e, [id]: msg }));

  const [fb, setFb] = useState({ pageId: fbSocial?.pageId || '', pageName: fbSocial?.pageName || '', token: fbSocial?.pageAccessToken || '' });
  const [igBusinessId, setIgBusinessId] = useState(igSocial?.businessId || '');
  const [yt, setYt] = useState({ clientId: ytSocial?.clientId || '', clientSecret: ytSocial?.clientSecret || '', refreshToken: ytSocial?.refreshToken || '' });

  const patchSocial = (id, patch) =>
    setProfile((p) => ({ ...p, socials: p.socials.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  // Manual connection: a Page ID + Page Access Token from Meta's Graph API
  // Explorer. (Replaced an earlier FB.login() popup flow that was unreliable
  // across App Domain/HTTPS/localStorage-timing issues.) Also mirrored to
  // Postgres so the connection works from every device.
  const connectFacebook = () => {
    setError('fb', '');
    const pageId = fb.pageId.trim();
    const pageName = fb.pageName.trim();
    const token = fb.token.trim();
    if (!pageId || !token) return setError('fb', 'Page ID and Page Access Token are both needed.');
    patchSocial('fb', { connected: true, pageId, pageName: pageName || undefined, pageAccessToken: token });
    saveCredentials('fb', { pageId, pageName, accessToken: token });
    setOpen(null);
  };

  // Instagram Business/Creator accounts post through their linked Facebook
  // Page's token — all that's needed on top is the numeric Business ID.
  const connectInstagram = () => {
    setError('ig', '');
    const businessId = igBusinessId.trim();
    if (!isFbConnected) return setError('ig', 'Connect Facebook first — Instagram posts through your Facebook Page.');
    if (!businessId) return setError('ig', 'Instagram Business Account ID is needed.');
    patchSocial('ig', { connected: true, businessId });
    saveCredentials('ig', { businessId });
    setOpen(null);
  };

  // OAuth Client ID/Secret + a one-time Refresh Token; the server swaps the
  // refresh token for a fresh access token on every upload.
  const connectYoutube = () => {
    setError('yt', '');
    const clientId = yt.clientId.trim();
    const clientSecret = yt.clientSecret.trim();
    const refreshToken = yt.refreshToken.trim();
    if (!clientId || !clientSecret || !refreshToken) return setError('yt', 'All three are needed.');
    patchSocial('yt', { connected: true, clientId, clientSecret, refreshToken });
    saveCredentials('yt', { clientId, clientSecret, refreshToken });
    setOpen(null);
  };

  const disconnect = (id) => {
    patchSocial(id, { connected: false, pageId: undefined, pageName: undefined, pageAccessToken: undefined, businessId: undefined, clientId: undefined, clientSecret: undefined, refreshToken: undefined });
    if (id === 'fb') setFb({ pageId: '', pageName: '', token: '' });
    if (id === 'ig') setIgBusinessId('');
    if (id === 'yt') setYt({ clientId: '', clientSecret: '', refreshToken: '' });
    deleteCredentials(id);
  };

  const status = (connected, waiting) => ({ state: connected ? 'ok' : waiting ? 'waiting' : 'none', label: waiting && !connected ? 'Needs Facebook' : undefined });

  const footerButtons = (id, connected, onConnect) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <SmallButton primary onClick={onConnect}>{connected ? 'Update' : 'Connect'}</SmallButton>
      {connected && <SmallButton danger icon={Link2Off} onClick={() => disconnect(id)}>Disconnect</SmallButton>}
    </div>
  );

  return (
    <SettingsPage title="Social Media" subtitle="Connect where your posts go.">
      <Group title="Platforms" footer="Connected platforms publish automatically at the scheduled time.">
        <Row iconNode={<FacebookTile />} title="Facebook"
          subtitle={fbSocial?.connected && fbSocial.pageName ? `Posting as ${fbSocial.pageName}` : 'Page posts'}
          status={status(isFbConnected)} open={open === 'fb'} onToggle={() => toggle('fb')}>
          <FieldStack fields={[
            { label: 'Page ID', value: fb.pageId, onChange: (v) => setFb((s) => ({ ...s, pageId: v })), placeholder: '1234567890' },
            { label: 'Page name', value: fb.pageName, onChange: (v) => setFb((s) => ({ ...s, pageName: v })), placeholder: 'Optional' },
            { label: 'Access token', type: 'password', value: fb.token, onChange: (v) => setFb((s) => ({ ...s, token: v })), placeholder: 'EAAG…', onEnter: connectFacebook },
          ]} />
          {errors.fb && <Notice kind="error">{errors.fb}</Notice>}
          {footerButtons('fb', isFbConnected, connectFacebook)}
          <HelpDisclosure>
            <li>Open <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer">Graph API Explorer</a> and pick your app.</li>
            <li>Switch to <b>Page Access Token</b> and choose your Page.</li>
            <li>Tick <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code>.</li>
            <li>Click <b>Generate Access Token</b> and paste it here with the Page ID.</li>
          </HelpDisclosure>
        </Row>

        <Row iconNode={<InstagramTile />} title="Instagram"
          subtitle={igSocial?.connected && igSocial.businessId ? `Business account ${igSocial.businessId}` : 'Posts via your Facebook Page'}
          status={status(igSocial?.connected, !isFbConnected)} open={open === 'ig'} onToggle={() => toggle('ig')}>
          {!isFbConnected && <Notice>Connect Facebook first — Instagram posts through your Facebook Page.</Notice>}
          <FieldStack fields={[
            { label: 'Business ID', value: igBusinessId, onChange: setIgBusinessId, placeholder: '17841400000000000', onEnter: connectInstagram },
          ]} />
          {errors.ig && <Notice kind="error">{errors.ig}</Notice>}
          {footerButtons('ig', igSocial?.connected, connectInstagram)}
          <HelpDisclosure title="Where do I find this?">
            <li>In <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer">Graph API Explorer</a>, use the same Page Access Token.</li>
            <li>Run <code>GET /&#123;page-id&#125;?fields=instagram_business_account</code>.</li>
            <li>Copy <code>instagram_business_account.id</code> from the answer.</li>
          </HelpDisclosure>
        </Row>

        <Row iconNode={<YouTubeTile />} title="YouTube" subtitle="Video uploads"
          status={status(ytSocial?.connected)} open={open === 'yt'} onToggle={() => toggle('yt')} last>
          <FieldStack fields={[
            { label: 'Client ID', value: yt.clientId, onChange: (v) => setYt((s) => ({ ...s, clientId: v })), placeholder: '…apps.googleusercontent.com' },
            { label: 'Client secret', type: 'password', value: yt.clientSecret, onChange: (v) => setYt((s) => ({ ...s, clientSecret: v })), placeholder: 'GOCSPX-…' },
            { label: 'Refresh token', type: 'password', value: yt.refreshToken, onChange: (v) => setYt((s) => ({ ...s, refreshToken: v })), placeholder: '1//…', onEnter: connectYoutube },
          ]} />
          {errors.yt && <Notice kind="error">{errors.yt}</Notice>}
          {footerButtons('yt', ytSocial?.connected, connectYoutube)}
          <HelpDisclosure>
            <li>In <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">Google Cloud Console</a>, create a project and enable <b>YouTube Data API v3</b>.</li>
            <li>Credentials → create an <b>OAuth Client ID</b> (Desktop app) → copy the Client ID and Secret.</li>
            <li>In <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer">OAuth Playground</a>, ⚙ → <b>Use your own OAuth credentials</b> → paste them.</li>
            <li>Authorize <code>https://www.googleapis.com/auth/youtube.upload</code>, exchange the code, copy the <b>Refresh Token</b>.</li>
          </HelpDisclosure>
        </Row>
      </Group>
    </SettingsPage>
  );
}
