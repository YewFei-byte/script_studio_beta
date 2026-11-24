# Script Studio × Heron License

Heron License is Presoft's central sign-in and licensing service. With it on,
**Heron decides who may sign in and until when; Script Studio decides what they
may do.**

| | Heron | Script Studio |
|---|---|---|
| Username and password | ✅ | not stored |
| Company, licence expiry, suspension, seat limit | ✅ | — |
| Role, branch, project permissions | — | ✅ as before |

Without `HERON_URL` nothing changes: local logins and the `admin123` master
login work as they always did.

## Many companies, one database

Every Heron company gets its own Script Studio: posts, landing pages, members,
branches, documents, API keys, brand kit and social connections are all stored
per company (`company_id`, set from the signed-in person's Heron company). The
server takes the company from the session, never from the browser, and
`server/tenant.js` refuses to run a query with no company at all.

Published page addresses (`<name>.pages.presoft.my`) are public, so they stay
unique across all companies.

## Setting up (Heron console)

1. **Products** → Script Studio. Copy the API key (`hlk_…`) and secret (`hls_…`).
2. For each customer: **Companies** → new company, **Licenses** → a Script
   Studio licence (expiry, Seats), **Credentials** → their Super admin.

## Setting up (Railway)

```
HERON_URL=https://heron-license.presoft.my
HERON_PRODUCT_KEY=hlk_…
HERON_PRODUCT_SECRET=hls_…
HERON_LEGACY_COMPANY_ID=<Heron id of the company that owns today's data>
```

On the first start with these set, everything that existed before Heron is
assigned to `HERON_LEGACY_COMPANY_ID` (logged as `[tenancy] Assigned pre-Heron
data…`). Back up the database first.

## What people see

- **First sign-in** links to an existing login **with the same username in that
  company** (keeping its role and branch), or creates one. A new login's role
  follows the Heron rank: Super admin → Superadmin, Admin → Admin, user → Member.
  After that the role is Script Studio's.
- **Members → add a login** creates it in Heron as the signed-in person, so
  Heron's seat limit and password rules apply, and the person must choose a new
  password at first sign-in. Only someone who is a Super admin or Admin **in
  Heron** may do this.
- **Reset password / rename** go to Heron. **Remove** deactivates the Heron login
  (freeing the seat). Role and branch stay local.
- **Licence expired or suspended, login deactivated**: refused at sign-in, and
  anyone already signed in is signed out within `HERON_CHECK_MINUTES` (10) with
  the reason shown. Scheduled posts of an unlicensed company are not
  auto-published. If Heron can't be reached, people already signed in carry on
  for up to `HERON_GRACE_HOURS` (24).
- **Signing out** ends the Heron session, on every device.
- The `admin123` master login is switched off.
