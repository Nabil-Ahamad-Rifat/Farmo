# Deploy the web app to Vercel

This repository is an npm-workspaces monorepo. Deploy the Next.js web app from
`apps/web`; it depends on shared packages in the repository root. The Vercel
configuration at `apps/web/vercel.json` selects Next.js and schedules the
daily cleanup job.

## 1. Check the project before deploying

From the repository root, run:

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build --workspace=apps/web
```

Fix any failures before continuing. Do not commit real environment files,
database credentials, or generated secrets. The root `.gitignore` excludes
`.env` files while allowing `.env.example` templates.

## 2. Create a production MongoDB database

1. Create a MongoDB Atlas cluster and a database user for this app. Use a
   unique, strong password and grant only the database permissions the app
   needs.
2. In Atlas **Network Access**, allow connections from Vercel. Vercel's
   standard Hobby deployments do not have a fixed outbound IP; if you use
   Atlas's `0.0.0.0/0` allowlist entry, restrict the database user as above and
   keep its credentials private.
3. Copy the Atlas connection string. Select the `farm_management` database and
   include `maxPoolSize=5`, for example:

   ```text
   mongodb+srv://<user>:<password>@<cluster-host>/farm_management?retryWrites=true&w=majority&maxPoolSize=5
   ```

   URL-encode special characters in the username or password. Never put the
   real connection string in Git, a public issue, or a chat message.
4. Create a local `apps/web/.env` from `apps/web/.env.example` and put the Atlas
   connection string in `DATABASE_URL`. This file is ignored by Git.
5. From the repository root, create the database collections and indexes:

   ```bash
   npm exec --workspace=apps/web -- prisma db push
   node apps/web/scripts/db-indexes.mjs
   ```

   The index script is safe to rerun. Do not run these commands against a
   production database containing data you need to preserve without first
   making a backup.

### If you have existing farm data to move

Back up the source database first and keep it running until the move is
verified. Set `TARGET_DATABASE_URL` in your local terminal to the Atlas URL,
then run the copy script from the repository root:

```bash
# Dry run: inspect the records and totals that would be copied.
node apps/web/scripts/copy-to-atlas.mjs

# Copy, then verify record counts and money totals.
node apps/web/scripts/copy-to-atlas.mjs --apply

# Run the required Atlas indexes after the copy.
node apps/web/scripts/db-indexes.mjs

# Optional independent verification.
node apps/web/scripts/copy-to-atlas.mjs --verify
```

In PowerShell, set the target without putting the URL into a committed file:

```powershell
$env:TARGET_DATABASE_URL = "mongodb+srv://..."
```

The copy script uses the local database as its default source. Check its output
and confirm that the target is the intended, empty production database before
using `--apply`.

## 3. Import the GitHub repository into Vercel

1. Sign in at [vercel.com](https://vercel.com/) and choose **Add New → Project**.
2. Connect GitHub and import `Nabil-Ahamad-Rifat/Farmo`. If it is not listed,
   authorize the Vercel GitHub app to access that repository.
3. In **Configure Project**, set:
   - **Root Directory:** `apps/web`
   - **Include files outside the Root Directory:** enabled, so the build can
     access the root npm workspace files and `packages/*`.
   - **Framework Preset:** Next.js
   - **Node.js Version:** 22.x
   - **Build Command**, **Output Directory**, and **Install Command:** use the
     detected defaults.
4. Add the production environment variables in the next section before the
   first production deployment.

The `rootDirectory` setting is a Vercel project setting, not a supported
`vercel.json` property. Keep `apps/web` as the Vercel project root so Vercel
uses `apps/web/vercel.json` and its cron configuration.

## 4. Add Vercel environment variables

In the Vercel project, open **Settings → Environment Variables**. Add the
following to **Production** (and to Preview only if you configure a separate
test database there):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Production Atlas connection string from step 2 |
| `JWT_SECRET` | A new random secret, at least 32 characters |
| `NEXT_PUBLIC_APP_URL` | The production URL, such as `https://your-project.vercel.app`, without a trailing slash |
| `CRON_SECRET` | A new random secret, at least 16 characters |

Generate secrets locally with Node.js; use a different secret for each
variable:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Add the final Vercel production URL to `NEXT_PUBLIC_APP_URL` once the project
URL is known. Optional variables such as Google OAuth and email/SMTP are
documented in `apps/web/.env.example`; add them only if you configure those
services. Leave `TRUST_CLOUDFLARE` unset unless Cloudflare actually proxies the
site.

Set these values only in Vercel's environment-variable settings or in your
ignored local `.env` file. Do not prefix secrets with `NEXT_PUBLIC_`.

## 5. Deploy and verify

1. Select **Deploy** in Vercel. Once the first deployment succeeds, open its
   production URL.
2. Check that `https://<your-production-domain>/api/meta/version` returns JSON.
3. Sign in and verify the dashboard, farm records, and animal photos. If you
   migrated data, compare important totals with the backed-up source.
4. Test a normal sign-in and sign-out. If password-reset email is required,
   configure SMTP or Resend and test delivery.
5. In Vercel, confirm the cron job is present and check its function logs after
   its scheduled run. `apps/web/vercel.json` schedules it daily at 21:30 UTC.
6. Keep a backup of the source database until you have verified production
   data and established a regular backup routine.

Vercel automatically creates Preview deployments for other branches and
deploys the connected production branch (normally `main`) when changes are
pushed. Do not point Preview deployments at production data unless that is
intentional.

## 6. Build and distribute the phone app

The phone app is a separate Expo application. Vercel hosts the web app and its
API; it does not create an installable Android APK or iOS app. EAS Build
creates those phone builds in the cloud. Deploy the web app first so the phone
app has a live API URL to use.

1. Open `apps/mobile/eas.json` and replace
   `https://REPLACE_WITH_PRODUCTION_URL` in both the `preview` and `production`
   profiles with the real HTTPS Vercel URL, for example
   `https://your-project.vercel.app`. Do not add a trailing slash.
   `EXPO_PUBLIC_API_URL` is included in the app bundle, so it must be a public
   URL, never a secret or database connection string.
2. From the repository root in PowerShell, go to the mobile app and sign in to
   Expo:

   ```powershell
   Set-Location apps\mobile
   npx eas-cli@latest login
   npx eas-cli@latest whoami
   ```

3. Link this Expo app to your Expo account. Run
   `npx eas-cli@latest init` and follow the prompts to create or select the
   `farm-manager-mobile` project. This adds the EAS project ID to the Expo app
   configuration; keep that change in Git.
4. Build an installable Android APK for yourself or testers:

   ```powershell
   npx eas-cli@latest build --profile preview --platform android
   ```

   When the build finishes, open the build URL from the command output on the
   Android phone and install the APK. The `preview` profile in
   `apps/mobile/eas.json` uses internal distribution, which produces an
   installable Android APK.
5. After testing, create the Android store build:

   ```powershell
   npx eas-cli@latest build --profile production --platform android
   ```

   This creates a production Android app bundle for Google Play. Upload it
   using Google Play Console, or configure EAS Submit after setting up a Play
   Developer account, Play app, and service account credentials. The
   `submit.production.android` values in `apps/mobile/eas.json` are
   placeholders until you configure those credentials.
6. For iPhone, create a store build with
   `npx eas-cli@latest build --profile production --platform ios`. Installing
   on iPhones or distributing through the App Store requires Apple signing
   credentials and an Apple Developer Program membership.

After changing the production API URL, commit and push the changes. Vercel
automatically redeploys the web app from the connected production branch;
start a new EAS build separately to put the new URL into the phone app binary.
The phone and website then use the same production API and Atlas database.

## Rollback

Use **Vercel → Deployments** to promote a previously successful deployment.
Application rollback does not roll back database changes; keep database
backups and review schema changes before deploying them.
