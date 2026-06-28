# Aquarich Pool Reservation

This is a pnpm monorepo for the Aquarich pool reservation and operations system.

## Quick Start

1. Install Node.js 24.
2. Enable pnpm through Corepack: `corepack enable`.
3. Install dependencies: `pnpm install --frozen-lockfile`.
4. Copy `artifacts/api-server/.env.example` to your API environment and set `DATABASE_URL`.
5. Run the API: `pnpm --filter @workspace/api-server run dev`.
6. Run the web app: `pnpm --filter @workspace/pool-reservation run dev`.

The API defaults to port `5000` in development. The web app defaults to port `5173` and proxies `/api` to `http://127.0.0.1:5000`.

## Useful Commands

- `pnpm run typecheck`: typecheck workspace libraries, apps, and scripts.
- `pnpm run build`: typecheck and build all packages with build scripts.
- `pnpm run format:check`: check formatting with Prettier.
- `pnpm run format`: write formatting with Prettier.
- `pnpm run secret:scan`: scan for committed secrets when `gitleaks` is installed.
- `pnpm --filter @workspace/api-spec run codegen`: regenerate API hooks and Zod schemas from OpenAPI.
- `pnpm --filter @workspace/db run push`: push Drizzle schema changes in development.

## Layout

- `artifacts/api-server`: Express API service.
- `artifacts/pool-reservation`: React/Vite app.
- `artifacts/mockup-sandbox`: UI sandbox.
- `lib/db`: Drizzle DB schema and migrations.
- `lib/api-spec`: OpenAPI contract and Orval config.
- `lib/api-client-react`: generated React Query client.
- `lib/api-zod`: generated Zod schemas.
- `scripts`: local utility package.
- `gemma-chat`: separate local AI gateway prototype.

See `replit.md` for the fuller runbook and architecture notes.
