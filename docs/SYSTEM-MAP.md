# System Map

Companion to `PRD.md` / `FEATURE-CATALOG.md`. Diagrams are Mermaid —
GitHub renders them natively in this file.

---

## 1. Architecture (deployment + request flow)

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI["Next.js App Router UI\n(React Server + Client Components)"]
    end

    subgraph Vercel["Vercel (hosting)"]
        NextApp["Next.js app\nApp Router · Server Actions · Route Handlers"]
        Auth["NextAuth v5\nCredentials + JWT session"]
        Cron["Vercel Cron\n/api/cron/advance-deals\n/api/cron/full-export"]
    end

    subgraph External["External services (all optional-degrade)"]
        Claude["Anthropic Claude API\n(IA module)"]
        BrasilAPI["BrasilAPI\n(CNPJ lookup)"]
        ViaCEP["ViaCEP\n(CEP/address lookup)"]
    end

    subgraph Data["Neon (managed Postgres)"]
        PG[("PostgreSQL\nvia @prisma/adapter-pg")]
    end

    UI <--> NextApp
    NextApp --> Auth
    NextApp -->|Prisma Client| PG
    NextApp -.->|graceful fallback to\nheuristic on failure| Claude
    NextApp -.-> BrasilAPI
    NextApp -.-> ViaCEP
    Cron -->|Bearer CRON_SECRET| NextApp

    style External fill:#00000000,stroke-dasharray: 5 5
```

**Key properties:**
- Single Next.js project, no separate backend service — Server Actions
  *are* the API layer (no separate REST/GraphQL surface for the app's own
  UI).
- Every external call (Claude, BrasilAPI, ViaCEP) is best-effort: a
  failure degrades to a heuristic or an inline error message, never a
  crashed page.
- `prisma.config.ts` + `"build": "prisma migrate deploy && next build"`
  means every deploy applies pending migrations automatically — the
  database schema and the deployed code are never out of sync.

---

## 2. Data Model (ER diagram)

```mermaid
erDiagram
    User ||--o{ Contact : owns
    User ||--o{ Deal : owns
    User ||--o{ Prospect : owns
    User ||--o{ Task : owns
    User ||--o{ ActivityLog : "acts as"
    User ||--o{ Post : authors
    User ||--o{ PostLike : likes
    User ||--o{ PostComment : authors
    User ||--o{ ClientActivationRequest : reviews

    Contact ||--o{ Deal : "has"
    Contact ||--o{ ActivityLog : "logged for"

    Pipeline ||--o{ PipelineStage : contains
    PipelineStage ||--o{ Deal : "current stage"
    PipelineStage ||--o| PipelineStage : "auto-advance-to"

    Deal ||--o{ DealNote : has
    Deal ||--o{ DealInstallment : has
    Deal ||--o{ Task : "scheduled messages"
    Deal ||--o{ ActivityLog : "logged for"

    ProspectStage ||--o{ Prospect : "current stage"
    ProspectStage ||--o{ ProspectStageValue : "cell values"
    Prospect ||--o{ ProspectStageValue : "one per stage"
    Prospect ||--o| ClientActivationRequest : "activation request"
    Prospect ||--o{ Task : "scheduled follow-ups"
    Prospect }o--o| Contact : "converts into"

    Post ||--o{ PostLike : has
    Post ||--o{ PostComment : has

    User {
        string id PK
        string email UK
        string passwordHash
        Role role
        boolean mfaEnabled
        string mfaSecret
        int failedLoginAttempts
        datetime lockedAt
        decimal goal1
        decimal goal2
        decimal commissionPct1
        decimal commissionPct2
    }
    Contact {
        string id PK
        string ownerId FK
        string firstName
        string lastName
        string cnpj
        string profile
        CrmStatus crmStatus
        CommercialPotential commercialPotential
    }
    Deal {
        string id PK
        string ownerId FK
        string contactId FK
        string stageId FK
        decimal value
        PaymentStatus paymentStatus
    }
    Prospect {
        string id PK
        string ownerId FK
        string currentStageId FK
        string convertedContactId
        datetime convertedAt
    }
    ClientActivationRequest {
        string id PK
        string prospectId FK "unique"
        ActivationStatus status
        string reviewerId FK
        string razaoSocial
        string cnpj
        decimal valor
    }
    ActivityLog {
        string id PK
        string actorId FK
        string entityType
        string entityId
        string action
        json diff
    }
```

**Notable design choices, made deliberately:**
- `Prospect` and `Contact` are **separate entities**, not one table with a
  status flag — a prospect only ever *becomes* a `Contact` on approval
  (`Prospect.convertedContactId`), so the funnel's in-progress data
  (stage values, temperature, notes) never pollutes the client record,
  and a rejected/abandoned prospect leaves no client trace.
- `ClientActivationRequest` is 1:1 with `Prospect` (unique `prospectId`)
  and carries its own copy of the eventual `Contact` fields — it's the
  audit record of *what was submitted for approval*, independent of
  what the resulting `Contact` looks like after later edits.
- `profile` (client type: Indústria, Fábrica, …) is a free-text string,
  not an enum, on purpose — new categories don't require a schema
  migration; filter dropdowns are built from `DISTINCT` queries against
  real data.

---

## 3. Core Flow — Prospecção → Cliente Ativo (sequence)

```mermaid
sequenceDiagram
    actor Vendedor
    participant Board as Prospecções Board
    participant Server as Server Actions
    participant DB as Postgres
    actor Diretor

    Vendedor->>Board: Cria prospecção
    Board->>Server: createProspectAction
    Server->>DB: INSERT Prospect (stage = Prospecção)

    loop Prospecção → Conversação → Retorno → Cotação
        Vendedor->>Board: Marca etapa concluída
        Board->>Server: saveStageValueAction
        Server->>DB: UPSERT ProspectStageValue (done=true)
        Note over Server,DB: Etapa seguinte só destrava<br/>se a anterior está done
    end

    Vendedor->>Board: Completa Negociação +<br/>"Cliente completo" (opcional)
    Board->>Server: saveStageValueAction + submitActivationAction
    Server->>DB: UPSERT ClientActivationRequest (PENDENTE)
    Server->>DB: UPDATE Prospect.currentStageId = Cliente Ativo
    Note over DB: Cliente Ativo agora destravado

    Diretor->>Board: Abre "Aprovações pendentes"
    Board->>Server: approveActivationAction
    Server->>DB: SELECT ClientActivationRequest + Prospect
    Server->>DB: INSERT Contact (owner = vendedor, não o Diretor)
    Server->>DB: INSERT Deal (pipeline padrão)
    Server->>DB: UPDATE ClientActivationRequest.status = APROVADO
    Server->>DB: INSERT ActivityLog (actor = vendedor)

    Vendedor->>Board: Reabre a página
    Board->>Server: listUnseenActivationDecisions
    Server-->>Vendedor: Banner "foi aceito como cliente ativo"
    Board->>Server: markActivationDecisionsSeenAction
```

---

## 4. RBAC Enforcement (class/module view)

```mermaid
classDiagram
    class permissions_ts {
        +Module: analitica | vendas | negocios | prospeccoes | agenda | social | ia | perfil | config | activityLogs
        +Level: none | view | edit
        +Scope: none | own | team | all
        +getPermission(role, module) Permission
        +canView(role, module) bool
        +canEdit(role, module) bool
        +canApproveClients(role) bool
    }
    class ServerAction {
        <<every mutation>>
        +requireEdit() Session
    }
    class PageComponent {
        <<every route>>
        +requireView(module) Session
    }
    class DataAccessLayer {
        <<lib per module>>
        +scopeWhere(session) WhereClause
    }
    class Prisma
    class Postgres

    ServerAction --> permissions_ts : checks before mutating
    PageComponent --> permissions_ts : checks before rendering
    DataAccessLayer --> permissions_ts : builds WHERE from scope
    DataAccessLayer --> Prisma
    Prisma --> Postgres
```

Two independent enforcement layers (page guard + data-access scope) mean
a permission bug in one doesn't silently expose data — the query itself
is still scoped even if a page-level check were ever missed.
