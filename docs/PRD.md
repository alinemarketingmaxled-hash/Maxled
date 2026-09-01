# Maxled CRM — Product Requirements Document (PRD)

**Status:** Living document, reflects the product as actually built and deployed (not the original aspirational brief — see `CRM-SPEC.md` for that). Last synced: 2026-08.

---

## 1. Purpose & Context

Maxled CRM is a single-tenant, internal sales CRM built for **Maxled** (a
lighting/electrical distributor). It is not a multi-customer SaaS product —
it has one operator (the Mediador/owner) and a small sales team, and is
deployed as a single Vercel project against a single Neon Postgres
database. There is no concept of "another company's data" anywhere in the
system; every permission and scope described in this document operates
**within** that one organization.

### Problem statement

Before Maxled CRM, prospecting, client records, deal tracking, and
approval of new clients as active accounts lived across spreadsheets and
ad hoc WhatsApp/email threads, with no single source of truth, no
approval gate before a prospect became a billable client, and no
visibility for the owner into what each seller was doing day to day.

### Goals

- One system of record for prospects, clients, and deals.
- A controlled, auditable path from "lead" to "active client" that
  requires sign-off from someone other than the seller who sourced it.
- Role-appropriate visibility: sellers see their own pipeline; the
  Mediador (owner) and Diretor (manager-equivalent role) see and approve
  across the team.
- Low operating overhead: no dedicated ops/security team — every
  automation, permission, and safeguard has to hold up with the Mediador
  as the only administrator.

### Non-goals

- Multi-tenant SaaS (serving other companies) — explicitly out of scope.
  See §7.2.
- Enterprise-scale traffic/compliance requirements (SOC 2, multi-region,
  etc.) — the system is sized for a handful of concurrent users.

---

## 2. Users & Roles

| Role | Who | What they do in the system |
|---|---|---|
| **Mediador** | The business owner (Aline) | Full access to every module, always. Manages vendor accounts, approves/rejects clients, sees all data. |
| **Diretor** (`MANAGER` in code/DB) | A manager-level teammate | Team-wide view of most modules; can approve/reject "tornar cliente ativo" requests alongside the Mediador. |
| **Vendedor** (`SELLER`) | Sales reps | Own-scoped access: their own contacts, deals, prospecções, agenda. |
| **Suporte** (`SUPPORT`) | Support staff | Mostly view-only, own-scoped; edit access on Clientes. |
| **Admin** | Reserved role | Cross-team edit access, defined in the permission matrix but not actively assigned to anyone today. |

Full permission matrix: §6 of `CRM-SPEC.md` is the original design; the
**current, authoritative** matrix is `src/lib/permissions.ts` — see
`FEATURE-CATALOG.md` §RBAC for a plain-language summary kept in sync with
that file.

---

## 3. Product Surface (what actually ships today)

Live modules, in nav order:

1. **Início** (home) — KPIs, revenue chart, funnel, goal meter, daily/
   overdue tasks, in-progress deals, and the **Prospecções** board
   (embedded as the page's primary content, not a separate nav item).
2. **Clientes** (`/vendas`) — full contact/client record management,
   import/export, ABC classification, AI-assisted client analysis.
3. **Negócios** (`/negocios`) — Kanban pipeline, "A caminho" 3-business-day
   automation, payments/installments, deal notes with attachments.
4. **Agenda** (`/agenda`) — tasks, overdue tracking, month filter.
5. **Comunicados** (`/social`) — internal announcement/social feed with
   likes, comments, unread badge.
6. **IA** (`/ia`) — Claude-powered writing assist, forecasting, client
   analysis; every AI feature degrades to a deterministic heuristic when
   the API key isn't configured or a call fails, and always discloses
   which one produced the answer.
7. **Perfil** (`/perfil`, Mediador-only) — vendor account management,
   goals/commission configuration, MFA reset for locked-out users.
8. **Meu perfil** — self-service profile, password, MFA enrollment.
9. **Config** (`/config`) — permission matrix reference, activity log
   with filters (Mediador/Diretor/Manager-scoped).

### 3.1 Prospecções → Cliente Ativo pipeline (core workflow)

This is the product's central business process:

1. A seller creates a **Prospecção** (lead) with basic contact info.
2. It moves through fixed stages: **Prospecção → Conversação → Retorno →
   Cotação → Negociação → Cliente Ativo**, each stage gated behind the
   previous one being marked done (sequential unlock).
3. Completing **Negociação** offers an inline "Cliente completo" form —
   every field needed to create a real client record (Sintegra-style
   fiscal data, contact details, address, CNPJ/CEP auto-lookup) — and
   optionally submits it straight to the approval queue.
4. **Cliente Ativo** stays locked until Negociação is done (with a
   grandfather exception for requests submitted before this rule
   existed).
5. A **Diretor or Mediador** approves or rejects. Approval converts the
   Prospecção into a real `Contact` + opens a `Deal` in the default
   pipeline, crediting the **seller** (not the approver) as the record's
   author in the activity log.
6. The seller sees an in-app notice the next time they open the board,
   telling them whether it was accepted or rejected (with reason).

### 3.2 Authentication & account security

- Email + password (bcrypt), NextAuth v5, JWT sessions.
- Account lockout after 7 failed attempts; only the Mediador can unlock.
- Optional TOTP-based MFA (authenticator app), enrolled per-user in "Meu
  perfil"; Mediador can force-disable a user's MFA if they lose their
  device.
- No self-service "forgot password" flow (no email-sending
  infrastructure exists yet — see §7.3) — a forgotten password today
  requires a manual data migration by whoever maintains the codebase.

---

## 4. Non-Functional Requirements

| Area | Requirement | Current status |
|---|---|---|
| Availability | Best-effort; no formal SLA (small internal tool) | Vercel-hosted, effectively always-on |
| Data durability | Point-in-time recoverable | Neon automatic backups (provider-level, not app-built) |
| Transport security | All traffic over TLS | Enforced by Vercel automatically |
| Access control | Every module gated by role + scope | `lib/permissions.ts`, enforced server-side on every action |
| Auditability | Every create/edit/delete traceable to a user | `ActivityLog` table, visible in Config with filters |
| Secrets | Never committed to the repo | Confirmed — `.env` is gitignored, only `.env.example` (placeholders) is tracked |
| PII | Contact/client personal data | Stored in Postgres, not separately field-encrypted (see Security Audit §4) |

---

## 5. Explicitly Out of Scope / Not Built

Carried over from `CRM-SPEC.md`'s roadmap, still not built as of this
document: remaining Analítica widgets (Coorte, Zona, Quadrante, Anomalia,
Comparador, GIF/Explee embed), gamification (ranking/badges), real
WhatsApp Business API integration, Explee integration, mobile app,
offline mode, voice assistant, chatbot, field-level PII encryption,
churn/LTV scoring, quote/proposal generator, freight/logistics status,
ERP hook, formal LGPD tooling (consent tracking, right-to-be-forgotten
export).

**Multi-tenancy and Row-Level Security are not planned** — see §7 for
why, and what exists instead.

---

## 6. Success Metrics

Informal (no analytics platform wired up today):

- Every prospect that becomes a client goes through the approval gate —
  zero clients created outside the Prospecções → Cliente Ativo flow.
- Time from "Negociação concluída" to a Diretor/Mediador decision.
- Account lockouts and MFA resets stay rare (a proxy for whether the
  login/security flow is causing friction vs. protecting the account).

---

## 7. Architecture & Security Decisions (with rationale)

This section exists because several requested "enterprise" capabilities
were evaluated and deliberately not built — documenting why avoids
relitigating the same question later.

### 7.1 RBAC — implemented, application-layer

Role-based access control is fully implemented: every module has a
per-role `{level, scope}` entry (`none|view|edit` × `none|own|team|all`),
enforced in every server action and page via `requireView`/`canEdit`. See
`FEATURE-CATALOG.md` for the current matrix.

### 7.2 Multi-tenancy — not applicable

Maxled CRM serves one organization. There is no tenant identifier
anywhere in the schema, no plan to sell this to other companies as-is,
and retrofitting tenant isolation (a `tenantId` on every table, scoped
queries everywhere, tenant-aware auth) would be a multi-week rewrite with
no user requesting it. If that ever changes, it's a new project phase,
not an incremental PR.

### 7.3 Row-Level Security (RLS) — evaluated, not adopted

Postgres RLS enforces row visibility **inside the database**, independent
of the application. Today, every scoped query in this codebase already
goes through a `*ScopeWhere(session)` helper (`contactScopeWhere`,
`prospectScopeWhere`, etc.) that's applied consistently — the same
enforcement RLS would add, just at the application layer instead of the
database layer.

Adding real RLS on top would mean: Postgres roles per app role, session
variables set per request (Prisma has no first-class RLS support — this
means raw SQL `SET LOCAL` calls wrapping every query, or a second
connection pool), and duplicate policy logic to keep in sync with
`permissions.ts`. For a single-tenant app with no untrusted direct DB
access path (the only way to the database is through this app's own
Prisma client), that's meaningfully more operational complexity for a
threat model (a bug in the app-layer scope check) already covered by:
consistent use of the scope helpers, and the security audit's review of
every query that touches user-controlled data.

**Recommendation:** revisit only if the app ever accepts direct
untrusted SQL access (e.g. a customer-facing reporting/BI tool querying
the same database) — not needed for the current single-app access
pattern.

### 7.4 WAF / Bot Fight Mode / Rate Limiting — requires an infrastructure decision

"Bot Fight Mode" is a **Cloudflare-branded product**. Maxled runs on
Vercel, not behind Cloudflare, so that specific feature doesn't apply
as named. The equivalent capability requires one of:

- **Put Cloudflare in front of Vercel** (DNS change: point the domain's
  proxy through Cloudflare, keep Vercel as the origin) — gets WAF, Bot
  Fight Mode, and rate limiting rules from Cloudflare's free tier.
- **Use Vercel's own Firewall/Rate Limiting** — native, no DNS change,
  but the more capable tiers are paid add-ons.

Neither was implemented in this pass because both require an account-level
decision (which provider, which plan) that isn't a code change. Login
already has a basic rate-limit-equivalent (7-attempt lockout); there is
no rate limiting on other endpoints yet.

### 7.5 TLS/HSTS

TLS termination is handled automatically by Vercel for every deployment
— nothing to configure. `Strict-Transport-Security` (HSTS) and a small
set of standard security headers are **not currently sent** by the app;
Security Audit §6 documents the exact recommended policy
(`next.config.ts` `headers()`) as a pending fix, not yet applied — this
pass is documentation only.

---

## 8. Related Documents

- `CRM-SPEC.md` — original design brief and full aspirational roadmap.
- `FEATURE-CATALOG.md` — current module-by-module feature list + RBAC
  matrix + modular architecture.
- `SYSTEM-MAP.md` — architecture, data model (ER), and key-flow diagrams.
- `SECURITY-AUDIT.md` — code-level security review, findings, and fixes.
- `SECURITY.md` — cloud-security-practices checklist mapped to this app
  (IAM, data protection, governance, monitoring).
