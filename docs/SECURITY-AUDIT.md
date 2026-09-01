# Security Audit

Code-level review of the Maxled CRM codebase as of 2026-08. Scope:
authentication, authorization, injection risk, secrets handling, session
security, dependency vulnerabilities, and transport security. This is a
manual code review, not a penetration test or automated SAST/DAST scan —
treat it as a strong first pass, not a substitute for periodic re-review
as the app grows.

**Severity key:** 🔴 Fix now · 🟠 Fix soon · 🟡 Note/accept · ✅ Good, no action.

---

## 1. Authentication

| Finding | Severity | Status |
|---|---|---|
| Passwords hashed with bcrypt (cost factor 10) | ✅ | Industry standard |
| Account lockout after 7 failed attempts, mediador-only unlock | ✅ | Effective brute-force mitigation on the login endpoint itself |
| Optional TOTP MFA, offline-generated (no external dependency) | ✅ | Sound implementation — secret only persisted after a verified confirm step |
| No self-service password reset (no e-mail infra) | 🟡 | Documented limitation (`PRD.md` §3.2); accepted for now — a forgotten password currently requires a manual DB migration by whoever maintains the code |
| `AUTH_SECRET` reused as the bearer token for `/api/setup/seed` | 🟡 | Deliberate, documented tradeoff (avoids a second secret) — but it does mean a leaked `AUTH_SECRET` compromises both session signing *and* the one-time seed endpoint. Low risk in practice: that endpoint's writes are all idempotent upserts, not destructive. |

## 2. Authorization (RBAC)

| Finding | Severity | Status |
|---|---|---|
| Every server action gated by a `requireEdit()`/`requireView()`-equivalent check before touching data | ✅ | Verified across `vendas`, `negocios`, `prospeccoes`, `perfil`, `meu-perfil`, `config` action files |
| Every list/read query scoped via `*ScopeWhere(session)` | ✅ | Defense-in-depth: even if a page-level check were ever missed, the query itself can't return another user's "own"-scoped rows |
| Client activation approval scoped to `MEDIATOR`/`MANAGER` only, checked server-side (not just UI-hidden) | ✅ | `canApproveClients()` enforced in `approveActivation`/`rejectActivation`/`listPendingActivationRequests`, not just in the button's visibility |
| Cross-module reuse of another module's server action (e.g. Prospecções' new-client form reusing `lookupCnpjAction`, gated on `vendas` edit permission) | 🟡 | Functionally safe today — every role that can reach the calling UI already has `vendas` edit per the current matrix — but worth a comment/test if the matrix ever diverges (flagged, not fixed, since fixing it means adding a parallel action for no current behavioral difference) |

## 3. Injection & Output Encoding

| Finding | Severity | Status |
|---|---|---|
| SQL injection | ✅ | All queries go through Prisma's parameterized query builder; no `$queryRaw`/`$executeRaw` usage in application code (only inside Prisma's own generated client internals, which is expected and safe) |
| XSS | ✅ | No `dangerouslySetInnerHTML`, no `eval`/`new Function` anywhere in `src/` |
| CSRF | ✅ | NextAuth v5 handles CSRF token issuance/validation for the Credentials flow; all app mutations are Server Actions (POST-only, same-origin by the framework's own protections) |

## 4. Secrets & Sensitive Data

| Finding | Severity | Status |
|---|---|---|
| `.env` never committed | ✅ | Confirmed via `git log --all -- .env` (no history) and `git ls-files` (only `.env.example`, placeholder values) |
| `.env.example` contains no real credentials | ✅ | Verified by inspection |
| PII (email, phone, address, CNPJ) stored unencrypted at the field level | 🟡 | Accepted for current scale — Neon encrypts at rest (disk-level) and all access is authenticated + RBAC-scoped; field-level encryption is listed as a future item in `CRM-SPEC.md` §8 if the PII sensitivity/volume grows |
| MFA secrets (`User.mfaSecret`) stored in plaintext in the database | 🟡 | Standard practice for TOTP secrets in small applications; never exposed to the client after initial setup confirmation |

## 5. API / Cron Endpoints

| Finding | Severity | Status |
|---|---|---|
| 🔴 `/api/cron/advance-deals` **fails open** if `CRON_SECRET` is unset | Pendente | The check is `if (secret) { ...validate... }` — if the env var is missing (e.g. a misconfigured deploy), the endpoint requires **no authorization at all**, letting anyone trigger deal-stage advancement. Its sibling route (`/api/cron/full-export`) already does this correctly (fails closed, 500 if unset). **Recommended fix:** make `advance-deals` fail closed the same way — return 500 if `CRON_SECRET` is unset, instead of falling through to no-auth. Not applied to the codebase yet; this pass is documentation only. |
| `/api/full-export` (browser-triggered) session-gated on `config` view permission | ✅ | Correct — separate code path from the cron variant, uses `auth()` + `canView`, not `CRON_SECRET` |
| `/api/setup/seed` requires `AUTH_SECRET` as bearer/query token | 🟡 | See §1 note — accepted tradeoff, all writes are idempotent |

## 6. Transport Security & Headers

| Finding | Severity | Status |
|---|---|---|
| TLS enforced on all traffic | ✅ | Automatic via Vercel — every deployment gets HTTPS, HTTP requests are redirected |
| `Strict-Transport-Security` (HSTS) header | 🔴 Ausente | Not currently sent by the app. TLS itself is already enforced by Vercel (HTTP redirected to HTTPS on every deployment), but without this header browsers have no instruction to always use HTTPS for this origin on their own, and the domain isn't eligible for HSTS preload. **Recommended fix:** add a `headers()` function in `next.config.ts` returning `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` for all routes (2-year max-age, matching preload-list requirements). Not applied yet — documentation only. |
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | 🔴 Ausentes | Not currently sent by the app. **Recommended fix:** add alongside HSTS in the same `headers()` function — `nosniff`, `DENY`, `strict-origin-when-cross-origin` respectively. Not applied yet. |
| WAF / bot mitigation / edge rate limiting | 🟡 | Not implemented — requires an infrastructure decision (Cloudflare in front of Vercel, or Vercel's own Firewall product). See `PRD.md` §7.4. Application-level rate limiting (beyond the login lockout) is also not implemented. |

## 7. Dependency Vulnerabilities

`npm audit` (run 2026-08) reports 15 known vulnerabilities (2 critical, 6
high, 7 moderate) — **all in transitive dependencies**, none in code this
project owns:

| Package | Severity | Source |
|---|---|---|
| `@auth/core` / `next-auth` | Critical | NextAuth v5 beta's own dependency chain |
| `next` | High | Framework itself (Turbopack/Server Actions advisories) |
| `postcss` | High | Build-time dependency (Tailwind toolchain) |
| `brace-expansion`, `fast-uri` | High | Deep transitive deps |
| `sharp`, `uuid`, `exceljs` (via `uuid`), `valibot`, `hono`, `@hono/node-server`, `@prisma/dev` | Moderate | Build/dev tooling, not runtime request-handling paths for most |

**Assessment:** none of these are exploitable through this app's own
code paths as currently used (no direct `uuid`/`hono`/`valibot` usage in
application code — they're pulled in by Prisma's dev tooling and
`exceljs`). The `next-auth`/`@auth/core` critical entries are the ones
worth tracking most closely since they're in the actual request path;
`next-auth` is still in beta (`5.0.0-beta.31`) and pulling a newer beta
or the eventual stable release when one ships is the real fix — not
something to patch around manually.

**Recommendation:** re-run `npm audit` on a monthly cadence (or wire it
into CI once a test/CI pipeline exists — see `TESTING-STRATEGY.md`) and
bump `next-auth` to stable once v5 leaves beta.

## 8. Session Security

| Finding | Severity | Status |
|---|---|---|
| JWT session strategy | ✅ | Appropriate for this app's scale (no session store needed); `AUTH_SECRET` signs/encrypts the token |
| Session cookie flags | ✅ | NextAuth v5 defaults (`httpOnly`, `secure` in production, `sameSite: lax`) — not overridden anywhere in this codebase |

---

## 9. Summary

No critical, actively-exploitable vulnerabilities in application code.
Two real gaps were found in this pass (fail-open cron auth, missing
security headers) — both documented above with a recommended fix; this
pass is documentation only, so neither has been applied to the codebase
yet. The remaining 🟡 items are accepted tradeoffs appropriate to the
app's current single-tenant, small-team scale — revisit them if that
scale changes materially (see `PRD.md` §7 for the reasoning behind
each).
