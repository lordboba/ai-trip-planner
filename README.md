# AI Trip Planner Website Skeleton

Website-first MVP skeleton for the trip planner described in [planning.md](./planning.md).

The repo now also includes a standalone backend component under [`backend/src`](./backend/src) so the future mobile client and the website can share the same trip API surface.

## Stack

- `Next.js 16.2.1`
- `React 19.2.0`
- `TypeScript 5.9.2`
- `pnpm 10.19.0`
- Custom CSS, no extra UI libraries

## Security posture for package install

This repo intentionally keeps the dependency surface small, pins exact versions, and tracks `pnpm-lock.yaml`. It also ships with `.npmrc` set to `ignore-scripts=true` so package lifecycle scripts do not run during install.

Recommended install command:

```bash
pnpm install --ignore-scripts
```

## Run

```bash
pnpm dev
```

Open `http://localhost:3000`.

## Backend

Run the standalone backend service:

```bash
pnpm backend:dev
```

The backend listens on `http://localhost:8787` by default and exposes:

- `GET /healthz`
- `POST /api/trips`
- `GET /api/trips/:tripId`

The Next.js API routes currently call the same backend service layer directly, so the website keeps working while the mobile-facing backend is being separated.

## Current flow

- Landing page with a designed website-first pitch
- Long-onboarding planner shell
- Provider selector for OpenAI vs Claude
- Mock end-to-end `POST /api/trips` generation flow
- Results page backed by typed trip contracts and an in-memory store
- Standalone backend server with the same trip creation and fetch endpoints

## Next integration steps

1. Replace the mock planner in `lib/mock-planner.ts` with real provider adapters.
2. Move the website to call the standalone backend over HTTP instead of importing the service layer directly.
3. Add Supabase persistence for trip requests and saved plans.
4. Wire Yelp Fusion and Google Places or Foursquare normalization into the coordinator.
5. Add auth and share links.
