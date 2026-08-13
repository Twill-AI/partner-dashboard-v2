# CASH demo — data mapping notes

Branch `mike/cash-whitelabel`. White-label copy of the Partner OS prototype skinned for
**CASH — Coastal Acquiring Secure Holdings** (coastalacquiring.com), carrying three real
merchants alongside the 22 sample ones.

Source: three North processor transaction registers, **July 2026**, 98,222 rows total.
Files were named `Jun26_transactions_*` but every transaction date in them is
2026-06-30 → 2026-07-31.

---

## The three real merchants

| Merchant | Site ID (MID) | State | MCC | Txns | Net volume | Avg ticket | Batches | Return rate |
|---|---|---|---|---|---|---|---|---|
| Asian Takeout Order | 526118048887 | NC | 5814 Fast Food | 18,345 | $837,346.14 | $45.78 | 36 | 0.127% |
| TruConnect Communication | 526143102881 | CA | 4814 Telecom | 50,522 | $638,647.30 | $12.87 | 98 | 1.364% |
| TextBehind | 526122672888 | MD | 4814 Telecom | 29,355 | $64,685.49 | $2.29 | 58 | 2.328% |

Net volume = sum of `Processed Sales Amount`. Returns are **already signed negative** in
the source, so the net is a plain sum — do not subtract them again. Average ticket is over
purchases only. Return rate is `|returns| / gross purchases`.

---

## What is real in the portal

Driven by `CASH_REAL` (embedded in `index.html`, ~13 KB) and bound by the
`CASH REAL-DATA BINDING` block near the end of the file:

- **Daily volume, transaction count, average ticket** — 31-day series per merchant
- **Batches** — every batch (36 / 98 / 58) with its number, date, transaction count and total
- **Card brand mix** — share of settled volume by network
- **Payment method mix** — Manual / Mobile & eCommerce / Credential on File
- **AVS result mix**
- **Return count and return rate**
- **Activity feed** — the last 14 batch settlements, real amounts and batch numbers
- **Identity** — MID, state, MCC, processor

## What is deliberately blank, and why

The register is a **sales register, not a statement**. 65 columns, none of them cost.
These fields render `—` with a tooltip explaining the gap, and must not be backfilled
with estimates:

| Field | Why it cannot be computed |
|---|---|
| Residual, fees paid, effective rate | No interchange, fee or discount columns exist in the file |
| Authorisation rate | Every row has status `Processed` — approved transactions only, so there is no decline denominator |
| Chargeback rate | No dispute records. The returns in the file are **refunds**, which are a different thing |
| Deposit / funding amount | `Funded Date` exists but carries no amount, and it just mirrors `Batch Date` (0-day lag on all 192 batches) |
| YoY growth | Single month of data. The tile was relabelled to Return Rate, which is real |

**We have batch data. We do not have deposit data.** Batches are groups of transactions
and their gross totals; a deposit is what actually landed in the bank net of fees and
holds. The second one is not in this file.

To populate the cost fields, we need the **North merchant statements** for July 2026 for
these three MIDs. Nothing else unlocks them.

---

## Implementation notes

- **Colour sweep.** The Suede skin was terracotta/cream applied both through a token block
  and a file-wide hex sweep. Re-skinning to CASH replaced 1,318 colour occurrences across
  `index.html`, `merchant.html` and `sub-partner.html`. Semantic red/amber/green were
  explicitly protected — see the `PROTECTED_RGB` / `PROTECTED_HEX` sets in the sweep script.
- **Status colours were set by hand, not swept.** A mechanical warm→cool map collapsed
  lead / underwriting / declined / boarding into four near-identical blues. `mStatusConfig`
  now sets them explicitly so the ten pipeline stages stay distinguishable.
- **Snapshot / restore.** The KPI strip, donut legends, period snapshot and activity thread
  are static markup the demo path never rewrites. Binding a real merchant mutates them in
  place, so the original HTML is captured on first bind and restored when a sample merchant
  is opened — without this, a real merchant's figures leak onto every demo merchant viewed
  afterwards. Snapshot selectors are all canvas-free on purpose; replacing `innerHTML` on a
  node containing a `<canvas>` detaches its Chart.js instance.
- **`view-merchant-active` is duplicated 6× in `index.html`** (pre-existing, from the merge
  history — not introduced here). All binding code resolves elements from `.view.active`
  rather than by bare id, because `getElementById` returns the first match, which is often
  not the visible one.
- Demo partner "Coastal Commerce" was renamed **Meridian Commerce** (54 occurrences) so it
  does not read as a half-finished find-and-replace next to Coastal Acquiring.

## Privacy

Only aggregates ship in the build. The raw registers contain masked PANs (first-6/last-4),
auth codes and acquirer reference numbers; **no row-level card data is embedded in the
portal** and the CSVs are not committed to this repo.

## Local dev

```bash
python3 serve.py 8920
```

Or the `cash-portal` entry in `.claude/launch.json`.
