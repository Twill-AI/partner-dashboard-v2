# Twill Partner Portal — Design System

Last updated: 2026-03-18

---

## Color Tokens

```css
--bg-base:       #F7F5F0;   /* Page background — warm off-white */
--bg-surface:    #EFECE6;   /* Sidebar, topbar, section backgrounds */
--bg-elevated:   #F2EFEA;   /* Cards, inputs, dropdowns */
--bg-hover:      rgba(0,0,0,0.03);
--bg-selected:   rgba(0,0,0,0.05);

--border:        rgba(0,0,0,0.04);   /* Universal card/section border — subtle warm */
--border-strong: rgba(0,0,0,0.055); /* Dividers, drawer separators — still very soft */
```

> **Rule:** All borders use `var(--border)` or `var(--border-strong)`. Never hardcode `rgba(0,0,0,X)` on a border — it breaks universal changes. `.card`, `.kpi-strip`, `.sc`, `.sc.gray`, and all components must reference the variable.

---

## Typography

```css
--font-mono:  'JetBrains Mono', 'SF Mono', monospace;   /* Numbers, IDs, data values */
--font-ui:    'Plus Jakarta Sans', -apple-system, sans-serif;  /* Labels, headings, buttons */
--font-data:  'Inter', -apple-system, sans-serif;        /* Body text, descriptions */
--font-body:  'Plus Jakarta Sans', -apple-system, sans-serif;  /* Nav, body */
```

### Font usage rules
- Numeric KPI values: `font-family:var(--font-mono)`, `font-weight:700`
- Section labels / uppercase caps: `var(--font-ui)`, `text-transform:uppercase`, `letter-spacing:0.06em`
- Body copy, descriptions: inherits `var(--font-data)` from `body`
- Buttons: `var(--font-ui)`

---

## Spacing & Shape

- Card border-radius: `10px`
- Button border-radius: `6px`
- Badge border-radius: `4px`
- Section card (`.sc`) border-radius: `10px`
- Row height (standard table): `36px` header, `var(--row-h)` for data rows

---

## Core Components

### KPI Summary Strip
```css
.m-portfolio-summary  /* flex row, no border, no border-radius */
.m-summary-stat       /* flex col, border-right: 1px solid var(--border), padding 0 20px 12px 0 */
.m-stat-label         /* 12px, uppercase, letter-spacing:0.06em, color:var(--text-muted) */
.m-stat-value         /* 16px, font-weight:700, font-family:var(--font-mono) */
.m-stat-sub           /* 12px, color:var(--text-muted) */
```
> Never add `border` or `border-radius` inline to `.m-portfolio-summary`. The class is borderless by design.

### Section Cards
```css
.sc              /* bg-surface, border:var(--border), border-radius:10px */
.sc.gray         /* border-color:var(--border-strong) */
.sc-hdr          /* flex row, padding:10px 16px, min-height:42px */
.sc-hdr.gray     /* bg-elevated, border-bottom:1px solid rgba(0,0,0,0.05) */
```

### KPI Tiles (inline, not card)
```css
background:var(--bg-elevated);
border:1px solid var(--border);
border-radius:10px;
padding:14px 16px;
```
Label: `font-size:13px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.05em;`
Value: `font-size:22px; font-weight:700; font-family:var(--font-mono); line-height:1.1;`

### Stage Dots & Labels
```css
.m-sdot.lead         { background:#3B82F6 }
.m-sdot.inreview     { background:#818CF8 }
.m-sdot.approved     { background:#4ADE80 }
.m-sdot.boarding     { background:#FFDE00 }
.m-sdot.active       { background:var(--green) }
.m-sdot.declined     { background:var(--red) }
```

### Partner/Merchant Topbar (detail views)
```html
<div class="back-btn"> ← </div>
<div class="p-avatar"></div>
<div class="merch-name">Partner Name</div>
<span class="p-badge bb">ISO</span>
<span class="p-badge" style="font-family:var(--font-mono);font-size:11px;">PTR-0042</span>
```

---

## Tables

### Standard single-line table: `.m-table`
- `table-layout:fixed`, `white-space:nowrap`, `height:36px` rows
- Use only when rows are guaranteed single-line
- **Do NOT use for Partners table** — commission/BIN fee columns are multi-line

### Multi-line table (Partners)
- `table-layout:fixed` with `<colgroup>` explicit widths
- `overflow:hidden` on all `<td>` 
- No `.m-table` class — custom inline styles on `<table>`

---

## Borders — Approved Values (locked Mar 18, 2026)

| Token | Value | Use |
|---|---|---|
| `--border` | `rgba(0,0,0,0.04)` | Cards, section containers, inputs |
| `--border-strong` | `rgba(0,0,0,0.055)` | Dividers, drawer separators, `.sc.gray` |

> These were dialed in by Mike on Mar 18, 2026 as the canonical values. Do not change without explicit approval.

---

## Deploy

```bash
cd /data/.openclaw/workspace/partner-dashboard-v2
CLOUDFLARE_API_TOKEN=$(cat /data/.openclaw/cloudflare_api_token.txt) npx wrangler pages deploy . --project-name twill-dashboard-v2 --branch main
```

Always use hash-based preview URLs (e.g. `https://XXXXXXXX.twill-dashboard-v2.pages.dev`).  
Never link to `twill-dashboard-v2.pages.dev` directly — it redirects to Zero Trust login.
