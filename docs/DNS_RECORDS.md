# DNS records for presoft.my

The domain is managed in **Hostinger** (hPanel → Domains → presoft.my → DNS / Nameservers).
Hostinger's DNS screen has no notes field, so this file is the record of **what each record is for**.
When you add, change or remove a record, update this table in the same commit.

## Records

| Type | Name (host) | Points to (value) | Used by | What it's for | Added | By |
|---|---|---|---|---|---|---|
| A / CNAME | `*` (`*.presoft.my`) | AWS (existing) | AWS website | Wildcard for the AWS-hosted sites. Fill in the exact type/value. | (existing) | |
| CNAME | `*.pages` | `mtbpajjp.up.railway.app` | Script Studio | Sends every `<address>.pages.presoft.my` to Script Studio, which serves published landing pages | _pending_ | |
| CNAME | `_acme-challenge.pages` | `mtbpajjp.authorize.railwaydns.net` | Railway | Lets Railway issue and renew the HTTPS certificate for `*.pages.presoft.my` | _pending_ | |
| TXT | `_railway-verify.pages` | `railway-verify=…` (copy the full value from Railway) | Railway | Proves to Railway that we own `pages.presoft.my` | _pending_ | |

The `*.pages` record does not affect `*.presoft.my`: DNS always uses the most specific match, so only names
ending in `.pages.presoft.my` go to Railway; everything else keeps going to AWS.

## Setting up Presoft hosting (one time)

1. **Railway** → the Script Studio service → **Settings → Networking → Custom Domain** → add `*.pages.presoft.my`.
   Railway shows the DNS record(s) to create, including the exact CNAME target(s).
2. **Hostinger** → presoft.my → **DNS records** → add each record exactly as Railway shows it
   (two **CNAME**s and one **TXT**; Name and Target/Value exactly as Railway shows them, TTL default).
   Hostinger adds `.presoft.my` to the name itself, so type only `*.pages`, not `*.pages.presoft.my`.
3. Wait for Railway to show the domain as verified with a certificate (usually minutes, up to an hour).
4. Fill in the **Added** and **By** columns above and commit this file.
5. Check: publish any landing page, then open `https://<address>.pages.presoft.my`.

Script Studio itself needs no setting for this: in production it serves `*.pages.presoft.my` by default
(`SITES_DOMAIN` in `.env.example` can override it).

## Removing

To stop all hosted landing pages: delete the `*.pages` record in Hostinger and the custom domain in Railway.
Delete `_acme-challenge.pages` and `_railway-verify.pages` too, then mark the rows above as removed (with date) rather than deleting them.
