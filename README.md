# Script Studio — Concept UI

A hardcoded, UI-only concept of an admin panel for AI-generated marketing content: log in, generate landing pages and social posts from your documents (with an AI chat that keeps refining the result until you're happy), then publish/schedule them — plus team member, branch, and permission management. Built with React + Vite, Lucide icons, and Framer Motion, styled in an Apple-style liquid glass aesthetic (Presoft brand palette).

This started as a UI concept with hardcoded/mocked "AI" behavior and a seeded fictional skincare demo brand ("Luma") — that seed data (mock posts, mock captions, mock generated content, the fake extracted-PDF example, the default `luma_admin`/`lumaskincare.com` profile) has since been fully removed, and real generation (OpenAI/Gemini, see the API key section below) replaced the mocked poster/caption logic. Nothing in this app fabricates or falls back to placeholder content on a failed generation anymore — a failed AI call now just shows the real error with a Retry button, never a stand-in image or caption.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## What to click through for a demo

1. **Login** — sign in with `admin123` / `admin123`.
2. **Top bar** — the menu icon (top-left) opens the side nav; the "Script Studio" logo (top-center) always jumps back to Generate.
3. **Side nav** — a flat list: Generate, Requirement, User Setting, then (under the "Admin Panel" label) Landing Page, Post, Member, Domain, Social Media, API, and Log Out at the bottom.
4. **Generate** — two floating bubbles, "Generate Post" and "Landing Page". Pick one to start the flow:
   - Optionally pick source document(s) to read from (or skip).
   - For posts, choose one or more platforms (Instagram / Facebook / RedNote) — then, one at a time, pick how many images to generate for each platform.
   - Answer whatever the AI still needs to know, watch it generate, then keep chatting with the AI to refine the live preview for as long as you like.
   - Finish by saving as a draft, publishing now, or scheduling.
5. **Landing Page / Post (Admin Panel)** — grids of already-generated content (mixed Draft / Scheduled / Published), each with search, sort, and (for Admin) a branch filter, plus pagination. Click a card to open the enlarged preview, or use its action buttons directly:
   - Draft → Publish (or Schedule)
   - Scheduled → Publish Now
   - Published landing page → Unpublish, or Edit (Speak with AI)
   - Published post → **Regenerate** only — a live post can't really be taken back, so this clones it into a fresh draft, runs the same AI edit loop, then republishes as a new item once you're happy, leaving the original published post untouched
   - Any non-published item → Edit (Speak with AI) — the same chat ⇄ preview refine loop used during generation
   - **Assign Permission** — grant a specific member or branch manager Editor (full management) or View (read-only) access to that one project, with its own search/sort/role/branch filters
6. **Requirement** — search by name, scroll through the list (capped to ~5 rows tall), click a document to preview its content, upload a new one via drag-and-drop, or remove one. Notice the "AI Guidance" docs — every generate/modify run auto-records (or updates) one of these. There's also a dedicated **Marketing SOP** upload box pinned at the top — anything uploaded there is automatically factored into every generation (posts and landing pages alike), on top of whatever you optionally pick in the per-generation document step. It's strictly per-login: each account only ever sees and uses its own SOP, never a Superadmin's, an Admin's, or anyone else's — see `visibleDocuments` in `src/pages/AdminPanel.jsx`.
7. **Member** — invite/remove team members, change their role (Admin / Store Manager / Member) and branch, with search/sort/role/branch filters on the list. The Role Permissions table below covers management capabilities only (assign project permission, manage own branch's members, manage members across all branches, company settings) — actual EDITOR/VIEW access to a given project always comes from branch scope or a direct Assign Permission grant, never this table. Inviting a member with "Also create a login" checked sends them a real email (their username/password plus a sign-in link) via EngineMailer — see the "Team invite emails" section below for setup. Status shows "Invited" until that email actually sends, then flips to "Active".
8. **User Setting / Domain / Social Media / API** — change password (hint: current password is `demo1234`), edit the company domain, connect social platforms, and manage API keys used for generation.

## API key fallback hierarchy

Generation uses whichever key resolves first, per logged-in user: their own Post API key (Admin only — set under Settings -> API -> "Your Personal Post API Key"), else the key belonging to whichever Admin created their login (Manager/Member — resolved via `created_by_admin_id` on the login, exposed as `user.createdByAdminId`), else the Superadmin-set shared default. Only the Post API Key has this per-admin override; the Landing Page key and Facebook App ID always come from the shared default. Superadmin can also now grant Admin the ability to create logins themselves (Members -> Role Permissions -> "Superadmin (manage logins)") — an Admin can only create Manager/Member logins and can only manage the ones they personally created; Superadmin still manages everyone. See `effectiveApiKeys` / `currentMember` in `src/pages/AdminPanel.jsx`.

## Team invite emails

When an Admin/Superadmin invites a member from the Member page with "Also create a login" checked, the username and password they typed into that form are emailed to the invitee via EngineMailer, along with an "Accept Invite & Log In" button/link back into the app — the credentials are never auto-generated, they're exactly what was keyed in on the invite form.

This used to go through Gmail SMTP (nodemailer), but that reliably failed with "Connection timeout" on Railway — even after forcing IPv4 DNS resolution — meaning the outbound connection to Gmail's SMTP port never completed at all, most likely because this host's network blocks/restricts raw SMTP ports (25/465/587) outright (a common anti-abuse measure on shared cloud hosting). EngineMailer's REST API sends over a normal HTTPS request instead, which doesn't hit that problem.

Setup (server-side only, safe on Railway):
1. Sign up / log in at enginemailer.com and grab your API key.
2. Set `ENGINEMAILER_API_KEY` as an environment variable on the service — see `.env.example`.
3. Set `ENGINEMAILER_SENDER_EMAIL` to a sender address that's verified on your EngineMailer account (their API requires it to match a verified domain there — an unverified sender gets rejected by EngineMailer itself, not by this app). Optionally set `ENGINEMAILER_SENDER_NAME` too.

Note: this integration was built from EngineMailer's public documentation, not a live-tested account — if the exact header/field format their API expects turns out to differ slightly, their own error response is surfaced in the failure banner and the deploy logs, so it's fixable without guessing blind.

If `ENGINEMAILER_API_KEY`/`ENGINEMAILER_SENDER_EMAIL` aren't set, invites still work exactly as before — the member and their login are still created — the admin just sees a warning banner that the email couldn't be sent, and shares the credentials with the member directly. A newly invited member shows status "Invited" (not "Active") until the email genuinely sends — see the `invite()` handler in `src/pages/MembersPage.jsx`. See `POST /api/invite-email` and `sendInviteEmailViaEngineMailer` in `server.js` for the send itself.

## Why a scheduled post could seem to vanish (fixed)

Generated poster images used to be embedded directly (as base64) inside the same combined save as the whole Post/Landing Page list. As image history piled up, that combined save could exceed both the browser's localStorage quota and the server's request-size limit -- and the code saving it didn't check for failure, so it silently kept "succeeding" while nothing after that point was actually being persisted. A post could look scheduled in your browser and then simply be gone on the next reload, because it was never really saved anywhere.

Fixed now two ways: generated/uploaded poster images are uploaded to their own row in Postgres (`POST /api/poster-image`, see `src/utils/posterImages.js`) and referenced by a short URL instead of being embedded raw, so an individual save can't balloon in size just from image history; and `src/utils/dataApi.js`'s `saveData` now throws on a failed save instead of swallowing it, surfaced as a dismissible warning banner at the top of the admin panel (`contentSaveWarning` in `src/pages/AdminPanel.jsx`) so a failed save is visible instead of silent.

## Scheduled posts now actually auto-publish

"Schedule" used to only record intent (status + a target time) -- nothing watched the clock, so a scheduled post/landing page just sat there until someone opened the app and clicked "Publish Now" themselves. There's now a real server-side job (`server.js`, search for "Auto-publish scheduler") that checks every 60 seconds for anything scheduled whose time has passed and actually publishes it -- Facebook, Instagram, and landing pages (via the n8n/Netlify webhook) all fire for real even if nobody has the app open.

Two kinds can't auto-publish, same as manual publish already couldn't:
- **RedNote (XHS)** -- no real posting API exists for it.
- **YouTube** -- publishing needs the actual video file, which is deliberately never saved anywhere (too large to round-trip through JSON) -- there's nothing left to upload once the browser that scheduled it is gone. These still need a manual Publish Now from a session that still has the video attached.

If an auto-publish attempt fails (e.g. a disconnected Facebook Page, an expired token), the item stays `scheduled` and retries every tick, with the reason shown right on its card in the Post/Landing Page list so it's never a silent, endless retry.

One thing this relies on: Instagram's API needs a real, publicly-fetchable image URL (not just reachable from your own browser). Generated poster images are already stored that way -- `POST /api/poster-image` builds an absolute URL from the request that uploaded it (see server.js), so this works automatically wherever the app is actually deployed and reachable from the internet, no extra setup needed.

## Notes for extending later

- All mock content lives in `src/data/mockData.js` — swap in a client's real product/brand there for a tailored demo (credentials, documents, generated content seeds, members, branches, permissions).
- `src/pages/AdminPanel.jsx` is the central state owner (documents, generated content, members, permissions, API keys, regenerate flow) — it's the equivalent of what `App.jsx` used to hold before the login/admin-panel rework.
- The chat-driven generation/refine logic (keyword-matched mock replies) lives in `src/components/GenerateFlow.jsx` (initial gather, including the per-platform image-count step) and `src/components/SpeakWithAI.jsx` (refine loop, shared between first-time generation, Edit, and Regenerate).
- The role/branch/permission model — `roleOptions`, `branchOptions`, `permissionDefs`, `initialPermissions` in `src/data/mockData.js`, plus each content item's `branch`/`createdBy`/`memberPermissions` — is now enforced against the logged-in identity for the Landing Page and Post listing pages: only Superadmin sees every project. Admin sees their own plus whatever the logins *they personally created* generated (via `created_by_admin_id`, cross-referenced against Members' `loginId`) — never Superadmin's or another Admin's. Manager sees their own branch's. Everyone else sees only what they created or what's been explicitly shared with them via Assign Permission. See `visibleContent` / `currentMemberId` / `adminCreatedMemberIds` in `src/pages/AdminPanel.jsx`. A login with no roster entry (i.e. only the admin123 master login) sees everything by virtue of always being Superadmin.
- No backend, no router, no persistence — everything resets on reload by design.
- The Post API Key on Settings -> API can be an OpenAI or a Gemini key — pick which with the pills next to that field, then Save. `src/utils/openai.js` and `src/utils/gemini.js` are the two provider wrappers (same function shapes), and `src/utils/aiProvider.js` picks between them based on `apiKeys.postProvider` (and the image model via `apiKeys.postModel`, chosen from the models the key can actually use — so retired models like `gpt-image-1` drop off on their own) so `GenerateFlow.jsx`/`SpeakWithAI.jsx` don't need to know which one is active.
