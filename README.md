# Maxled CRM

Gold-and-black CRM for Maxled's sales team. Full product spec at
[`docs/CRM-SPEC.md`](docs/CRM-SPEC.md); a static visual mockup of the design
system at [`design/dashboard-mockup.html`](design/dashboard-mockup.html).

Product/architecture docs: [`docs/PRD.md`](docs/PRD.md) ·
[`docs/SYSTEM-MAP.md`](docs/SYSTEM-MAP.md) ·
[`docs/FEATURE-CATALOG.md`](docs/FEATURE-CATALOG.md) ·
[`docs/SECURITY-AUDIT.md`](docs/SECURITY-AUDIT.md) ·
[`SECURITY.md`](SECURITY.md).

Stack: Next.js (App Router, TypeScript), Tailwind CSS v4, Prisma 7 +
PostgreSQL, NextAuth.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Have a PostgreSQL database available and copy `.env.example` to `.env`
   with its connection string:
   ```bash
   cp .env.example .env
   # edit .env — set DATABASE_URL, AUTH_SECRET
   ```
3. Apply the schema:
   ```bash
   npx prisma migrate dev
   ```
4. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Testing

Three tiers, none requiring anything beyond a local Postgres:

```bash
npm run test:unit          # pure-logic unit tests (Vitest) — no database
npm run test:integration   # real database, RBAC scope enforcement, etc.
npm run test:e2e           # Playwright, drives a real browser against
                            # a dev server it starts for you
```

`npm test` runs unit + integration. Integration and E2E tests need a
reachable `DATABASE_URL` (same one `npm run dev` uses) and, for E2E, the
seeded accounts from `prisma/seed.ts` (`npx prisma db seed`).

**Current coverage** is a deliberately-scoped starter suite, not
exhaustive: unit tests for the RBAC matrix, month-range parsing, MFA
(TOTP) generation/verification, and the CNPJ/CEP lookup clients (mocked
network); one integration test proving `own` vs `all` scope isolation
holds at the database query layer, not just in the permission table;
one E2E spec covering the login flow (success + wrong password). Extend
these as new critical paths are added — the goal is confidence in the
riskiest flows (auth, permissions, the approval pipeline), not 100%
coverage of every module.

## Deploying

The app is a standard Next.js project — it deploys to Vercel (or any
Node host) by connecting this repository and setting `DATABASE_URL` /
`AUTH_SECRET` as environment variables. A free managed Postgres instance
(e.g. Neon or Supabase) works as the production database; point
`DATABASE_URL` at it and run `npx prisma migrate deploy` once.
