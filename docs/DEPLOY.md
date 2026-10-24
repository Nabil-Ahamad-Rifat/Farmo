# Farm Manager deploy guide

এই guide-এ ধাপে ধাপে দেখানো হয়েছে কীভাবে **website/API Vercel-এ** এবং
**Android/iPhone app Expo EAS-এ** চালু করবেন।

## আগে পুরো বিষয়টা বুঝে নিন

- **Vercel** website ও API চালায়।
- **MongoDB Atlas** user, farm record, cow photo-সহ app-এর data রাখে।
- **Expo EAS** Android APK/Play Store build এবং iPhone build তৈরি করে।
- Phone app এবং website একই Vercel API ব্যবহার করতে পারে; তাই দুটোই একই
  Atlas database-এর সঙ্গে কাজ করে।
- Website-এর deploy আর phone app-এর build **আলাদা কাজ**। Vercel deploy করলে
  আগে থেকে install করা phone app নিজে থেকে update হয় না।

## আপনার কাজের সহজ ক্রম

1. Atlas database ও connection প্রস্তুত করুন।
2. GitHub-এর `main` branch-এ code push করুন।
3. Vercel-এ `apps/web` project হিসেবে import করে environment variables দিন।
4. Deploy হওয়ার পর website ও database পরীক্ষা করুন।
5. Website ঠিক থাকলে Expo EAS দিয়ে phone app build করুন।

> **জরুরি নিরাপত্তা:** কোনো `.env` ফাইল, database URL, database password,
> JWT secret বা API key GitHub-এ push করবেন না। আগে chat বা অন্য কোথাও
> password প্রকাশিত হয়ে থাকলে সেটি Atlas-এ বদলে নতুন password ব্যবহার করুন।

## ১. Computer-এ code পরীক্ষা করুন

VS Code-এ project folder খুলে PowerShell terminal চালু করুন। Terminal অন্য
কোনো folder-এ থাকলে repository root-এ যেতে:

```powershell
Set-Location (git rev-parse --show-toplevel)
```

Node.js 22 ব্যবহার করুন। এরপর dependencies install ও checks চালান:

```powershell
npm ci
npm run typecheck
npm run lint
npm run test
npm run build --workspace=apps/web
```

কোনো command ব্যর্থ হলে error ঠিক না করে পরের ধাপে যাবেন না। Web build
সফল মানে শুধু code build হয়েছে; এতে Vercel deploy বা phone APK build হয় না।

### Database connection পরীক্ষা

```powershell
npm run db:check --workspace=apps/web
```

সফল হলে এমন বার্তা পাবেন:

```text
MongoDB Atlas connected successfully (ping and Prisma read transaction succeeded).
```

এটি database connection ও Prisma transaction পরীক্ষা করে, কিন্তু কোনো farm
data লেখে না। Check প্রথমে terminal-এর `DATABASE_URL`, তারপর
`apps/web/.env.local`, তারপর `apps/web/.env` ব্যবহার করে।

ব্যর্থ হলে Atlas-এ cluster চালু আছে কি না, **Security → Network Access**-এ
আপনার computer-এর public IP অনুমোদিত কি না, এবং **Database Access**-এ
database user সক্রিয় কি না দেখুন। Password-এ `@` থাকলে URL-এ `%40` লিখতে
হয়। URL/password terminal screenshot, chat বা GitHub-এ দেবেন না।

## ২. MongoDB Atlas প্রস্তুত করুন

1. MongoDB Atlas-এ cluster তৈরি বা চালু করুন। Cluster `Available` হওয়া পর্যন্ত
   অপেক্ষা করুন।
2. **Database Access** থেকে app-এর জন্য database user তৈরি করুন। শক্তিশালী,
   অন্য কোথাও ব্যবহার না-করা password দিন; সম্ভব হলে permission শুধু
   `farm_management` database-এ সীমাবদ্ধ রাখুন।
3. **Security → Network Access**-এ network access configure করুন:
   - Local computer থেকে test করতে computer-এর বর্তমান public IP add করুন।
   - Vercel-এর জন্য আলাদা network access দরকার। আপনার Vercel plan-এ fixed
     outbound IP না থাকলে Atlas allowlist সেটিং deploy-এর জন্য উপযুক্তভাবে
     configure করতে হবে। `0.0.0.0/0` মানে যেকোনো IP address থেকে connection
     করা যাবে—এটি ব্যবহার করলে database user-এর password শক্তিশালী রাখুন
     এবং permission সীমিত করুন।
4. Atlas **Connect → Drivers** থেকে connection string নিন। Database name
   `farm_management` ও `maxPoolSize=5` দিন। Format:

   ```text
   mongodb+srv://<user>:<URL-encoded-password>@<cluster-host>/farm_management?retryWrites=true&w=majority&maxPoolSize=5
   ```

   `<user>`, `<URL-encoded-password>`, `<cluster-host>`-এর জায়গায় আপনার Atlas
   তথ্য বসবে। সম্পূর্ণ URL-টি কাউকে পাঠাবেন না।
5. Project-এর `apps/web/.env.example` দেখে নিজের computer-এ
   `apps/web/.env` তৈরি/আপডেট করে `DATABASE_URL`-এ Atlas URL রাখুন।
   `.env` ও `.env.local` Git-এ commit করবেন না।
   - **Local app-এ Atlas ব্যবহার করতে চাইলে** `apps/web/.env.local`-এর
     `DATABASE_URL`-ও Atlas URL করুন: Next.js development-এ `.env.local`,
     `.env`-এর চেয়ে আগে পড়ে। `.env.local`-এ `127.0.0.1` থাকলে app Atlas নয়,
     computer-এর নিজের local MongoDB-তে connect করার চেষ্টা করবে।
6. Atlas database-এ schema ও app-এর প্রয়োজনীয় index তৈরি করুন। Repository
   root-এ command চালান:

   ```powershell
   npm exec --workspace=apps/web -- prisma db push
   node apps/web/scripts/db-indexes.mjs
   ```

   **আগে থেকেই গুরুত্বপূর্ণ data থাকলে** backup ছাড়া `prisma db push` চালাবেন
   না। ভুল database-এ command চালালে data/schema বদলে যেতে পারে।

### পুরোনো local farm data Atlas-এ নিতে হলে

আগে source database backup করুন। এই migration ধাপ শুধু local data Atlas-এ
নিতে চাইলে; নতুন, খালি database হলে এটি বাদ দিন।

PowerShell-এ repository root থেকে target URL-টি terminal environment-এ দিন:

```powershell
$env:TARGET_DATABASE_URL = "mongodb+srv://..."
```

এখানে `...`-এর জায়গায় আসল URL বসাবেন, কিন্তু সেটি terminal screenshot বা
chat-এ share করবেন না। তারপর:

```powershell
# আগে শুধু কী copy হবে দেখে নিন; data copy হবে না
node apps/web/scripts/copy-to-atlas.mjs

# Target ঠিক ও খালি নিশ্চিত হওয়ার পরেই copy করুন
node apps/web/scripts/copy-to-atlas.mjs --apply

# Copy শেষে Atlas indexes তৈরি করুন
node apps/web/scripts/db-indexes.mjs

# চাইলে copy verify করুন
node apps/web/scripts/copy-to-atlas.mjs --verify
```

`--apply` চালানোর আগে output-এ source/target database ঠিক আছে কি না যাচাই
করুন। Script target-এ আগে থেকেই farm থাকলে সাধারণত copy বন্ধ করে দেয়।
পুরোনো database backup রেখে data মিলিয়ে না দেখা পর্যন্ত সেটি মুছবেন না।

## ৩. পরিবর্তন GitHub-এ push করুন

যে পরিবর্তন Vercel-এ deploy করতে চান, সেগুলো commit করে `main`-এ push করুন।
আগে দেখে নিন কোনো `.env` stage হয়নি:

```powershell
git status --short
```

শুধু project code ও documentation stage করুন—`.env` নয়। উদাহরণ:

```powershell
git add apps/web/package.json package-lock.json apps/web/scripts/check-db.mjs docs/DEPLOY.md
git commit -m "Prepare web app for Vercel deployment"
git push origin main
```

যে ফাইলগুলো বদলেছেন শুধু সেগুলোই `git add`-এ দিন। `git status --short`-এ
`.env` দেখা গেলে সেটি stage/push করবেন না।

## ৪. Vercel-এ website project তৈরি করুন

1. [Vercel Dashboard](https://vercel.com/dashboard)-এ login করুন।
2. **Add New → Project** নির্বাচন করুন।
3. GitHub connect করে `Nabil-Ahamad-Rifat/Farmo` repository import করুন।
   Repository না দেখালে Vercel-এর GitHub app-কে ওই repository access দিন।
4. **Configure Project**-এ নিচের settings দিন:

   | Setting | কী নির্বাচন করবেন |
   |---|---|
   | Root Directory | `apps/web` |
   | Include files outside the Root Directory | চালু / enabled |
   | Framework Preset | Next.js |
   | Node.js Version | `22.x` |
   | Install Command | Vercel-এর detected default |
   | Build Command | Vercel-এর detected default |
   | Output Directory | Vercel-এর detected default |

   `apps/web`-এর বাইরের files অন্তর্ভুক্ত করা জরুরি: web app root npm workspace
   ও `packages/*`-এর shared code ব্যবহার করে। Root Directory Vercel Dashboard-এ
   দিতে হয়—`vercel.json`-এ নয়। এই project-এর cron config
   `apps/web/vercel.json`-এ আছে, তাই `apps/web`-ই project root রাখুন।
   Vercel log-এ environment variable নিয়ে Turborepo warning দেখালে নিশ্চিত
   করুন `turbo.json`-এর `build.env` list-এ সেই variable আছে। এই project-এর
   প্রয়োজনীয় app variables list-এ আগে থেকেই যোগ করা আছে।

5. Environment variables যোগ করার পর **Deploy** চাপুন।

## ৫. Vercel-এ environment variables যোগ করুন

Vercel project-এ **Settings → Environment Variables** খুলুন। প্রতিটি variable
এর জন্য **Production** নির্বাচন করুন:

| Name | কী value দেবেন |
|---|---|
| `DATABASE_URL` | ধাপ ২-এর production Atlas connection string |
| `JWT_SECRET` | নিচের command থেকে তৈরি নতুন secret |
| `CRON_SECRET` | নিচের অন্য command থেকে তৈরি আলাদা secret |
| `NEXT_PUBLIC_APP_URL` | `https://<আপনার-project>.vercel.app` — শেষে `/` দেবেন না |

Secret আপনার নিজের PowerShell-এ তৈরি করুন:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

প্রথম command-এর output `JWT_SECRET`; দ্বিতীয়টির output `CRON_SECRET`।
দুটি secret একে অন্যের বদলে ব্যবহার করবেন না। Vercel value field-এ value
paste করুন; `.env`-এর মতো quotation mark দেবেন না। Secret-গুলো chat বা GitHub-এ
লিখবেন না।

`NEXT_PUBLIC_APP_URL`-এ Vercel project-এর production URL দিন। URL নাম এখনো
নির্দিষ্ট না হলে project name ঠিক করে পাওয়া URL ব্যবহার করুন; deploy-এর
পরে URL বদলালে variable update করে আবার deploy দিন।

ঐচ্ছিক service—শুধু ব্যবহার করলে যোগ করুন:

- Google login: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; mobile Google
  login-এর জন্য আলাদা iOS/Android client ID-ও লাগতে পারে।
- Password reset email: Gmail/SMTP হলে `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`;
  Gmail-এর সাধারণ password নয়, App Password ব্যবহার করুন।
- Resend হলে `RESEND_API_KEY`, `RESEND_FROM_EMAIL` এবং verified domain লাগবে।
- Cloudflare site-এর সামনে configure না করা পর্যন্ত `TRUST_CLOUDFLARE` ফাঁকা
  রাখুন।

সমস্ত variable save করার পর deployment দিন। Environment variable পরিবর্তন
আগের deployment-এ নিজে থেকে লাগু হয় না—পরিবর্তনের পরে **Redeploy** করতে হয়।

## ৬. Vercel deploy ও status দেখা

GitHub `main` branch connected থাকলে নতুন commit push করলে Vercel নিজে
deployment শুরু করবে:

```powershell
git push origin main
```

তারপর Vercel project-এর **Deployments** tab খুলুন। নতুন deployment-এ
`Building` থেকে `Ready` হলে deploy সফল। `Failed` হলে deployment খুলে
**Build Logs**-এর একদম নিচের প্রথম আসল `Error` দেখুন। শুধু warning দেখে
failure ধরে নেবেন না।

GitHub auto deploy ব্যবহার না করে terminal থেকে deploy করতে চাইলে repository
root-এ:

```powershell
npx vercel login
npx vercel link --cwd apps/web
npx vercel --prod --cwd apps/web
```

প্রথমবার login করুন, `link` prompt-এ সঠিক Vercel project বাছুন, এবং project
settings-এ Root Directory `apps/web` আছে কি না নিশ্চিত করুন। পরের deploy-এ
সাধারণত শুধু শেষ command-টি দরকার। **GitHub auto deploy অথবা CLI—একটি পথ
বেছে নিলেই যথেষ্ট।**

## ৭. Live website পরীক্ষা করুন

1. Production URL খুলুন, যেমন `https://your-project.vercel.app`।
2. `https://your-project.vercel.app/api/meta/version` খুলে JSON response
   আসে কি না দেখুন।
3. Login page খুলে দেখুন। Atlas-এ আগে থেকেই user থাকলে সেই account দিয়ে
   login করুন।
4. Registration পরীক্ষা করতে হলে কেবল test account ব্যবহার করুন। Register
   করলে Atlas database-এ আসল user ও farm record লেখা হবে।
5. Test farm-এ cow/customer record যোগ করুন, page reload করে record আছে কি
   না দেখুন। Cow photo upload করে তা পুনরায় load হয় কি না পরীক্ষা করুন।
   ছবিও `DATABASE_URL`-এর Atlas database-এর `AnimalPhoto` collection-এ
   সংরক্ষিত হয়।
6. Atlas-এ আগের farm data migrate করলে dashboard totals ও কয়েকটি record
   source backup-এর সঙ্গে মিলিয়ে নিন।
7. Password reset email দরকার হলে SMTP/Resend configure করে test করুন।
8. **Vercel → Settings/Cron Jobs** বা project cron view-এ cleanup schedule
   দেখুন। `apps/web/vercel.json`-এ এটি প্রতিদিন `21:30 UTC`-তে চলে।

Atlas database-এ production data থাকলে test করার সময় delete/overwrite করবেন
না। নিয়মিত database backup রাখুন। Vercel deployment rollback করলে code
পেছনে যায়, database-এর পরিবর্তন স্বয়ংক্রিয়ভাবে rollback হয় না।

## ৮. Phone app build করা

Web site live হওয়ার পর phone app configure করুন। Vercel Android APK বা
iPhone app build করে না; Expo EAS করে।

1. `apps/mobile/eas.json` খুলুন। `preview` ও `production` profile-এ থাকা
   `https://REPLACE_WITH_PRODUCTION_URL`-এর বদলে production Vercel URL দিন।
   শেষে `/` নয়। এই public API URL app build-এর মধ্যে থাকবে—এখানে secret
   বা database URL কখনো দেবেন না।
2. PowerShell-এ repository root থেকে:

   ```powershell
   cd apps\mobile
   npx eas-cli@latest login
   npx eas-cli@latest whoami
   ```

3. প্রথমবার EAS project link করতে:

   ```powershell
   npx eas-cli@latest init
   ```

   Prompt অনুসারে Expo account-এ `farm-manager-mobile` project তৈরি/নির্বাচন
   করুন। এতে app configuration-এ EAS project ID যুক্ত হবে; পরিবর্তনটি Git-এ
   commit করুন।
4. Android phone-এ install করে tester-দের দিয়ে দেখার জন্য APK build করুন:

   ```powershell
   npx eas-cli@latest build --profile preview --platform android
   ```

   Build শেষ হলে EAS build link Android phone-এ খুলে APK install করুন।
5. Play Store-এর জন্য production Android build:

   ```powershell
   npx eas-cli@latest build --profile production --platform android
   ```

   Store-এ প্রকাশ করতে Google Play Developer account, Play Console-এ তৈরি
   app, এবং signing/submission credentials লাগবে। `apps/mobile/eas.json`-এর
   Android submit settings placeholder থাকতে পারে—submit করার আগে সেগুলো
   configure করুন।
6. iPhone App Store build:

   ```powershell
   npx eas-cli@latest build --profile production --platform ios
   ```

   Apple signing credentials ও Apple Developer Program membership লাগবে।

API URL পরিবর্তনের পরে নতুন EAS build করতে হবে। Website-এর Vercel deploy
করলেই আগে install করা phone app-এর bundled URL বদলায় না।

## সমস্যা হলে দ্রুত কোথায় দেখবেন

| লক্ষণ | কী পরীক্ষা করবেন |
|---|---|
| Vercel build-এ package/module missing | Root Directory `apps/web`, `Include files outside the Root Directory` enabled, lockfile push হয়েছে কি না |
| `DATABASE_URL` missing/Prisma error | Vercel Production environment-এ `DATABASE_URL` যোগ, তারপর Redeploy |
| Turbo warning: Vercel variable missing from `turbo.json` | `turbo.json`-এর web `build.env` allowlist-এ variable যোগ করে commit/push, তারপর Redeploy |
| Atlas server-selection timeout | Cluster running, Atlas Network Access/IP allowlist, database user ও password |
| `Transactions are not supported` | Prisma feature-এর জন্য replica-set support দরকার; standalone local MongoDB নয় |
| Local app `127.0.0.1:27018` খোঁজে | `apps/web/.env.local` `.env`-কে override করছে; local URL বদলান বা local MongoDB চালান |
| Phone app API-তে connect করতে পারে না | `eas.json`-এর production URL, HTTPS, এবং Vercel deployment `Ready` কি না |
| Environment variable বদলেও পুরোনো আচরণ | নতুন Vercel Redeploy দিন; Expo public URL বদলালে নতুন EAS build করুন |

## Rollback

Code rollback করতে Vercel **Deployments** থেকে আগের সফল deployment promote
করুন। এটি database rollback নয়। Data/schema পরিবর্তনের আগে backup রাখুন,
এবং rollback-এর পর live data আলাদাভাবে যাচাই করুন।
