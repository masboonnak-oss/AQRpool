# Aquarich Pool Reservation

Management system for a swimming-pool business: member registration, bookings, instructors, wallets/top-ups, shop orders, staff attendance, branch operations, support chat, backups, and admin analytics.

## Run & Operate

- Required runtime: Node.js 24 and pnpm 10. The repo pins this in `package.json` and `.node-version`.
- First setup: `corepack enable`, then `pnpm install --frozen-lockfile`.
- API dev: `pnpm --filter @workspace/api-server run dev` starts the API on port `5000` unless `PORT` is set.
- Frontend dev: `pnpm --filter @workspace/pool-reservation run dev` starts Vite on `PORT` or `5173`, proxying `/api` to `API_TARGET` or `http://127.0.0.1:5000`.
- Full typecheck: `pnpm run typecheck`.
- Full build: `pnpm run build`.
- Format check: `pnpm run format:check`; write formatting with `pnpm run format`.
- API codegen: `pnpm --filter @workspace/api-spec run codegen`.
- Dev DB push: `pnpm --filter @workspace/db run push`.

## Required Env

- `DATABASE_URL` is required by the API and Drizzle.
- `JWT_SECRET` is required in production.
- `DATA_ENCRYPTION_KEY` or `BACKUP_ENCRYPTION_KEY` is required in production.
- `PORT` is optional in development and defaults to `5000` for the API.
- Copy `artifacts/api-server/.env.example` when preparing a new environment.

Optional env includes `CORS_ORIGINS`, `FRONTEND_ORIGINS`, `DATA_DIR`, SMTP settings, `AI_CHAT_ENABLED`, `OLLAMA_URL`, `AI_MODEL`, Firebase project id, OCR/slip verification settings, and backup retention settings.

## Stack

- Workspace: pnpm workspaces with catalog-pinned shared dependencies.
- API: Express 5, TypeScript, esbuild ESM bundle, pino logging.
- DB: PostgreSQL, Drizzle ORM, Drizzle migrations in `lib/db/migrations`.
- Contracts: OpenAPI source in `lib/api-spec/openapi.yaml`.
- Generated clients: Orval outputs React Query hooks in `lib/api-client-react` and Zod schemas in `lib/api-zod`.
- Frontend: React 19, Vite, Tailwind CSS 4, Radix UI, TanStack Query, Wouter.
- PWA: production-only service worker in `artifacts/pool-reservation/public/sw.js`.

## Repo Map

- `artifacts/api-server`: deployable API service. Entrypoints are `src/app.ts` and `src/index.ts`; production bundle is built by `build.mjs`.
- `artifacts/pool-reservation`: deployable web app. Routing starts in `src/App.tsx`; layout components live under `src/components/layout`; role pages live under `src/pages`.
- `artifacts/mockup-sandbox`: isolated Vite sandbox for mockups and reusable UI experiments.
- `lib/db`: DB connection, schema, and migrations. Schema source of truth is `src/schema/index.ts`.
- `lib/api-spec`: OpenAPI contract and Orval config.
- `lib/api-client-react`: generated React Query API client plus `custom-fetch.ts`.
- `lib/api-zod`: generated Zod validators/types from the OpenAPI contract.
- `scripts`: local utility package for project scripts.
- `gemma-chat`: local AI gateway/prototype service, separate from the main API.

## Architecture Decisions

- The API validates environment configuration once on startup through `artifacts/api-server/src/lib/env.ts`, then feature modules can still read `process.env` for their runtime values.
- The API starts migrations during boot for simple single-instance deploys. For multi-instance production, prefer moving migrations to a deployment step with locking.
- Frontend generated hooks are available, but legacy pages still contain direct `fetch` calls. New API work should prefer the generated client or a shared API wrapper.
- Super admin branch switching is currently injected by a small `window.fetch` wrapper in `src/main.tsx`, so raw same-origin `/api` calls inherit the active branch header.
- JWT bearer tokens are currently stored in `localStorage`. This is simple for browser and native-style clients, but a future hardening pass should consider HTTP-only cookies plus CSRF protection.

## Product Areas

- Public landing, registration with captcha/OTP, login, member dashboard/profile.
- Booking, reservations, instructors, facilities, check-in QR flow.
- Membership packages, usage tracking, wallet, top-up slip verification.
- Product catalog, cart, orders, admin order handling.
- Admin dashboards, users/members, branches, settings, theme, audit logs, backups.
- Staff attendance, leave requests, work plans/tasks.
- Support chat, announcements, notifications, AI chat analytics, dev support.

## Gotchas

- Always regenerate API clients after changing `lib/api-spec/openapi.yaml`.
- Production requires real `JWT_SECRET` and data encryption key env values; development fallbacks are intentionally blocked in production.
- `post-merge.sh` installs with the frozen lockfile and pushes the Drizzle schema for `@workspace/db`.
- `node`, `pnpm`, and `corepack` must be on PATH before any workspace commands can run locally.
- The workspace has pnpm `minimumReleaseAge` enabled for supply-chain protection; do not disable it for convenience.
- Run secret scanning (`pnpm run secret:scan` with `gitleaks` installed) before pushing changes.
- Decrypted backup download is disabled unless `ALLOW_DECRYPTED_BACKUP_DOWNLOAD=true` is set for a short recovery window.

## Upgrade Backlog

- Add ESLint and Vitest/Playwright coverage once package installation is available.
- Gradually replace direct frontend `fetch` calls with generated client hooks or shared typed wrappers.
- Move API rate limiting from in-memory maps to Redis or another shared store before horizontal scaling.
- Extract duplicated Radix/shadcn-style UI components from app and sandbox into a shared workspace package.
- Move boot-time migrations to a deploy job for multi-instance production.
