# Testing Strategy

This document describes the **recommended** automated-testing approach for
Maxled CRM. It is a plan, not an implementation — no test framework, test
files, or new dependencies are added to the codebase as part of this
document. Adopting it (installing the tools, writing the actual test
files) is a separate, future decision.

Today the project has **no automated tests**. Correctness is currently
verified by `npx tsc --noEmit` (typecheck), `npm run lint`, and manual
smoke testing in the browser before each change ships. That catches type
errors and obvious breakage, but nothing here today would catch a
regression in, say, who's allowed to see whose data.

## Why this matters for Maxled specifically

The riskiest class of bug in this app is not "the UI looks wrong" — it's
**a permission or scope check silently returning the wrong rows**: a
seller seeing another seller's client, or a role gaining edit access it
shouldn't have. That logic lives in plain TypeScript (`src/lib/*.ts`,
`src/lib/permissions.ts`) and is exercised by every module, which makes
it both high-value and low-effort to test — no browser or UI needed to
verify it.

## Recommended tooling

| Tier | Tool | Why this one |
|---|---|---|
| Unit | [Vitest](https://vitest.dev) | Native TypeScript/ESM support, fast, near-identical API to Jest, works well with Next.js/Prisma projects without extra config |
| Integration | Vitest against a real local Postgres | Proves scope-filtering logic holds at the actual query layer, not just in a permissions table read in isolation |
| E2E | [Playwright](https://playwright.dev) | Drives a real browser against a real running dev server; the standard choice for Next.js App Router projects, good CI story |

No new runtime dependency would be needed — only `devDependencies`
(test runner + browser driver), so production bundle/behavior is
unaffected either way.

## Tier 1 — Unit tests (pure logic, no database)

Fastest tier, run on every save. Target the modules where a small input
change has an outsized correctness impact:

- **`src/lib/permissions.ts`** — the RBAC matrix itself: for every
  `(role, module)` pair, `getPermission`/`canView`/`canEdit`/
  `seesOtherUsers`/`canApproveClients` return what the matrix says they
  should. This is the single highest-value test in the app — it's the
  thing every other authorization check is built on.
- **Month/date-range filter parsing** — used across Clientes, Negócios,
  and Agenda; easy to get an off-by-one-day or timezone bug into.
- **MFA (TOTP) generation/verification** — secret generation, code
  verification, and the confirm-before-persist flow (`src/lib/mfa.ts`).
- **CNPJ/CEP lookup clients** (`src/lib/cnpj-lookup.ts`,
  `src/lib/cep-lookup.ts`) — with the network call mocked, verifying the
  response-shape parsing and error handling, not the third-party API
  itself.

## Tier 2 — Integration tests (real local Postgres)

Same test runner (Vitest), but exercising real `lib/*.ts` functions
against an actual database rather than mocks — the only way to prove
that a `*ScopeWhere(session)` helper (the mechanism every module relies
on for `own`/`team`/`all` scope enforcement — see `PRD.md` §7.1) filters
correctly when it hits real SQL, not just that the function was called
with the right arguments.

Minimum viable coverage: one test per module proving `own` scope
isolation — e.g. "a seller's `listContacts()` call does not return
another seller's contact; a mediador's call does." This is the test
that would have caught a real scope-filter regression before it shipped.

Requires a reachable `DATABASE_URL` (the same local Postgres used by
`npm run dev`); no separate test database needed if tests clean up
their own rows in `afterAll`.

## Tier 3 — E2E tests (real browser, real dev server)

Smallest tier by test count — E2E is the slowest and most brittle layer,
so it should only cover flows where nothing less end-to-end would give
confidence:

- **Login** — correct credentials reach the app; wrong credentials show
  a clear error and do not redirect; account lockout after repeated
  failures.
- **The approval pipeline** (Prospecções → ativação → aprovação do
  mediador) — the one flow that spans multiple roles and multiple pages
  in a single business process.

Playwright can start its own dev server for the test run
(`webServer` config) so this doesn't require a separately-running app.

## What NOT to test (for now)

- Every CRUD form field individually — low value relative to effort;
  caught well enough by typecheck + manual smoke test today.
- Visual/pixel-level UI regressions — no design-review budget for this
  yet; revisit if the design system stabilizes and a visual-diff tool
  becomes worth adopting.
- Third-party integrations Maxled doesn't control the uptime of
  (ViaCEP, BrasilAPI) — mock these at the boundary instead of hitting
  them in tests.

## Suggested rollout order

1. Unit tests for `permissions.ts` first — highest value, zero
   infrastructure needed (no database, no browser).
2. Integration test for one module's scope isolation (e.g. Vendas/
   Clientes) as the template for the rest.
3. One E2E login spec, since auth is the single most consequential flow
   to regress silently.
4. Extend tier-by-tier as new critical paths are added — the goal is
   confidence in the riskiest flows (auth, permissions, the approval
   pipeline), not 100% coverage of every module.

## CI

Not set up today (no CI pipeline exists in this repository). Once any
of the above is implemented, the natural next step is a GitHub Actions
workflow running `typecheck` + `lint` + unit + integration tests on every
PR (E2E is optional in CI given its cost/flakiness profile, or can run
on a schedule instead of per-PR).

## Related documents

- `PRD.md` §7 — architecture and security decisions this strategy
  supports (RBAC, scope enforcement).
- `SECURITY-AUDIT.md` — the two findings a scope-isolation integration
  test and a headers/cron-auth check would help guard against
  regressing on, once fixed.
