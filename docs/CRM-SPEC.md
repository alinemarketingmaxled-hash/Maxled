# Maxled CRM — Design & Product Specification

A gold-and-black CRM built for a lighting/electrical distributor's sales
operation: physical-goods deals, a distributed seller team on commission,
and a WhatsApp-first sales motion. This document specifies the brand
system, every module in the brief, the data model behind them, the
automation rules, the permission model, and a set of additional
recommendations grounded in that business context.

A companion visual mockup implementing this system is at
`design/dashboard-mockup.html`.

---

## 1. Brand & Design System

Max LED's own site was unreachable from this environment (network policy
blocked the fetch), so the palette below is a from-scratch gold-on-black
system built to the brief ("elegant, premium, strong contrast") rather
than sampled from the live site. Swap the hex values in one place — the
CSS custom properties block at the top of the mockup — if you have exact
brand hex values from a style guide.

### 1.1 Color

The ground is warm black, not pure `#000000` — a true black photographs
flat next to metallic gold, a warm-biased near-black lets gold read as
*lit* rather than printed.

| Token | Hex | Role |
|---|---|---|
| `--black-ground` | `#0C0A06` | App background |
| `--black-surface` | `#16130C` | Cards, panels, sidebar |
| `--black-surface-2` | `#1F1A10` | Inputs, hover states, elevated widgets |
| `--gold` | `#C9A227` | Primary actions, active nav, icons, borders |
| `--gold-bright` | `#F0C863` | Hover/focus glow, chart emphasis, highlights |
| `--gold-deep` | `#8A6A1F` | Dividers, muted borders, disabled gold |
| `--ink` | `#F5EFE0` | Primary text on black |
| `--ink-muted` | `#A69C87` | Secondary text, labels |
| `--ink-faint` | `#6E6552` | Placeholder text, gridlines |

**Status colors are reserved and never reused as brand accents** (a
warning must never look like "more gold"):

| Token | Hex | Meaning |
|---|---|---|
| `--status-good` | `#4CC97A` | Goal met, deal won, on-track |
| `--status-info` | `#3987E5` | Neutral/informational |
| `--status-warning` | `#E07B3C` | At risk, approaching SLA |
| `--status-critical` | `#D93A3A` | Overdue, churn risk, anomaly |

**Chart categorical order** (fixed, never cycled — validated for
colorblind-safe adjacent separation with `dataviz/scripts/validate_palette.js`,
dark mode, worst adjacent ΔE 9.7): gold `#C98500` → blue `#3987E5` →
rose `#D55181` → green `#008300` → red `#E66767` → teal `#199E70`.
Because this set sits in the CVD floor band (8–12, not the 12+ target),
every chart that uses more than two series **must** ship direct labels or
a legend — never color alone. A 7th+ series folds into "Outros."

**Sequential ramp** (magnitude — heatmaps, gauges, cohort retention): a
single gold hue, dark→bright as value increases, anchored to the dark
surface: `#241C0D → #4A3A15 → #7D631E → #B8922A → #F0C863`.

Both light and dark CSS variants exist in the mockup for text/surface
tokens, but the CRM shell is a **deliberate single dark world** — the
brief specifies "black background for dashboards and menus," so unlike a
typical artifact this is not swapped for a light theme. If a light,
high-glare "showroom kiosk" mode is ever needed, treat it as a distinct
skin, not a `prefers-color-scheme` flip.

### 1.2 Typography

Two roles, deliberately different registers:

- **Display** (wordmark, page titles, section headers): a serif —
  `ui-serif, Georgia, 'Iowan Old Style', 'Times New Roman', serif` — set
  with slightly open tracking. Serif-on-black-and-gold is the vernacular
  of premium retail signage (jewelers, watchmakers); it separates
  "brand moment" text from "tool" text without needing a custom webfont.
- **UI/body** (everything operational — tables, forms, buttons, chart
  labels): a geometric sans — `-apple-system, 'Segoe UI', Roboto,
  'Helvetica Neue', Arial, sans-serif` — because a CRM is scanned and
  operated, not read, and density/legibility beats character here.
- **Eyebrows/labels** (KPI captions, section kickers): UI sans,
  11px/uppercase/0.08em tracking, `--ink-muted`.
- Numerals in KPIs, tables, and currency use `font-variant-numeric:
  tabular-nums` everywhere digits stack in a column.

Type scale: 32/20/16/14/12px, weights 400/600/700 only — no in-between
weights, which keeps the hierarchy readable at a glance in a dense grid.

### 1.3 Components (shared vocabulary)

- **Card**: `--black-surface`, 1px `--gold-deep` border at 25% opacity,
  12px radius, drag-handle (⋮⋮) top-left when placed on a canvas.
- **Primary button**: gold fill, black text, `--gold-bright` on hover/glow.
- **Secondary button**: transparent, `--gold-deep` border, `--ink` text.
- **Status pill**: icon + label, never color alone (colorblind + literal
  meaning for anyone scanning quickly).
- **KPI tile**: eyebrow label, big tabular number, delta chip (status
  color), sparkline.
- **Nav rail item**: icon + label; active state = gold left-rail (3px) +
  `--gold` icon/text on `--black-surface-2`.

---

## 2. Information Architecture

Top-level nav (left rail, persistent):

```
Analítica · Vendas · Negócios · Agenda · Rede Social · IA · Perfil* · Config
                                                              *mediator-only
```

Each seller sees their own data by default (see §6 Permissions); the
**mediator** role is the only one with a cross-profile switcher in the
top bar ("Visualizando: Todos ▾ / [Seller name] ▾").

---

## 3. Module Specifications

### 3.1 Aba Analítica (Analytics)

Drag-and-drop canvas (CSS grid, 12-column, free placement with resize
handles). A palette strip along the top holds the eleven component
types as draggable chips; dropping one onto the canvas opens a
config drawer (data source, dimensions, filters, refresh interval).

Every widget's header carries a **"Edições suportadas"** (supported
edits) info affordance — a small ⓘ that opens a static list of exactly
which properties that widget type allows editing, so a seller can't
discover mid-drag that a field isn't actually configurable. Supported
edits per component:

| Component | Purpose | Supported edits |
|---|---|---|
| **GIF** | Looping visual (celebration, product demo, announcement) | source asset, autoplay, loop, caption |
| **KPI** | Single metric + trend | metric, period, comparison period, goal line, icon |
| **Gráfico** (Graph) | Line/area/bar over time | metric(s), chart type, date range, granularity, annotations |
| **Comparador** (Comparator) | Side-by-side metric across entities (sellers, periods, regions) | metrics, entity set, sort order, baseline |
| **Coorte** (Cohort) | Retention/behavior heatmap by acquisition period | cohort unit (week/month), metric, lookback window, color ramp |
| **Zona** (Zone) | Geographic/territory breakdown | region level (state/city), metric, map vs. table view |
| **Funil** (Funnel) | Stage-to-stage conversion | stage set, metric (count/value), conversion vs. drop-off labels |
| **Medidor de meta** (Goal meter) | Progress toward a target | target value, current value source, warning/critical thresholds |
| **Detector de anomalia** (Anomaly detector) | Flags statistical outliers on a metric | metric, sensitivity, lookback baseline, alert channel |
| **Quadrante** (Quadrant) | 2×2 scatter (e.g. value vs. engagement) | x-axis metric, y-axis metric, quadrant labels, entity grouping/color |
| **Estágio** (Stage) | Pipeline stage tracker/stepper for a single deal or cohort | stage set, linked pipeline, label visibility |
| **Comissão (2 metas)** | Per-seller commission progress against Goal 1 and Goal 2 | seller/profile, Goal 1 value, Goal 2 value, commission % per goal, payout preview |

Integrations:
- **WhatsApp Business API**: outbound template messages triggered from
  widgets/automations (post-sale, follow-up, birthday) and inbound
  message ingestion for sentiment analysis and response-time metrics.
- **Explee**: embeddable explainer/interactive-video widget type,
  addressable the same way as a GIF component, for onboarding or
  product-demo content inside a dashboard.

### 3.2 Aba Vendas (Sales / Contacts)

Full contact record. Fields, grouped for the form UI:

**Identificação**: Contact Owner, First Name, Last Name, Account Name,
Title, Department

**Contato**: Email, Phone (fixed), Mobile, Residential Phone,
Assistant's Phone

**Origem**: Lead Source, Supplier Name

**Endereço**: Street, Number, City, State, Postal Code (CEP),
Coordinates (lat/long — auto-filled from CEP lookup, editable)

Every record row and detail panel carries **quick-access icons** —
email (`mailto:`) and WhatsApp (`wa.me` deep link, pre-filled with the
contact's mobile) — so first contact is one click.

- **Export**: CSV/XLSX export of the full field set above, header names
  matching the import template 1:1, so an export is always a valid
  re-import (round-trip safe — critical for bulk edits done outside the
  tool, e.g. correcting addresses).
- **Business history**: every deal, note, attachment, and message tied
  to the contact renders as a single reverse-chronological timeline on
  the contact's detail panel — the "Histórico do cliente" referenced in
  §3.3 lives here, not as a separate record.
- Every field is individually editable inline; deletions are soft
  (see §8 — "everything saved with edit/delete") with a recovery window.

### 3.3 Aba Negócios (Deals — Kanban)

Kanban board, one card per deal, linked to a contact.

- **Columns are user-configurable**: add, rename, reorder (drag), delete
  (with a forced re-assignment prompt for any cards in a deleted
  column — never silently orphan a deal).
- **Card fields**: Owner, Business Name, Value (R$), attachment/notes
  field for prints, screenshots, or free-text context — this *is* the
  "Histórico do cliente" field named in the brief, surfaced both on the
  card and rolled up into the contact's timeline (§3.2).
- Card click opens the full deal detail: linked contact, activity log,
  attachments, and the Estágio (stage) widget from §3.1 rendered inline.

### 3.4 Agenda — "A caminho" automation

A concrete state machine, triggered the moment a card is dragged into
the **"A caminho"** (on the way) column:

1. **Set deadline** = now + 3 **business** days (Saturdays, Sundays, and
   configured holidays excluded from the count).
2. **Send post-sale message** immediately via WhatsApp (falls back to
   email if no WhatsApp number on file), using the configured post-sale
   template.
3. A countdown chip renders on the card ("2 dias úteis restantes").
4. On deadline day, a background job **auto-advances** the card to the
   next configured pipeline stage, logs the transition in the activity
   log (§8), and notifies the deal owner.
5. If the card is moved manually before the deadline, the countdown and
   scheduled auto-advance are cancelled — manual action always wins over
   automation.

### 3.5 Rede Social Interna (Internal Social Feed)

- Company-wide feed, chronological, no algorithmic ranking (a 20-person
  sales org doesn't need one, and ranking would fight the transparency
  gamification depends on in §7).
- Anyone can post (text + image), like, and comment.
- System auto-posts for milestones (deal won, goal hit, badge unlocked —
  see §7) are visually distinguished (gold-bordered card) from manual
  posts, and are themselves like/comment-able.

### 3.6 Inteligência Artificial

Seven capabilities, each specified by trigger → input → output surface:

| Capability | Trigger | Input | Output surface |
|---|---|---|---|
| Writing assist | User drafting a note/email/message | Free text + contact context | Inline suggestion/autocomplete |
| Tips & strategic suggestions | Contextual (viewing a deal/contact) | Deal stage, history, similar-deal outcomes | Side panel card |
| Sales forecasting | Scheduled (daily) + on-demand | Historical close rates, pipeline value, seasonality | Analytics widget (Gráfico) |
| Opportunity alerts | Scheduled (daily) | Deal signals (engagement, stage velocity, past win patterns) | Notification + IA panel card, ranked list |
| Sentiment analysis | New inbound WhatsApp/email message | Message text | Badge on contact/thread (positive/neutral/negative), rolls into churn score §9 |
| Best contact time | On-demand, per contact | Historical response timestamps for that contact | Suggestion chip on contact detail |
| Cross-sell / upsell | On deal-won or scheduled | Product/category purchase history, catalog | Suggestion card on contact + deal |

Every AI suggestion surfaces with a lightweight confidence/rationale tag
("Baseado em 12 negócios semelhantes") — a premium tool earns trust by
showing its work, not just asserting a number.

> Sentiment analysis reads real customer messages: it must be scoped by
> the same LGPD guardrails as §9 (data minimization, purpose limitation,
> and it must never surface message content itself — only the derived
> sentiment label — to anyone but the assigned owner and mediator).

### 3.7 Aba Perfil (mediator-restricted)

Vendor registration and management, visible in full only to the
**mediator** role:

- Name, Role, Email, Password (write-only after creation; reset flow,
  never displayed in plaintext)
- Goal 1 (R$), Goal 2 (R$) — independent targets, not tiers of one goal
- Commission % for each goal independently (a seller can have different
  payout rates for Goal 1 vs. Goal 2 — this is what the "Comissão com 2
  metas" widget in §3.1 renders)
- Birthday — on the date, an automatic congratulatory message posts to
  the seller (and, if enabled, to the Rede Social feed) with no manual
  trigger needed
- **Individual dashboard**: each seller's own goals/performance view,
  scoped to only their data
- Mediator has unrestricted read/write across every profile and module —
  the único cross-cutting role in the system (§6)

---

## 4. Data Model (entity summary)

Not a full schema — the entities and relationships that the modules
above imply:

- **User** (1) —< **Deal** (owner) ; **User** (1) —< **Contact** (owner)
- **Contact** (1) —< **Deal** (many deals per contact)
- **Contact** (1) —< **Message** (WhatsApp/email, for history + sentiment)
- **Deal** (1) —< **Attachment/Note** ("Histórico do cliente")
- **Deal** belongs to one **PipelineStage** (column), which belongs to
  one **Pipeline** (Kanban board) — pipelines/columns are tenant-
  configurable per §3.3
- **User** (1) —1 **Goals** (Goal 1, Goal 2, commission %, reset monthly)
- **User** (1) —< **Post**, **Like**, **Comment** (social feed)
- **AIInsight** —> **Contact** | **Deal** (polymorphic; a suggestion,
  score, or alert attached to either)
- **ActivityLog** entry created on every create/edit/delete across all
  of the above (§8)

---

## 5. Automation & Notification Rules

| Rule | Condition | Action |
|---|---|---|
| Post-sale + auto-advance | Deal moved to "A caminho" | See §3.4 |
| Birthday message | User's `birthday` == today | Send congrats message; optional feed post |
| Follow-up reminder | Contact has no outbound/inbound activity in N days (configurable, default 3) | Reminder to owner; escalates to manager after 2× N |
| Weekly report | Scheduled, configurable day/time | Email summary of goals vs. results to each user + mediator |
| Monthly reset | 1st of month, 00:00 local | Goals/indicators snapshot to history, counters zero, prior month archived (not deleted) for trend widgets |
| Achievement recognition | Goal 1 or Goal 2 reached | Congratulatory message + badge + optional feed auto-post (§3.5, §7) |

---

## 6. Access Profiles & Permission Matrix

Roles: **Admin**, **Manager**, **Seller**, **Support**, and the
cross-cutting **Mediator** (superset of Admin, includes Perfil module).

| Module | Seller | Support | Manager | Admin | Mediator |
|---|---|---|---|---|---|
| Analítica (own data) | Edit | View | Edit | Edit | Edit |
| Analítica (team-wide) | — | — | View | Edit | Edit |
| Vendas | Edit (own) | Edit (own) | Edit (team) | Edit (all) | Edit (all) |
| Negócios | Edit (own) | View | Edit (team) | Edit (all) | Edit (all) |
| Agenda | Edit (own) | View | View (team) | Edit | Edit |
| Rede Social | Post/Like/Comment | Post/Like/Comment | Post/Like/Comment | Post/Like/Comment | Post/Like/Comment |
| IA | View (own suggestions) | — | View (team) | View (all) | View (all) |
| Perfil | — | — | — | — | Edit (all) |
| Config / Permissions | — | — | View | Edit | Edit |
| Activity Logs | View (own) | — | View (team) | View (all) | View (all) |

Permissions are defined **per module**, not just per role — Config
exposes a matrix editor so a mediator can grant, e.g., a specific
Support user edit access to Negócios without promoting them to Manager.

Each user's data is siloed by default ("not integrated" per the brief —
a Seller cannot see another Seller's pipeline); Manager/Admin/Mediator
scopes are the only ones that aggregate across users, and every
cross-user view is logged in the activity log.

---

## 7. Gamification

- **Ranking**: leaderboard by goal attainment %, not raw revenue (so a
  seller on a smaller territory can still rank #1 — raw R$ would just
  reproduce territory size).
- **Badges**: achievement-based (Goal 1 hit, Goal 2 hit, N deals won in
  a month, fastest follow-up time, longest win streak).
- **Auto-recognition**: badge unlocks and goal hits generate the
  congratulatory message + optional feed post from §5.

---

## 8. General Platform Features

- **Soft delete everywhere**: every create/edit/delete is reversible
  within a recovery window; nothing "everything saved with option to
  edit or delete" implies a hard, silent delete.
- **Activity log**: append-only, records actor, entity, field-level
  diff, timestamp; filterable by user/module/date for audits.
- **Real-time dashboard**: goals vs. results, live (websocket/poll),
  scoped per §6.
- **Weekly email reports**: per §5.
- **Client segmentation**: saved filters on the Vendas field set (state,
  lead source, supplier, deal value bands) reusable across Analítica,
  campaigns, and follow-up automation.
- **Mobile app + push notifications**: iOS/Android, push on new lead
  assignment, follow-up due, goal milestone, birthday message sent.
- **Offline mode**: local write queue on mobile (and desktop PWA) for
  field sales without signal; syncs and resolves conflicts (last-write-
  wins with a manual merge prompt on true conflicts) on reconnect.
- **Voice assistant**: quick voice-to-note capture, attached to the
  active contact/deal, transcribed and editable before save.
- **Chatbot**: first-line WhatsApp/web widget triage — captures lead
  fields, routes to a Seller by territory/round-robin, hands off with
  full context (no "please repeat your info" handoff).
- **Automatic daily backup**: versioned, restorable per-day for a
  rolling window.
- **Encryption**: PII (email, phone, address) encrypted at rest;
  field-level, not just disk-level, so a DB dump alone doesn't leak
  contact data.
- **Churn analysis**: risk score per contact from activity recency,
  sentiment trend, deal velocity.
- **LTV**: expected total value per client from historical deal value ×
  frequency, surfaced on the contact panel next to churn risk — the two
  numbers next to each other are what actually drives a prioritization
  decision.

---

## 9. Additional Recommendations

Grounded in Max LED's actual business (a lighting/electrical distributor
selling physical goods through a commissioned sales team, .com.br —
Brazilian market):

- **LGPD compliance layer**: consent tracking per contact (marketing
  opt-in/out), a "right to be forgotten" export/delete tool, and a data
  processing log — sentiment analysis and encrypted PII already push the
  system into LGPD scope; make compliance a first-class feature, not an
  afterthought.
- **Quote/proposal generator**: branded gold-black PDF quotes generated
  straight from a deal's value + linked contact, with e-signature —
  distributors close on formal quotes, not just a CRM note.
- **Freight/logistics status**: since deals are physical LED hardware
  shipments, a lightweight shipping-status field (or carrier API
  integration) on won deals closes the loop the Kanban stops at
  "Fechado."
- **Inventory/ERP integration hook**: even a one-way sync (stock levels
  in, orders out) prevents sellers from quoting products that are out of
  stock — a common failure mode for distributor CRMs bolted on after
  the fact.
- **WhatsApp template governance**: a library of Meta-approved message
  templates (post-sale, follow-up, birthday) with approval-status
  tracking, since freeform outbound WhatsApp messages outside the
  24-hour session window require pre-approved templates.
- **Duplicate detection on import**: the export/import round-trip in
  §3.2 needs a merge step — match on email/phone/CNPJ before creating a
  duplicate contact.
- **Territory/round-robin lead routing**: referenced in the chatbot
  handoff above — worth calling out as its own configurable rule set in
  Config, not hardcoded.
- **Customer health score**: a single composite of churn risk + LTV +
  sentiment trend, shown as one badge on the contact panel — three
  numbers are useful individually, but a seller scanning a list of 40
  contacts needs the one-glance version.
- **NPS / post-sale survey automation**: auto-sent N days after a deal
  reaches "Fechado," feeding both the AI sentiment pipeline and the
  churn score.
- **2FA for Admin/Mediator accounts**: those roles hold cross-profile
  access and the Perfil module (salary-adjacent commission data) —
  the highest-value account-takeover target in the system.

---

## 10. Suggested Build Sequence

1. **MVP**: Vendas (contacts) + Negócios (Kanban) + Agenda automation +
   basic Analítica (KPI, Gráfico, Funil, Medidor de meta) + Perfil
   (goals/commission) + core permission model.
2. **V2**: Remaining Analítica components (Coorte, Zona, Quadrante,
   Detector de anomalia, Comparador, Comissão widget, GIF/Explee) +
   Rede Social + gamification + weekly reports + activity log UI.
3. **V3**: Full IA suite (forecasting, opportunity alerts, sentiment,
   cross-sell, best-contact-time) + mobile app + offline mode + voice
   assistant + chatbot + churn/LTV scoring.
4. **V4 (recommendations)**: LGPD compliance layer, quote generator,
   logistics status, ERP hook, WhatsApp template governance.

Each phase is independently shippable and none blocks the gold-and-black
design system — the brand layer (§1) should be built once, first, as
shared components every module consumes.
