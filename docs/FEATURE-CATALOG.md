# Feature Catalog & Modular Architecture

Companion to `PRD.md`. This document is the ground truth for **what
exists today**, generated from the actual code (`src/lib/permissions.ts`,
`src/components/shell/nav-items.ts`, and each module's route/actions
files) rather than the original brief.

---

## 1. Modular Architecture

The app is a single Next.js (App Router) project. Each business module
follows the same shape:

```
src/app/(app)/<module>/
  page.tsx        — server component: auth check, data fetch, render
  actions.ts       — "use server" mutations, each starting with a
                      permission check (requireEdit/requireView-style guard)
  [id]/page.tsx    — detail/edit routes where applicable

src/components/<module>/
  *.tsx            — client components (forms, modals, panels)

src/lib/<module>.ts
  — data-access layer: every query/mutation goes through here, and every
    read is scoped by getPermission(session.user.role, module).scope
    via a *ScopeWhere(session) helper (contactScopeWhere,
    prospectScopeWhere, etc.) — this is the enforcement point for RBAC's
    "own/team/all" distinction (see §3).
```

Cross-cutting modules (used by every business module, not modules
themselves):

| Module | Purpose |
|---|---|
| `src/auth.ts` | NextAuth v5 Credentials provider, lockout, MFA gate |
| `src/lib/permissions.ts` | RBAC matrix, single source of truth (§3) |
| `src/lib/require-permission.ts` | `requireView(module)` — page-level guard, redirects if unauthorized |
| `src/lib/activity-log.ts` | Append-only audit trail, written by every mutation |
| `src/lib/mfa.ts` | TOTP generation/verification (offline, no external service) |
| `src/lib/cnpj-lookup.ts`, `src/lib/cep-lookup.ts` | Free public Brazilian data APIs (BrasilAPI, ViaCEP) |
| `src/lib/ai.ts` | Claude-backed features with deterministic heuristic fallback |

**Why this shape:** every server action is independently a permission
boundary (no shared "trust the caller already checked" assumption), and
every module's data-access lives in exactly one file, so "who can touch
this table" is answerable by reading one `lib/*.ts` file, not by tracing
every UI entry point into it.

---

## 2. Module Catalog

### 2.1 Início (`/`) — home / analytics
- KPI tiles (revenue, deals won, avg. ticket, conversion), with delta vs.
  prior period.
- Revenue-over-time chart with commission-tier annotations.
- Funnel widget, goal-progress bar (2 independent goals + progressive
  commission).
- Daily tasks, overdue tasks, overdue-seller alerts (Mediador-only radar).
- In-progress deals list.
- **Prospecções board** (§2.4) — embedded here, not a separate nav item.
- Month picker and custom date-range picker for historical views.

### 2.2 Clientes (`/vendas`) — contacts/clients
- Full contact record: identification, contact info, address (with CNPJ
  lookup auto-fill), fiscal fields (IE, e-mail financeiro/NF-e), CRM
  status, commercial potential, notes.
- Filter: by Perfil (client type) only — deliberately simplified per
  product decision (all other filters removed; the list always shows
  every client regardless of registration date).
- CSV/XLSX import (header-tolerant) and round-trip-safe export.
- ABC classification (Pareto split by purchased value).
- AI-assisted client analysis (writes a note grounded in the client's
  real history; heuristic fallback when AI is unavailable).

### 2.3 Negócios (`/negocios`) — deal pipeline
- Kanban board, configurable columns (add/rename/reorder/delete).
- "A caminho" automation: 3-business-day countdown, auto-advance,
  cancels if moved manually first (§3.4 in `CRM-SPEC.md`, unchanged).
- Deal detail modal: notes (with attachments, flaggable), payment/
  installment tracking, quick-call logging, call/email buttons.
- Full category filters (Status, Potencial, Tipo de pessoa, Perfil) +
  month filter — the fuller filter set intentionally kept here even
  after it was stripped down on Clientes.

### 2.4 Prospecções (embedded in Início)
- Spreadsheet-style board: fixed stages (Prospecção → Conversação →
  Retorno → Cotação → Negociação → Cliente Ativo), sequential unlock.
- Stages carry a **category** (Captação / Acompanhamento / Cliente),
  shown as a grouped header row.
- Filter: "Falta: [etapa]" — shows only prospects still missing a chosen
  stage.
- Marking a stage done can optionally schedule a follow-up task
  ("Agendar retorno") in the same action.
- **Negociação** stage's cell hosts the "Cliente completo" flow: every
  field needed to create a real client (Sintegra fiscal data + the full
  `Contact` field set — identification, contact, origin/relationship,
  address incl. coordinates, notes), with CNPJ and CEP auto-lookup.
  Submitting it sends straight to the approval queue.
- **Cliente Ativo** stage: locked until Negociação is done (grandfathered
  for pre-existing requests); shows pending/approved/rejected status;
  "Tornar cliente ativo" remains available as a manual fallback path.
- Approval queue, visible to Diretor/Mediador: approve converts the
  prospect into a `Contact` + opens a `Deal`, credits the **seller** (not
  the approver) in the activity log; reject requires a reason, shown to
  the seller as an in-app notice next time they open the board.
- Custom columns: any editor can append supplementary tracking columns
  beyond the 6 fixed ones (always unlocked, freely renamable/deletable).

### 2.5 Agenda (`/agenda`)
- Tasks (manual + auto-generated from Prospecções/Negócios), overdue
  tracking, month filter.

### 2.6 Comunicados (`/social`)
- Company feed: text/image posts, likes, comments, editable/deletable by
  author (Mediador can moderate anyone's).
- Images "adapted" (object-fit, not cropped).
- Mediador can flag a post "importante" (surfaces on Início sidebar).
- Unread-post nav badge, sidebar widget for important posts.

### 2.7 IA (`/ia`)
- Every capability degrades gracefully: tries Claude when configured,
  falls back to a deterministic heuristic on any failure, and the UI
  always discloses `source: "ai" | "heuristic"` — never silently claims
  a heuristic answer is AI-generated.

### 2.8 Perfil (`/perfil`, Mediador-only)
- Vendor CRUD: name, role, e-mail, password, goals (2 independent
  targets + per-goal commission %, optional progressive step past Goal
  2), birthday.
- Account unlock (post-lockout) and MFA reset (post lost-device),
  per vendor.

### 2.9 Meu perfil (`/meu-perfil`)
- Self-service: name, avatar, birthday, personal goal (private, doesn't
  affect official commission target), password change, MFA enrollment
  (QR + confirm code) / disable.
- Appearance settings (theme).

### 2.10 Config (`/config`)
- Read-only permission matrix reference (mirrors §3 below).
- Activity log feed, filterable by actor ("Quem") and action type,
  scope-respecting (a `SELLER` only ever sees their own entries).
- "Exportar tudo" — full XLSX export (Mediador/config-view only).

---

## 3. RBAC — Current Permission Matrix

Source of truth: `src/lib/permissions.ts`. `level`: `none | view | edit`.
`scope`: `none | own | team | all` (which records that level applies to).

| Module | Vendedor (SELLER) | Suporte (SUPPORT) | Diretor (MANAGER) | Admin | Mediador |
|---|---|---|---|---|---|
| Início (analitica) | edit · own | view · own | edit · team | edit · all | edit · all |
| Clientes (vendas) | edit · own | edit · own | edit · team | edit · all | edit · all |
| Negócios | edit · own | view · own | edit · team | edit · all | edit · all |
| Prospecções | edit · own | view · own | edit · team | edit · all | edit · all |
| Agenda | edit · own | view · own | view · team | edit · all | edit · all |
| Comunicados (social) | edit · all | edit · all | edit · all | edit · all | edit · all |
| IA | view · own | none | view · team | view · all | view · all |
| Perfil | none | none | none | none | edit · all |
| Config | none | none | view · team | edit · all | edit · all |
| Activity Logs | view · own | none | view · team | view · all | view · all |

**Cross-cutting rule, not in the table:** `canApproveClients(role)` —
who can approve/reject a "tornar cliente ativo" request — is `true` for
`MEDIATOR` and `MANAGER` (Diretor) only, independent of the Prospecções
row above (which governs editing the board itself, not the approval
decision).

**Enforcement points** (both, not either/or):
1. **Server actions** — every mutation calls a `requireEdit()`/
   `requireView()`-equivalent guard before touching the database.
2. **Data-access layer** — every list/read query applies
   `*ScopeWhere(session)`, so even a caller that bypassed the UI can't
   pull another user's "own"-scoped rows.

The Mediador role is intentionally never scope-limited — every module row
for `MEDIATOR` is `edit · all` (or `view · all` where the module has no
edit concept), by design, not by omission.
