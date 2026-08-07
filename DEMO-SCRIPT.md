# TWILL × SUEDE — TUESDAY DEMO SCRIPT (final, all steps browser-verified)

App: `partner-dashboard-v2` at http://localhost:8080 · Audience: Vaden, Jennie (UW/Risk), Jamie (sales), Leslie (enablement), tech leads.
**Reset (30 sec):** reload the page. Everything is in-memory — Maple back in Underwriting, inventory restocked, routing un-accepted, escalations cleared. The Suede brand persists (it's the default). If anything looks odd mid-demo: reload, you're clean.

---

## COLD OPEN — THEIR BRAND (30 sec)
**0.** You land on the Dashboard — **Suede logo, Suede rust and cream, "Powered by Twill."**
SAY: *"Before anything else — this is your portal. Your brand, your colors, live. The white-label layer is a config object, not a project."*

## PART 1 — JENNIE'S HOME: THE UNDERWRITING QUEUE (2 min)
**1.** LEFT NAV → **Underwriting** (note the live count badge). The queue groups itself: **Review Ready** (Maple Street), **Waiting on Partner** (Pacific Coast), **Fraud Callout** (TechForge), **Bank Pre-vet** (Desert Sun) — with days-in-state SLA colors and concurrence badges.
SAY: *"Jennie — your MS Review Ready, Waiting on ISO, your New York callouts, your pre-vet holds. Same statuses, but they route themselves — nothing waits for someone to go looking."*

## PART 2 — PACIFIC COAST: THE WORKBENCH (5 min)
**2.** CLICK Pacific Coast Retail in the queue → the UW Workbench opens (Conversation is one toggle away).
**3.** The banner: *"Review — items need attention"* listing exactly what to look at. **Directly beneath it: Routing — BIN placement** — front and center, because placement drives everything downstream. Then the verification grid: **MATCH, OFAC, TIN, GIACT, Credit, KYB** — one panel, timestamps, re-run buttons.
SAY: *"All six checks, one source, under two seconds — and a green-go/red-halt that tells the underwriter what to look at. Your words, Jennie."*
**4.** Documents rail → CLICK the Feb bank statement — the actual statement opens. Point at the two missing docs.
**5.** Scroll to the **Audit Trail** → the row *"Deleted bank_stmt_feb_v1.pdf — 🔒 Retained, original preserved in UW vault."*
SAY: *"Deletions don't delete. The trail is immutable."*
**6.** **Pricing & Fees**: the PCI Annual row flagged *"Differs from signed application."*
**7.** Middle cards: Risk Category · **Agent Gate** (rep within tier) · **Concurrence** (queued to Senior UW — $150K > $100K threshold).
**8.** In Documents, CLICK **Request** on the missing Owner ID → the pend composer opens prefilled. Point at the new checkbox: **"Partner may forward this request to their merchant."**
SAY: *"Default is your model — the partner is the intermediary. But a sub-partner can choose to pass the request straight through. Their call, not a system limitation."* → Send Pend.
**9.** SCROLL BACK UP to **Routing — BIN placement** (top of the page, under the banner): *"Rules compiled from Knowledge Library → Processor Information · 9 sources."* Two ranked BINs with fit % — every reason carries a **📚 source chip** (BIN Minimums Tracker, FD Rate Tables). CLICK a chip → you're in the Library, on that document. Go back, **Accept** First Data Omaha.
SAY: *"Routing isn't tribal knowledge — it's your playbook, cited. Accepting it logs the sources into the audit trail."*

## PART 3 — TECHFORGE: WHEN THE SYSTEM SAYS NO (2 min)
**10.** Underwriting queue → TechForge. **Red halt banner, Approve physically disabled.** Fraud alert on the credit pull → callout queue. **Agent Gate: outside tier — senior override required.** Routing: **🔒 Forced** — volume rule, one BIN only.
SAY: *"Controls by rule, not by memory: fraud halts, rep authority caps, forced enterprise routing, committee concurrence."*

## PART 4 — THE P1 BOUNDARY, LIVE (1 min)
**11.** TOPBAR → click **"Viewing as: Ops · Master Admin"** → flips to **Sales Rep**. Show: Underwriting gone from the nav; Library's Processor Information folder *gone entirely*; the same deal now opens to Conversation only — no BINs, no checks, no concurrence anywhere.
SAY: *"Reps sell; ops decide. Processors, BINs, Schedule A — reps never see them. That's the boundary enforced, not promised."* → Toggle back to Ops.

## PART 5 — MAPLE STREET: APPROVAL IS BOARDING (3 min)
**12.** Queue → Maple Street (Review Ready — overnight uploads already AI-triaged: 1 pend satisfied, 1 partial). CLICK **Approve**.
**13.** You land in the Deal Room: **MID assigned "just now," VAR building, gateway creds queued** — the boarding rail runs on approval.
SAY: *"Approval IS boarding. Nothing gets re-keyed into a processor portal."*
**14.** Equipment → **Assign serial from inventory** → real serial, "13 left," and a **→ Partner** message fires instantly.
**15.** Payment dropdown → **"Deduct from partner payout."**
**16.** CLICK **📄 Generate VAR sheet** → filled VAR doc: MID, BIN from the routing you accepted, serial, gateway, batch time.
SAY: *"Your team brags about one-minute VARs — this one took one click, from data that was already on the deal."*

## PART 6 — THE MONEY CLOSES THE LOOP (1.5 min)
**17.** LEFT NAV → **Inventory**: A920 stock down to 13, the pull logged with the merchant's name; low-stock alert on the A77.
**18.** LEFT NAV → **Residuals → Payouts**: Summit Lending's row shows **−$299** — the equipment deduction, already in the payout math.
SAY: *"That's the spreadsheet your deployment team emails to finance every month — gone. Deployment, inventory, and payouts are one system."*

## PART 7 — LIBRARY: THE INSTITUTIONAL BRAIN (2 min)
**19.** LEFT NAV → **Library**. Tour the tree: Product Guides (Shared), **Processor Information (REP-HIDDEN — "Ops-only. Compiles into deal routing.")**, POS, Underwriting/Risk Knowledge. Open the **POS Integration Matrix** — YES/MAYBE/NO with sources and "if NO, replace with."
**20.** Open the **Library Assistant** → run the scripted question (coursing + phone-lookup POS) → streamed answer with fit table and **Sources** cards citing the actual documents.
SAY: *"Leslie — your partner guide finally has a home that answers questions. And it cites what it says, from documents you control rep-by-rep."*

## PART 8 — BRIGHT STAR + THE REVERSAL (2.5 min)
**21.** Inventory → Recent Pulls → **Bright Star Solar** → red **Activation Overdue** alert (delivered 11 days, no first batch — the watcher flagged it). CLICK **Escalate** — locks in, partner notified.
**22.** Merchants → Maple Street (now Approved) → **↩ Re-pend to underwriting** → type a reason (required) → Confirm. You land back in the workbench; the audit trail's last row: *"Status changed Approved → Pended — [reason] — Reversal."*
SAY: *"Approve, board, catch the problem, take it back — every step named, timed, reasoned, in a log nobody can edit. That's the audit story your sponsors want."*

## CLOSE
SAY: *"One record, one system, your brand — underwriting, routing, boarding, equipment, inventory, payouts, and the partner informed at every step without anyone remembering to tell them. Where do you want to poke?"*

**Total: ~20 minutes.** Mid-call restart: reload → Underwriting nav → 30 seconds, clean.
