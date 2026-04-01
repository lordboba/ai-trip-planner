# AI Trip Planner

Website-first MVP skeleton for the trip planner described in [planning.md](./planning.md).

The repo includes a standalone backend component under [`backend/src`](./backend/src) so the website and any future client can share the same schedule-planning API surface.

For deployment, the intended phase-one setup is a single Vercel project: the Next.js frontend and the API routes ship together, while the backend workflow logic remains isolated under `backend/src`.

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

Note on TypeScript config: Next.js 16 may rewrite `tsconfig.json` during `dev` or `build` to add generated `.next/types` includes. This repo uses `tsconfig.typecheck.json` for `pnpm typecheck` so local typechecking remains stable even when Next mutates the main file.

Optional web-to-backend override:

```bash
BACKEND_URL=http://127.0.0.1:8787
```

Leave `BACKEND_URL` unset for the same-project Vercel shape, where the Next app uses the backend service layer in-process. Set it only when the web app should call a separately deployed backend.

Optional access gate:

```bash
TRIPWISE_ACCESS_CODE=your-shared-code
```

If `TRIPWISE_ACCESS_CODE` is set, the landing page shows a first-screen access gate and the planner routes stay locked behind an httpOnly cookie until the correct code is entered. Leave it unset to disable the gate entirely.

## Backend

Run the standalone backend service:

```bash
pnpm backend:dev
```

The backend listens on `http://localhost:8787` by default and exposes:

- `GET /healthz`
- `POST /api/schedule-plans`
- `GET /api/schedule-plans/:planId`
- `POST /api/schedule-plans/:planId/suggestions/:suggestionId/add`

The Next.js API routes go through a backend adapter. With no `BACKEND_URL`, they call the backend service layer in-process. If `BACKEND_URL` is set, schedule-plan creation, fetch, and suggestion-add switch to HTTP calls against that external backend without changing the UI code.

## Vercel deployment shape

- Deploy frontend and backend in the same Vercel project for phase one.
- Keep the route handlers under `app/api/*` as the deployable backend surface.
- Keep orchestration, schemas, and state-machine logic under `backend/src/*` so mobile and web share the same backend contracts.
- The standalone `backend/src/server.ts` remains useful for local dev and eventual split-project deployment, but it is not required for Vercel.

## Current flow

- Landing page with a designed website-first pitch
- Schedule-first planner shell with Google Calendar or `.ics` import
- Provider selector for OpenAI vs Claude
- Live-or-fallback `POST /api/schedule-plans` generation flow
- Google Places-powered destination autocomplete in onboarding
- Timeline-first results page backed by typed schedule-plan contracts and an in-memory store
- Standalone backend server with the same schedule-plan creation, fetch, and add-suggestion endpoints
- Structured dining, itinerary, and budget workflow orchestration with validated step outputs and stored workflow metadata


## Google Calendar OAuth env vars

To enable one-click Google Calendar auth and event import:

```bash
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback
```

In Google Cloud Console, set the authorized redirect URI to match `GOOGLE_OAUTH_REDIRECT_URI` exactly.
Also enable the Google Calendar API for the same Google Cloud project that owns the OAuth client.

## Next integration steps

1. Persist schedule plans in a real database instead of the in-memory store.
2. Add richer route-aware ranking using event locations and map distance signals.
3. Move the website and mobile clients to a dedicated backend URL only if we outgrow the single-project Vercel setup.
4. Add auth and share links.

## AI provider env vars

The backend will attempt live structured generation when the matching provider key is present:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini

ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

If a provider key is missing, or a live call fails, each agent step falls back to deterministic schedule-planning logic and records the fallback in workflow metadata.

## Google Places env vars

The planner will attempt live place retrieval before the dining, activity, and lodging ranking steps when:

```bash
GOOGLE_PLACES_API_KEY=...
GOOGLE_PLACES_LANGUAGE_CODE=en
```

If `GOOGLE_PLACES_API_KEY` is missing, the planner falls back to deterministic place candidates and still returns a full schedule plan.
