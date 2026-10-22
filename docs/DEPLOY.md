# Going live (free): Vercel + MongoDB Atlas

The app is ready to deploy. This is the step-by-step list for the day the farm goes online. Every step runs on free plans. About 1 to 1.5 hours in total; the owner's part is about 15 minutes (step 1).

Nothing here has been done yet. The live data is still in the local database on the office PC (`C:\Users\hp\farm-data\mongo-data`).

## 0. Before you start
- [ ] On the office PC, start the local database: `apps/web/scripts/start-local-db.ps1`.
- [ ] Back up the local database (keep the file somewhere safe), or use **Settings → Data & sync → Download backup** in the app.
- [ ] Check that `main` builds: `npm ci && npx turbo run typecheck lint test` and `cd apps/web && npx next build`.

## 1. MongoDB Atlas (owner, in the Atlas website)
Use the free **M0** cluster (`cluster0`, database `farm_management`). It is empty today.

1. **Database Access → Add New Database User**
   - Username: `farm-app`. Password: generated, 24 or more characters. Save it in a password manager.
   - Role: **Read and write to any database**, or better, a custom role limited to `farm_management`.
2. **Network Access → Add IP Address → `0.0.0.0/0`.** Vercel has no fixed IP addresses, so this is required. The strong password above is what protects the database.
3. Copy the connection string and add the database name and pool size:
   `mongodb+srv://farm-app:<password>@cluster0.uzbxx1c.mongodb.net/farm_management?retryWrites=true&w=majority&maxPoolSize=5`
   - `maxPoolSize=5` stops serverless functions from using up M0's connection limit.

## 2. Prepare the Atlas database (from the office PC)
Run these in `apps/web`. Never commit the connection string or paste it into chat.

```bash
# 1) Create the collections and indexes from prisma/schema.prisma
DATABASE_URL="<atlas url>" npx prisma db push --skip-generate

# 2) Expiry (TTL) indexes for tokens, rate limits and old imports, plus the
#    googleId fix (Prisma makes it a plain unique index, which breaks every
#    email-only user after the first; this makes it partial). Safe to re-run.
#    Run it again after any later `prisma db push`.
DATABASE_URL="<atlas url>" node scripts/db-indexes.mjs

# 3) Copy the real farm (dry run first, then copy and verify)
TARGET_DATABASE_URL="<atlas url>" node scripts/copy-to-atlas.mjs
TARGET_DATABASE_URL="<atlas url>" node scripts/copy-to-atlas.mjs --apply
#    → must end with "COPIED AND VERIFIED: every count and money total matches."
```

How `copy-to-atlas.mjs` works:
- It keeps every id, so all links between records stay correct.
- Logins and password hashes are copied, so everyone keeps their password. Sessions are not copied, so everyone signs in once more.
- It refuses to copy into a database that already has farms.
- It was tested on 2026-10-20 against a scratch copy: counts, money totals, photo bytes, password hashes and dates were all identical.

## 3. Vercel project (free Hobby plan, account `fahadfahim13`)
The GitHub repo belongs to another account and this login can only read it. So either deploy from the office PC with the Vercel CLI (`npx vercel`), or have the repo owner connect it.

- **Root Directory:** `apps/web`. Turn on "Include files outside the root directory", because the app uses `packages/*`.
- **Framework:** Next.js. **Node.js:** 22.x.
- **Install / Build:** use the defaults. npm workspaces are detected, `postinstall` runs `prisma generate`, and the build is `next build`.
- **Environment variables** (Production). Names are in `apps/web/.env.example`:

| Name | Value |
|---|---|
| `DATABASE_URL` | the Atlas URL from step 1, with `maxPoolSize=5` |
| `JWT_SECRET` | **a new one** (`node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`); don't reuse the local one |
| `NEXT_PUBLIC_APP_URL` | `https://<project>.vercel.app` (no trailing slash) |
| `CRON_SECRET` | 32+ random characters (`randomBytes(24).toString('hex')`) |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | optional: Gmail address, app password and sender name, for "Forgot password" emails |
| `TRUST_CLOUDFLARE` | leave blank (no Cloudflare yet) |
| `MOBILE_*` | optional, the defaults are fine |

- **Cron:** `apps/web/vercel.json` runs `/api/cron/cleanup` daily at 21:30 UTC (03:30 in Bangladesh). Vercel sends `CRON_SECRET` with it.
- **Firewall** (Project → Firewall, free):
  - turn on Bot protection;
  - keep Attack Challenge Mode ready, to switch on if attacked;
  - add a rule that denies request methods other than GET, POST, PUT and DELETE.
  The app's own rate limits cover sign-in and sign-up.

## 4. Check the live site
- [ ] `https://<project>.vercel.app/api/meta/version` returns JSON.
- [ ] Sign in as the owner; the dashboard totals match the local app.
- [ ] Revenue Portal for this month matches the local numbers.
- [ ] Animal photos load.
- [ ] Settings → Data & sync: the storage meter shows, and Download backup works.
- [ ] A manager sees no money pages.
- [ ] Sign in with a wrong password 10 times: you get blocked ("Too many attempts").
- [ ] Response headers include `Strict-Transport-Security` and `Content-Security-Policy`.
- [ ] Optional: free OWASP ZAP baseline scan, `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://<project>.vercel.app`.

## 5. Phone app
- Set `EXPO_PUBLIC_API_URL=https://<project>.vercel.app` in `apps/mobile/.env`, and in the `preview` and `production` profiles of `apps/mobile/eas.json` (they still say `https://REPLACE_WITH_PRODUCTION_URL`).
- Test with Expo Go over **mobile data** (not WiFi): sign in, add a sale, see it on the web within a minute. Then turn on airplane mode, add an expense, turn it off, and it uploads once.
- Installable APK (later): create a free Expo account, then run `npx eas login` and `npx eas build -p android --profile preview`.

## 6. After going live
- The local database becomes a backup: stop entering data on the office PC.
- Download a backup from Settings about once a month and keep it off the phone and PC (e.g. Google Drive).
- Watch the storage meter. Atlas M0 is 512 MB, and photos are the main use (about 70 KB each).
- GitHub repo owner: merge the branch and turn on Dependabot alerts and CodeQL (Settings → Code security).

## Later, with a domain (about $10/year)
- Add the domain in Vercel, put **Cloudflare** (free) in front, and set `TRUST_CLOUDFLARE=1`.
- Verify the domain with **Resend** and set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. This replaces Gmail for emails.
- Update `NEXT_PUBLIC_APP_URL` and the phone's `EXPO_PUBLIC_API_URL` to the new domain.
- Consider HSTS `preload` once the domain is only used for this app.

## Rolling back
- Vercel: Deployments → promote the previous deployment.
- Data: Settings → Data & sync → Restore from backup. It replaces the farm's records and keeps the logins.
