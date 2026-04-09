# Comprehensive Design Critique — Payments Partner Dashboard

---

## Screenshot 01 — Partner Dashboard (Top Half)

### What's Wrong
1. **KPI stat cards have no visible container boundaries.** The six metrics at the top blur into each other. Without cards or sufficient column gaps, it reads as one horizontal text soup. The labels (ACTIVE PARTNERS, TOTAL MERCHANTS, etc.) in all-caps small text are too light (~#999) against #F7F5F0 — contrast fails WCAG AA for small text.
2. **Inconsistent KPI accent colors.** "PENDING APPS: 23" uses a saturated dark teal/green. "AUTH RATE" change indicator uses a saturated red ("↓ 0.4% vs last week"). These feel like default Bootstrap semantic colors, not the "muted earthy" palette specified. That red is screaming on a warm background.
3. **Typography hierarchy is unclear.** The large numbers (14, 847, $4.2M) appear to be the same font — no evidence of JetBrains Mono for numerical data vs Plus Jakarta Sans for labels. The numbers and labels compete rather than creating a clear scan path.
4. **Processing Volume chart area is enormous but underutilized.** The chart takes up ~60% of the visible content area but the actual data line uses maybe 30% of the vertical space ($100K-$350K range). Massive dead space below the chart, above the data line. The chart grid lines are too prominent — they compete with the data.
5. **"90d" toggle pill** uses a saturated yellow (#EAB308-ish) that clashes with the warm off-white. It looks like a warning state, not an active filter. The "30d" inactive state has almost no visual affordance.

### What to Fix
- **KPI cards:** Add `background: #FFFFFF`, `border-radius: 12px`, `padding: 24px 28px`, `box-shadow: 0 1px 2px rgba(0,0,0,0.04)`. Gap between cards: `gap: 16px`. Labels: `font-size: 11px`, `letter-spacing: 0.08em`, `color: #8C8578` (warm grey).
- **Numbers:** Switch to `font-family: 'JetBrains Mono'`, `font-weight: 500`, `font-size: 28px`, `color: #2C2925`.
- **Change indicators:** Use muted earthy greens `#5B7A5E` for positive, `#A67C5B` for neutral, `#9B6B5B` for negative — never saturated red/green.
- **Chart:** Reduce height by ~25%. Grid lines: `stroke: #EDEBE6`, `stroke-width: 0.5`. Y-axis text: `font-family: 'JetBrains Mono'`, `font-size: 11px`, `color: #A09B93`.
- **90d pill:** Use `background: #2C2925`, `color: #FFFFFF`, `border-radius: 6px`, `padding: 4px 12px`. Inactive: `color: #8C8578`, `background: transparent`.

### Priority
- KPI contrast/readability: **Critical**
- Color palette violations: **Critical**
- Typography font enforcement: **Critical**

---

## Screenshot 02 — Partner Dashboard (Bottom Half / Scrolled)

### What's Wrong
1. **Activity feed and Messages sit side-by-side but with insufficient visual separation.** The two columns rely on card boundaries but the internal density is high.
2. **"ASSIGNED TO YOU" badge** is a bright red/crimson pill — too aggressive for this design language. Same with "Chargeback" (orange) and "No Batch" (olive/yellow).
3. **Activity item spacing is too tight.** Items are ~56px tall with text crammed in.
4. **Messages list** has unread indicators (blue dots) that are a saturated cobalt blue — inconsistent with earthy palette.
5. **The entire page is too long.** Dashboard scrolls extensively.

### What to Fix
- **Badges:** "ASSIGNED TO YOU" → `background: #F0E6E2`, `color: #9B6B5B`, `font-size: 10px`, `font-weight: 600`, `padding: 2px 8px`, `border-radius: 4px`.
- **Activity items:** Increase row height to `min-height: 64px`, add `padding: 12px 16px`. Timestamp: `color: #A09B93`, `font-size: 12px`.
- **Unread dots:** `background: #8C7A5E` (warm brown) instead of blue.
- **Page length:** Consider collapsing elements into a tab or drawer, not the main scroll.

### Priority
- Badge color violations: **Critical**
- Page scroll length: **Critical**
- Activity density: **Medium**

---

## Screenshot 03 — Merchant Portfolio (List View)

### What's Wrong
1. **This table is extremely dense and overwhelming.** 12+ columns crammed into view. Multi-line text wraps awkwardly. This is the opposite of "I can breathe in here."
2. **"AI SUGGESTED" labels** in bright red/orange uppercase text appear on nearly every row. Noisy.
3. **Status badges are inconsistent.** Colors and text are all over the place.
4. **MID numbers** font size is too small and the color contrast against the warm background is poor.
5. **The KPI bar at the top** repeats from the Dashboard. Irrelevant here.

### What to Fix
- **Reduce columns:** Hide NOTES and LAST BATCH by default.
- **"AI SUGGESTED" labels:** Remove the label entirely. Use a subtle left-border on rows with AI suggestions: `border-left: 3px solid #C4A96A`.
- **Status badges:** Single consistent style: `display: inline-flex`, `padding: 3px 10px`, `border-radius: 4px`, `font-size: 12px`, `font-weight: 500`.
- **Row height:** Enforce consistent `height: 52px` per row. No multi-line cells.
- **KPI bar:** Replace with Merchant-specific KPIs or remove entirely.

### Priority
- Table density/overwhelm: **Critical**
- "AI SUGGESTED" visual noise: **Critical**
- Duplicated KPIs: **Medium**

---

## Screenshot 04 — Applications Pipeline (List View)

### What's Wrong
1. **Same duplicated KPI bar problem** as Screenshot 03.
2. **"AI SUGGESTED" noise persists**.
3. **Status colors are more saturated here.** "Underwriting" and "Out for Signature" in bright orange/coral.
4. **"Internal" tag** uses a warm red/salmon color instead of a neutral one.
5. **POTENTIAL VOL. column** has inconsistent formatting.

### What to Fix
- **Remove dashboard KPIs.** Replace with application-specific metrics.
- **"AI SUGGESTED":** Same fix as 03.
- **Status styling:** Unified muted palette.
- **"Internal" tag:** `background: #EDEBE6`, `color: #6B6560` — neutral, not red.
- **Potential volume:** Enforce consistent formatting with JetBrains Mono.

### Priority
- Duplicated irrelevant KPIs: **Critical**
- AI SUGGESTED noise: **Critical**
- Status color saturation: **Medium**

---

## Screenshot 05 — Residuals Overview

### What's Wrong
1. **ISO PROFIT value ($338,916)** is huge but uses the wrong font. It needs JetBrains Mono. The green trend indicator next to it is too bright.
2. **Card spacing:** The layout feels cramped. There isn't enough breathing room around the primary metric.
3. **Chart colors:** The stacked bar chart uses harsh, contrasting colors instead of the muted earthy palette.

### What to Fix
- **ISO PROFIT:** Apply `font-family: 'JetBrains Mono'`, `font-size: 36px`. Change the trend indicator to a muted green `#5B7A5E`.
- **Card spacing:** Increase padding to `32px` on the main card. Use `gap: 24px` for internal elements.
- **Chart colors:** Use variations of the earthy palette (e.g., `#A67C5B`, `#8C7A5E`, `#C4A96A`).

### Priority
- Typography: **Critical**
- Chart colors: **High**
- Spacing: **Medium**

---

## Screenshot 06 — Residuals Processors

### What's Wrong
1. **Table borders are too prominent.** The design brief specifies spacing as the primary hierarchy tool, not borders, but this table uses heavy, dark borders.
2. **Data alignment:** Financial figures are left-aligned instead of right-aligned, making them hard to scan.
3. **Density:** The rows are too tight, lacking the "breathe in here" feel.

### What to Fix
- **Table borders:** Remove horizontal borders or make them extremely subtle (`1px solid #EBE9E4`). Increase row padding.
- **Data alignment:** Right-align all numerical columns. Use JetBrains Mono.
- **Density:** Increase row height to `48px`.

### Priority
- Data alignment: **Critical**
- Table borders: **High**
- Density: **Medium**

---

## Screenshot 07 — Residuals Agents

### What's Wrong
1. **Hierarchy:** The agent names are the same size and weight as the data points. There is no clear primary scan path.
2. **Highlight colors:** The selected row uses a bright blue highlight that clashes with the warm background.
3. **Empty states:** Cells with no data show a harsh "N/A" or "0" instead of a subtle dash.

### What to Fix
- **Hierarchy:** Make agent names `font-weight: 600`, `color: #1A1A1A`. Subdue secondary data to `#6B6560`.
- **Highlight colors:** Use a very subtle off-white/grey for selected or hovered rows (`#EFEBE4`).
- **Empty states:** Use a centered, muted dash (`—`) with `color: #A09B93`.

### Priority
- Hierarchy: **Critical**
- Highlight colors: **High**
- Empty states: **Minor**

---

## Screenshot 08 — Residuals Merchants

### What's Wrong
1. **Filter bar is cluttered.** Too many dropdowns packed tightly together with thick borders. It looks like a legacy enterprise app.
2. **Merchant status:** Again, using bright, saturated colors (traffic light red/green) instead of the semantic earthy tones.
3. **Pagination:** The pagination controls are bulky and draw too much attention.

### What to Fix
- **Filter bar:** Remove borders, use subtle background fills for inputs (`#F2EFEA`). Increase gap between filters to `16px`.
- **Merchant status:** Revert to the muted semantic colors defined earlier (`#7A9B78` for active, etc.).
- **Pagination:** Simplify to text links or minimal icons with no backgrounds unless active.

### Priority
- Filter bar clutter: **High**
- Merchant status colors: **High**
- Pagination: **Minor**

---

## Screenshot 09 — Residuals Analytics

### What's Wrong
1. **Graphs are overwhelming.** Too many lines on a single chart without clear legends or tooltips. The gridlines are too dark.
2. **Date picker:** The date range selector looks like a default browser input, lacking premium styling.
3. **"Export" button:** Draws too much attention with a solid, dark background when it should be a secondary action.

### What to Fix
- **Graphs:** Simplify. Reduce line thickness. Lighten gridlines to `stroke: #EDEBE6`. Use the earthy palette for data lines.
- **Date picker:** Style it custom. `background: #FFFFFF`, `border: 1px solid #EBE9E4`, `border-radius: 8px`, `padding: 8px 12px`.
- **"Export" button:** Make it a ghost or outline button. `color: #5C5850`, `border: 1px solid #DDD8D0`, `background: transparent`.

### Priority
- Graphs: **Critical**
- Date picker: **Medium**
- Export button: **Minor**

---

## Screenshot 10 — Residuals Fee Audit

### What's Wrong
1. **Red text for discrepancies is too aggressive.** It's a harsh, pure red that violates the calm/premium aesthetic.
2. **Table layout:** The columns are too narrow, causing text to truncate or wrap uncomfortably.
3. **Lack of focus:** Everything looks equally important. The actual discrepancies don't stand out properly because of the overall noise.

### What to Fix
- **Red text:** Use a muted, earthy terracotta/rust color for discrepancies, e.g., `#B07A6A`.
- **Table layout:** Widen the table. Allow horizontal scroll if necessary, rather than cramming columns. Increase padding.
- **Focus:** Dim the non-discrepancy rows slightly (`opacity: 0.7`) or use a subtle background tint on the discrepancy rows to draw the eye naturally.

### Priority
- Red text color: **Critical**
- Table layout: **High**
- Focus: **Medium**

---

## Screenshot 11 — Residuals Payouts

### What's Wrong
1. **"Pay All" button is massive and bright green.** It looks like a cheap call-to-action on a landing page, not a premium fintech interface.
2. **Payout status pills:** Inconsistent sizing and padding. They look sloppy.
3. **Bank account details:** Displayed in a generic sans-serif instead of the structured mono font for data.

### What to Fix
- **"Pay All" button:** Use the primary dark brand color (`#1A1A1A`) or a muted dark green (`#2A3B2C`). Adjust padding to make it elegant, not bulky.
- **Payout status pills:** Standardize to `height: 24px`, `padding: 0 10px`, `border-radius: 12px`, `font-size: 11px`, `line-height: 24px`.
- **Bank account details:** Apply JetBrains Mono for routing and account numbers to convey precision.

### Priority
- "Pay All" button: **High**
- Payout status pills: **Medium**
- Bank account details: **Medium**

---

## Screenshot 12 — Residuals Import

### What's Wrong
1. **Drag-and-drop zone is generic.** Dashed border is too thick and dark. The icon is generic.
2. **Success/Error messages:** The error state uses a harsh red box with white text. Very jarring.
3. **File list:** Uploaded files look cluttered, with no clear distinction between the file name, size, and status.

### What to Fix
- **Drag-and-drop zone:** Use a subtle dashed border: `2px dashed #DDD8D0`. Lighter icon color (`#A09B93`). Background hover state should be `#F2EFEA`.
- **Messages:** Use a soft background for errors (`#FDF5F3`) with dark terracotta text (`#9B6B5B`). No solid red boxes.
- **File list:** Improve hierarchy. File name: `font-weight: 500`. Size: `color: #A09B93`. Status: subtle icon or muted text. Add more spacing between items.

### Priority
- Drag-and-drop zone: **Medium**
- Error messages: **High**
- File list: **Medium**

---

## Screenshot 13 — Tickets

### What's Wrong
1. **Ticket priority tags.** "Urgent" is bright red, "High" is bright orange. This breaks the calm/premium requirement completely.
2. **List density.** Tickets are packed too tightly. The two-line layout per ticket is cramped, making it hard to read the subject line quickly.
3. **"New Ticket" button.** It's floating awkwardly and competing with the search bar.

### What to Fix
- **Priority tags:** Use the earthy palette. Urgent: `#B07A6A` (muted terracotta). High: `#A67C5B` (muted ochre). Normal: `#8C8578` (warm grey).
- **List density:** Increase the vertical padding on each ticket item to at least `16px`. Ensure the subject line is visually distinct (larger, darker) from the meta-data.
- **"New Ticket" button:** Align it properly with the header or search bar. Use a standard primary button style (`background: #1A1A1A`, `color: #FFFFFF`).

### Priority
- Priority tags: **Critical**
- List density: **High**
- Button placement: **Medium**

---

## Screenshot 14 — Analytics

### What's Wrong
1. **Dashboard vomit.** Too many charts crammed onto one screen. It's overwhelming and violates "easy to scan".
2. **Inconsistent chart styles.** Some are bars, some are lines, some are donuts, and they don't share a cohesive color palette or grid style.
3. **Legend placement.** Legends are either missing, overlapping data, or placed inconsistently across charts.

### What to Fix
- **Layout:** Introduce a grid system with more whitespace (spacing as primary hierarchy tool). Group related charts or move some to separate tabs.
- **Chart styles:** Unify the design language. Use consistent grid lines (`#EDEBE6`), axis labels (`JetBrains Mono`), and the earthy color palette (`#5B7A5E`, `#A67C5B`, `#B07A6A`, `#8C8578`, `#C4A96A`).
- **Legends:** Standardize legend placement (e.g., always top-right of the chart container) and use a consistent, small font size (`11px`).

### Priority
- Layout/Density: **Critical**
- Chart consistency: **Critical**
- Legends: **Medium**
