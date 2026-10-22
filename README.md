# Farm Management

A monorepo for the farm-management app: a Next.js web app and a React Native (Expo) mobile companion app, sharing types/validation/business-logic/API-client packages.

## Layout

```
apps/
  web/       Next.js 16 app (App Router), Prisma + MongoDB Atlas — the original app
  mobile/    React Native (Expo) app — auth + full CRUD for all 7 data sections
packages/
  shared-types/        canonical TypeScript types shared across apps
  shared-validation/   zod validation schemas shared across apps
  business-logic/      pure calculation/date helpers shared across apps
  api-client/          typed HTTP client shared across apps
```

## Getting started

From the repo root:

```bash
npm install
npm run dev        # turbo run dev — starts every app in dev mode
```

To run a single app: `npm run dev --workspace=apps/web` (or `cd apps/web && npm run dev`), and likewise for `apps/mobile` (`expo start`).

See `apps/web/.env.example` and `apps/mobile/.env.example` for the environment variables each app needs (copy to `.env` in that app's folder and fill in real values — never commit the real file). The mobile app needs the web app's API reachable at `EXPO_PUBLIC_API_URL`; see the comments in `apps/mobile/.env.example` for the right value depending on whether you're using a simulator, emulator, or physical device.

## Common scripts (run from the repo root, via Turborepo)

- `npm run dev` — start all apps in development mode
- `npm run build` — build all apps
- `npm run lint` — lint all apps/packages
- `npm run typecheck` — type-check all apps/packages
- `npm run test` — run the shared-package test suites (Vitest)
