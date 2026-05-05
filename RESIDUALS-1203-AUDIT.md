# Residuals Prototype × Issue #1203 — Audit

> Detailed gap analysis between the residuals UX work on this branch (`mike/residuals-rework`) and the production epic [Twill-AI/facade#1203 — Multi-Level Partner Hierarchy & Commission Engine](https://github.com/Twill-AI/facade/issues/1203).
>
> **Author's framing:** the work in this branch is a single-file HTML prototype with static JS data. It's a UX exploration, not a stepping stone to production. The audit below pinpoints, per feature, what it would take to make the prototype's behaviors functional inside the Twill production stack — what schema, API, and UI tickets cover it today, what needs amendment, and what new tickets would have to be written.

---

## 0. Architectural baseline

| Layer | Production | Prototype |
|---|---|---|
| Backend | [`Twill-AI/facade`](https://github.com/Twill-AI/facade) (FastAPI + Piccolo) | none |
| Frontend | [`Twill-AI/twill-ai-ui`](https://github.com/Twill-AI/twill-ai-ui) (Next.js) | this repo (single HTML file) |
| Data | Postgres (master schema), per-partner tenancy | JS arrays in memory |
| Auth / partner scoping | `parent_partner_enabled`, `parent_partner_id`, role-based | none — flat list with no tenancy |
| Period model | `commission_month` per row, `commission_adjustment.period`, `flagged_account_note.period` | implicit "Mar 2026" everywhere |

**Implication:** the prototype is a UX reference, not a stepping stone. Everything has to be rebuilt in `twill-ai-ui` against `facade` endpoints. No code carries over.

---

## 1. Coverage matrix — every prototype feature

Legend: 🟢 covered by an existing ticket · 🟡 partially covered (ticket needs amendment) · 🔴 no ticket exists · ⚫ out of #1203 epic scope entirely

### Residuals top-level structure

| Prototype | Status | Notes |
|---|---|---|
| Top-nav reorg (Import / Overview / Merchants / Fee Audit / Payouts) | ⚫ | Prototype-only routing. F6 rebuilds the existing `/commissions` page; there is no equivalent multi-tab "Residuals section" structure on the roadmap. |
| Analytics → Residuals sub-tab (charts moved out of Residuals) | ⚫ | The IA shift from "Residuals → Analytics" to "Analytics → Residuals" isn't captured anywhere in #1203. |

### Merchants tab

| Prototype | Status | Mapping & gaps |
|---|---|---|
| Merchant table with partner + rep stack | 🟡 | F2 adds the `Partner` column (super-partner only). F3 replaces the single-rep avatar with `<RepChipStack>`. **Mismatch:** my row shows just `partner / first rep`; F3 spec is multi-rep with split %, primary marker, effective_from. |
| Search / processor / partner / rep dropdown filters | 🟢 | Standard filter UX, F2 covers partner column + corp parent filter. Rep filter is a small extension to the existing merchants table search (no ticket). |
| `+ Add Filter` chip pattern | ⚫ | Prototype-only flourish. Could ship; not in any ticket. |
| 7 KPI tiles (Total Merchants / Volume / Txns / Gross / Margin / Fee Audit / **Missing MIDs**) | ⚫ | None of these KPIs are in #1203. The "Missing MIDs" tile in particular is a new concept (more below). |
| Row click → drawer with Summary / Waterfall / Activity tabs | 🟡 | F6 specifies a per-USER payout drawer (B12 endpoint). There's no per-MERCHANT drawer ticket. Closest is "per-merchant waterfall preview column on By Merchant tab" in F6 but that's a much smaller surface than my drawer. |
| Audit `!` icon next to flagged merchants | ⚫ | Fee Audit is a separate Twill subsystem; #1203 doesn't speak to it. |
| Custom-filter chips with active count | ⚫ | Polish only. |
| Cross-view jump from Portfolio Health tile → filtered merchants | ⚫ | Prototype-only navigation pattern. |

### Payouts tab — partner table

| Prototype | Status | Mapping & gaps |
|---|---|---|
| 6 KPI tiles (Partners/Reps Paid · Total Payout · Pending · Hold · Avg Payout % · Bonuses) | 🟡 | Total Payout, Pending, Hold are new concepts; #1203's commission engine doesn't track per-partner-period status. **"Partners Paid"** with vs-Feb delta requires a `payout_status` field per partner-period — **not in DB1-DB4**. |
| Sub-tabs: Partners / Internal Reps | 🟡 | F6 has 4 tabs: `By Merchant / By Assignee / By Partner / Flagged Accounts`. My 2-tab IA collapses By Merchant + By Assignee (Reps) and merges Flagged into row decorations. **This is a UX direction conflict with F6.** |
| Partner row columns: ☐ · Partner+tier · Merchants · Volume · Txns · Gross · Payout % · **Agent Expense** · Bonuses · Payout Amount · Status pill | 🟡 | B10 (`commissions-by-partner`) returns: `partner_name, total_merchants, total_volume, total_commission, partner_adjustments, net_commission, average_rate`. **Missing in B10 response:** `payout_pct` (split %), `agent_expense` (rebillable costs separate from adjustments), `status`. |
| Inline status pill dropdown (Approve / Pend / Hold) | 🔴 | No endpoint exists. #1203 has no payout-state machine — the model assumes commissions just get computed and paid. |
| Bulk action bar (multi-select → Approve/Pend/Hold) | 🔴 | Same. |
| Sortable columns | 🟢 | B10 supports `sort_by` (`total_commission / total_volume / total_merchants / average_rate / name`). Need to add `payout` and `expense` if those become columns. |
| Tier filter (Platinum/Gold/Silver/Bronze) | 🔴 | No `partner.tier` column exists. Pure prototype invention. |
| Row severity tints from flag detector | 🟡 | F6 has flagged accounts as a separate tab, **not as row decoration**. UX direction conflict. |

### Payouts drawer — partner detail

| Prototype | Status | Mapping & gaps |
|---|---|---|
| Drawer header (avatar, name, tier, period, status pill, Approve/Pend/Hold buttons, View All Merchants) | 🟡 | F6's per-rep drawer (B12) is a similar pattern but for users. **No partner-detail drawer exists in the spec.** B10 only returns aggregate rows. |
| Summary tab — 6 mini-KPIs + payout-calc waterfall | 🟡 | The math (Gross → × Rate → Base → − Expenses + Bonuses → Net) isn't expressible in B10's response shape. B9's commission engine outputs `partner_split_amount, bin_fee_deduction` — payout % is implicit, not surfaced as a partner-level metric. |
| **Flags tab** with AI narrative + suspect merchants | 🔴 | B11 flagged accounts is **per-merchant**, with reasons `underpriced / high_chargebacks / expense_overrun`. My prototype flags **partners** with different reasons (gross-drop, gross-spike, merch-drop, merch-spike, missing, payout-mismatch). Different abstraction, different reasons. |
| AI narrative ("recommend a quick call before approving") | ⚫ | Not in the epic. Would need an LLM service (separate from #1203). |
| **Agent Expenses** tab — equipment leases, SaaS, PCI as line items | 🔴 | This is partner-level rebillable cost. **Doesn't exist in DB2.** B7 covers per-USER recurring deductions only. There's no `partner_recurring_expense` table. |
| **Schedule A** subsection (BIN / Transaction / Auth / Batch / AVS / Chargeback / Monthly Min) with cost / sell / markup | 🔴 | Schedule A is the merchant-facing rate card. **Not modeled anywhere in #1203.** Closest is `commission.bin_fee_deduction` and the `fee_config` table that already exists in facade — but no editor surface, and no concept of cost-vs-sell markup tracking on it. |
| Bonuses tab (per-bonus card with qualifying merchants) | 🟡 | DB1 adds `partner_activation_bonus_amount/_trigger/_min_volume/_upfront_*`. B13 fires the trigger. F2 has an "Edit per-partner activation bonus" path. **Missing:** the qualifying-merchants list rendering. B10 surfaces `partner_adjustments` aggregate but not the per-merchant breakdown. |
| Activity tab — audit log of status changes / fee edits / bonus changes | 🔴 | No audit-log table on partner-level operations. B11 has notes per `(merchant, period)` but that's narrower. |
| ← → nav between filtered partners | 🟢 | Pure UI; no backend impact. |
| "View all 218 merchants →" jump | 🟢 | Existing merchants table + partner filter. F2 covers the column and filter. |

### Payouts — Internal Reps sub-tab

| Prototype | Status | Mapping & gaps |
|---|---|---|
| Same flat-table pattern for reps | 🟡 | Maps to F6's `By Assignee` tab. **Mismatch:** F6 expects this to be the *primary* per-rep view, not a sibling under Payouts. |
| Sub-rep accordion removed | 🟢 | Aligns with F6 spec (no sub-rep nesting). |
| Same drawer shape applied to reps | 🟡 | F6 spec uses B12's `/payout-detail` endpoint with a **specific** 6-section content (Per-processor / Structure applied / Deductions / Adjustments / Bonuses / Net). My drawer's Summary/Flags/Expenses/Bonuses/Activity **doesn't match** that contract. |

### Publish Residuals flow

| Prototype | Status | Mapping & gaps |
|---|---|---|
| Green "Publish Residuals" CTA | 🔴 | Not in any ticket. |
| Pre-flight modal — counts of approved/pending/hold + skipped record list + Cancel/Publish | 🔴 | Same. No `/residuals/publish` endpoint exists. |
| Per-partner activity entry "Statement published to partner portal" | 🔴 | No publish event log; no "partner portal statement" concept distinct from the CSV download. |

### Missing MIDs

| Prototype | Status | Mapping & gaps |
|---|---|---|
| KPI tile (count) | 🔴 | Not modeled anywhere. |
| Modal listing 14 missing merchants with last-residual / last-activity / cause | 🔴 | Requires diff between prior-period processor file and current — no endpoint for that today. Closest is the residual import pipeline (out of scope of #1203). |

### Analytics → Residuals atab

| Prototype | Status | Mapping & gaps |
|---|---|---|
| Portfolio Health KPIs (Total / Healthy / Watch / At-Risk / Churned / Fee Audit) | ⚫ | Health classification isn't modeled in #1203. Could be derived from existing `merchant.status` but the bucketing (Watch / At-Risk) is prototype-defined. |
| Income & Profitability chart | ⚫ | Pure visualization; not in epic. |
| Growth & Attrition / BPS Profit Margin / Industry by MCC / Processor Profitability Matrix charts | ⚫ | Same. None in #1203. |

---

## 2. Schema gaps — what DB1-DB4 doesn't cover

These prototype features assume tables/columns the epic doesn't add. Each is a candidate for a new DB ticket or an amendment.

| # | Gap | Proposed change |
|---|---|---|
| S-1 | **Partner-period payout status** for the Approve/Pend/Hold workflow + "Partners Paid" KPI | New table `partner_payout_status (partner_id, period, status enum, status_changed_by, status_changed_at, status_note, published_at)` with `UNIQUE(partner_id, period)`. Or extend an existing `partner_period` row if one is added. |
| S-2 | **Partner-level recurring expenses** (Agent Expenses tab — equipment leases, SaaS, PCI rebillables charged to the partner) | New table `partner_recurring_expense (id, partner_id, type enum, description, amount, frequency, applies_to_basis, active, created_at)`. Mirrors `user_recurring_deduction` from DB2 but at partner scope. |
| S-3 | **Schedule A (per-partner merchant rate card)** | New table `partner_schedule_a_fee (id, partner_id, fee_type, basis enum, cost_amount, sell_amount, billed_to enum, active)`. Note: facade already has `DbFeeConfig` for some of this — needs reconciliation. |
| S-4 | **Partner-level audit log** (status changes, expense edits, bonus changes) | New table `partner_activity_event (id, partner_id, period, actor_id, event_type, payload jsonb, created_at)` — or fold into a generic activity-log table if one exists. |
| S-5 | **Partner tier** (Platinum/Gold/Silver/Bronze) | New nullable column `partner.tier` if the concept survives review. Could be derived (computed) instead of stored — pick one. |
| S-6 | **Missing-MID detection** | No new column needed; this is a query (`prior period commission` ⟕ `current period commission`) — but the query needs to be a backend endpoint (see API gap A-7). |
| S-7 | **Per-partner-period publish event** | Could collapse into S-1's `published_at` field, or be a separate `payout_publication_log` if multi-publish per period is allowed. |

---

## 3. API gaps — what B1-B15 doesn't cover

| # | Gap | Proposed endpoint |
|---|---|---|
| A-1 | Approve / Pend / Hold a partner's period payout (single + bulk) | `PATCH /partner/commissions/by-partner/{partner_id}/status` (single) and `POST /partner/commissions/by-partner/bulk-status` (bulk). Returns updated partner-period rows; logs to `partner_activity_event`. |
| A-2 | Publish residuals for a period | `POST /partner/commissions/publish` — body `{period, partner_ids?}`. Idempotent. Server checks all referenced partner-periods are `approved`; returns `{published_count, skipped: [{partner_id, reason}]}`. |
| A-3 | Per-partner detail drawer endpoint (the partner equivalent of B12) | `GET /partner/commissions/by-partner/{partner_id}/detail?period=...` — returns: per-partner summary, payout calc waterfall (gross / rate / base / expenses / bonuses / net), expense line items, bonus list with qualifying merchants, recent activity. |
| A-4 | CRUD for partner recurring expenses (Agent Expenses tab) | `GET / POST / PATCH / DELETE /partner/partners/{id}/expenses` — mirrors B7's user deductions endpoints but at partner scope. |
| A-5 | CRUD for Schedule A fees | `GET / POST / PATCH / DELETE /partner/partners/{id}/schedule-a-fees`. |
| A-6 | Partner-level flag computation (gross-drop / gross-spike / merch-drop / merch-spike / missing / payout-mismatch) | `GET /partner/commissions/by-partner/{id}/flags?period=...` — returns array of `{flag_type, severity, narrative, suspect_merchants: [...]}`. **Note:** B11's flagged-accounts endpoint is per-merchant with different reasons; this is a separate endpoint. |
| A-7 | Missing-MID list | `GET /partner/commissions/missing-mids?period=...` — returns merchants with prior-period commission rows but no current-period rows, joined to last-activity and partner. |
| A-8 | "Partners Paid" delta query | Could reuse `commissions-by-partner` with status filter, or add `GET /partner/commissions/payout-status-summary?period=...` returning counts by status (approved / pending / hold) + prior-period count for the delta. |
| A-9 | Partner-level activity log | `GET /partner/partners/{id}/activity?period=...` — backs the drawer's Activity tab. |

---

## 4. UI ticket gaps — what F1-F7 doesn't cover

### F6 (Commissions page rebuild) — needs significant amendment

F6 as written assumes 4 tabs (`By Merchant / By Assignee / By Partner / Flagged Accounts`). The prototype has 2 (`Partners / Internal Reps`) with flagged data integrated as row decorations. **This is the biggest UX-direction question.** Either:

- **Option A:** Update F6 to absorb the prototype's pattern — drop the separate Flagged tab, integrate flag chips + row severity into the By Partner table, add the bulk-action bar, add the inline status-pill dropdown, add the Publish CTA + modal.
- **Option B:** Keep F6 as specified — accept that the prototype's UX won't ship; treat it as exploration.

Either way, F6 needs additions for:
- Inline status pill dropdown + bulk action bar (none in F6 spec)
- Publish Residuals CTA + pre-flight modal (none in F6 spec)
- "Partners Paid" KPI with vs-Feb delta (none in F6 spec)
- Flag-chip rendering on partner rows (only loosely, in the Flagged tab)
- Row tinting by flag severity (none)
- "Flagged only" toolbar toggle (none)

### F5 (User detail panels) — minor amendment

The Bonuses card with a `<details>` expander showing qualifying merchants isn't in F5 — F5 only handles Recurring Deductions + Commission Adjustments. The qualifying-merchants list for an activation bonus is implicit in the merchant link, not a UI element. Add: "Bonus Detail Card with qualifying-merchants list" if you want it.

### Missing entirely from the F-series

- **F8 (proposed)** — Partner detail drawer with Summary / Flags / Agent Expenses / Schedule A / Bonuses / Activity tabs. This is the per-partner equivalent of F6's per-user drawer, and isn't in the epic.
- **F9 (proposed)** — Publish Residuals workflow: green CTA, pre-flight modal showing approved/pending/hold counts and skipped records, confirm flow.
- **F10 (proposed)** — Missing MIDs surface: KPI tile + list modal.

---

## 5. Tickets that need modification

| Ticket | Required amendment |
|---|---|
| **DB1** ([#1273](https://github.com/Twill-AI/facade/issues/1273)) | Add `partner.tier` column (if tier survives design review). |
| **DB2** ([#1274](https://github.com/Twill-AI/facade/issues/1274)) | Add `partner_recurring_expense` table (mirror of `user_recurring_deduction`). Optionally add `partner_schedule_a_fee` table — or split off into its own DB ticket. |
| **B7** ([#1283](https://github.com/Twill-AI/facade/issues/1283)) | Add CRUD for `partner_recurring_expense` (mirrors user deductions endpoints). |
| **B10** ([#1286](https://github.com/Twill-AI/facade/issues/1286)) | Extend response: include `payout_pct` (computed weighted average), `agent_expense_total`, `payout_status`. Add filters for `?status=` and a `?include_flags=true` join hint. |
| **B11** ([#1287](https://github.com/Twill-AI/facade/issues/1287)) | Reconcile per-merchant flagged accounts with the prototype's per-partner flag system. Either add a new partner-flagged endpoint (A-6 above) or document the two are distinct concepts. |
| **B14** ([#1290](https://github.com/Twill-AI/facade/issues/1290)) | Extended CSV columns should include the new partner-level columns (Agent Expense, Bonuses, Status, Net Payout) when the `?include_partner_columns=true` flag is set, mirroring the super-partner extra-columns pattern. |
| **F6** ([#1299](https://github.com/Twill-AI/twill-ai-ui/issues/1299)) | All the additions in §4 above. Substantial — consider splitting into F6a (existing scope) + F6b (workflow + flags + publish). |

---

## 6. New tickets to create

Numbering picks up from the existing series.

| Ref | Layer | Title | Scope |
|---|---|---|---|
| **DB5** | Schema | Schema: partner-period payout status + partner activity log | Tables for S-1 and S-4 above. |
| **DB6** | Schema | Schema: partner-level recurring expenses + Schedule A fee card | S-2 + S-3. Could merge with DB2 if not yet shipped. |
| **B16** | Backend | Approve / Pend / Hold per-partner-period workflow | Endpoint A-1; row-level + bulk; writes to S-1 + S-4. |
| **B17** | Backend | Publish Residuals endpoint | A-2; idempotent; depends on B16. |
| **B18** | Backend | Per-partner detail drawer endpoint | A-3; analog of B12 at partner scope. |
| **B19** | Backend | Partner-level flag computation | A-6; defines the 6 flag types and their thresholds; returns suspect merchants. |
| **B20** | Backend | Missing-MIDs report endpoint | A-7. |
| **B21** | Backend | Partner-level activity log read endpoint | A-9. |
| **F8** | Frontend | Partner detail drawer (Summary / Flags / Expenses / Schedule A / Bonuses / Activity) | The per-partner equivalent of F6's per-user drawer. |
| **F9** | Frontend | Publish Residuals workflow | Green CTA + pre-flight modal + bulk action wiring; integrates with status pill from F6 amendment. |
| **F10** | Frontend | Missing MIDs surface | KPI tile + modal. |

---

## 7. Things in the prototype that should NOT make it to #1203

- **Tier filter** (Platinum/Gold/Silver/Bronze) — no production data backs this; either kill or scope as a separate "partner tagging" feature.
- **AI narrative on flags** — needs an LLM call out, separate dependency, separate ticket. Not in #1203.
- **Cross-view jump from Analytics → Residuals → Merchants** — UI polish, doesn't need a backend ticket.
- **Schedule A markup recalc on input change** — pure client-side; just polish.
- **Deterministic synthetic prev-month data** (the `poGetPrev` hash trick) — must be replaced by real prior-period queries before this ships.

---

## 8. Things in #1203 that the prototype DOESN'T address

This is the inverse list — features in the epic that have zero prototype coverage. If you want to demo against #1203, these need their own builds:

- **Two-level partner hierarchy** — super-partner / sub-partner navigation, sub-partner portfolio page (F2)
- **Multi-rep merchant assignments** with split %, role_order, effective_from (F3)
- **Per-rep commission structures** — split / floor / hybrid / default; floor pro-rated by split (F4 + B6 + B9)
- **Commission adjustments** with carry-over labels (`Carry-over from Nov 2025`) (F5 + B7)
- **Negative-residual passthrough + auto carry-over to next period** (B9)
- **Activation-bonus auto-trigger on merchant status change** (B13)
- **Equipment fee billing config** (super-partner setup, per-app billing toggle, free-equipment threshold) (F7 + B5)
- **Conditional CSV export columns for super-partners** (B14 + F6 button)
- **Corporate parent grouping** for merchants (F2 + B3)
- **Capability flags driving conditional UI** (`mca_enabled`, `parent_partner_enabled`, `deploys_own_equipment`) (F1)
- **Master-side parity** for every partner-side endpoint and screen — the prototype is a single dashboard with no master/partner distinction

---

## 9. Recommendation

The cleanest framing:

1. **Don't fold the prototype into #1203.** Treat it as design exploration. Link the live demo + the implementation notes from the epic body so reviewers and devs see it.
2. **Adopt these workflow primitives from the prototype** by amending F6 and adding the new tickets in §6: status pill / bulk actions / Publish CTA / partner drawer / flag system / Schedule A editor / Agent Expenses. These are useful enough that the epic's value drops without them.
3. **Discard from prototype before any production carry-over:** AI narrative, tier filter, cross-view jump, synthetic prev-month data.
4. **The single most important architectural decision to make now** is the F6 UX direction — keep the 4-tab spec, or move to the 2-tab + integrated-flags pattern from the prototype. Everything else falls into place once that's chosen. The prototype's flat 2-tab pattern is more usable at scale (ISO with hundreds of partners) than the 4-tab specification — but that's a Mike + Nader call.

---

## Appendix A — Tickets referenced in this audit

### `Twill-AI/facade` (epic + backend + schema)
- [#1203 — Epic: Multi-Level Partner Hierarchy & Commission Engine](https://github.com/Twill-AI/facade/issues/1203)
- [#1273 — DB1: capability flags, corporate parent, equipment ownership, per-partner bonus](https://github.com/Twill-AI/facade/issues/1273)
- [#1274 — DB2: commission tables (config, deductions, adjustments)](https://github.com/Twill-AI/facade/issues/1274)
- [#1275 — DB3: multi-rep merchant assignment](https://github.com/Twill-AI/facade/issues/1275)
- [#1276 — DB4: flagged account notes](https://github.com/Twill-AI/facade/issues/1276)
- [#1277 — B1: GET /partner/config capability flags](https://github.com/Twill-AI/facade/issues/1277)
- [#1278 — B2: child partner CRUD + per-partner bonus](https://github.com/Twill-AI/facade/issues/1278)
- [#1279 — B3: super-partner merchant list + corporate parent filter](https://github.com/Twill-AI/facade/issues/1279)
- [#1280 — B4: multi-rep assignment + bulk endpoint](https://github.com/Twill-AI/facade/issues/1280)
- [#1281 — B5: equipment fee billing config](https://github.com/Twill-AI/facade/issues/1281)
- [#1282 — B6: extend GET/PATCH /partner/users/{id}](https://github.com/Twill-AI/facade/issues/1282)
- [#1283 — B7: user-level deductions + adjustments CRUD](https://github.com/Twill-AI/facade/issues/1283)
- [#1284 — B8: commissions-by-assignee with multi-rep splits](https://github.com/Twill-AI/facade/issues/1284)
- [#1285 — B9: structures, deductions scaling, child filter, negative passthrough, auto carry-over](https://github.com/Twill-AI/facade/issues/1285)
- [#1286 — B10: commissions-by-partner aggregation](https://github.com/Twill-AI/facade/issues/1286)
- [#1287 — B11: flagged accounts (per-merchant)](https://github.com/Twill-AI/facade/issues/1287)
- [#1288 — B12: /payout-detail unified endpoint](https://github.com/Twill-AI/facade/issues/1288)
- [#1289 — B13: activation bonus auto-trigger](https://github.com/Twill-AI/facade/issues/1289)
- [#1290 — B14: CSV export conditional columns](https://github.com/Twill-AI/facade/issues/1290)
- [#1291 — B15: comprehensive demo seed](https://github.com/Twill-AI/facade/issues/1291)

### `Twill-AI/twill-ai-ui` (frontend)
- [#1294 — F1: partner config bootstrap + capability gates](https://github.com/Twill-AI/twill-ai-ui/issues/1294)
- [#1295 — F2: hierarchy UI (Partners tab + sub-partner portfolio + Partner column + corporate parent)](https://github.com/Twill-AI/twill-ai-ui/issues/1295)
- [#1296 — F3: multi-rep assignment panel + bulk + effective-from](https://github.com/Twill-AI/twill-ai-ui/issues/1296)
- [#1297 — F4: user forms (payout config + bonus config)](https://github.com/Twill-AI/twill-ai-ui/issues/1297)
- [#1298 — F5: user detail panels (deductions + adjustments + carry-over labels)](https://github.com/Twill-AI/twill-ai-ui/issues/1298)
- [#1299 — F6: commissions page rebuild (drawer, flagged accounts, waterfall, CSV)](https://github.com/Twill-AI/twill-ai-ui/issues/1299)
- [#1300 — F7: equipment fee billing UI](https://github.com/Twill-AI/twill-ai-ui/issues/1300)

---

## Appendix B — Prototype branch reference

- **Branch:** [`Twill-AI/partner-dashboard-v2 : mike/residuals-rework`](https://github.com/Twill-AI/partner-dashboard-v2/tree/mike/residuals-rework)
- **Last commit (substantive):** `feat(residuals): rework Residuals section — drawer system, flag detection, Publish flow`
- **Live preview:** the prototype runs against `partner-dashboard-v2/index.html` served at any local static port (the team uses `localhost:8080` from the existing dev setup).
- **Companion design doc** (research-grounded, partner pilot interviews): `twill-brain/05-Planning/Residuals-Page-Design.md`
- **Implementation notes** (companion to this audit): `twill-brain/05-Planning/Residuals-Implementation-Notes.md`
