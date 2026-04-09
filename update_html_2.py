import re

with open('/data/.openclaw/workspace/partner-dashboard-v2/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add an onclick handler to the table rows for the assignee table
# We need to target the rows in #res-payouts-table tbody.
# First, let's inject CSS for the accordion and cursor.
css_injection = """
<style>
.res-accordion-row {
    background: rgba(0,0,0,0.02);
    display: none;
}
.res-accordion-row.open {
    display: table-row;
}
#res-payouts-table tbody tr:not(.res-accordion-row) {
    cursor: pointer;
}
#res-payouts-table tbody tr:not(.res-accordion-row):hover {
    background: rgba(0,0,0,0.01);
}
</style>
"""
if css_injection not in content:
    content = content.replace('</head>', css_injection + '\n</head>')

# We need to process each row in res-payouts-table tbody to append accordion rows.
# Find the table tbody content:
table_start = content.find('<table class="res-table" id="res-payouts-table">')
tbody_start = content.find('<tbody>', table_start) + 7
tbody_end = content.find('</tbody>', tbody_start)
tbody_html = content[tbody_start:tbody_end]

# Split by </tr> and process
rows = tbody_html.strip().split('</tr>')
new_rows = []
for row in rows:
    if not row.strip(): continue
    row = row + '</tr>'
    # Add onclick attribute to main row
    row = row.replace('<tr data-pstatus=', '<tr onclick="toggleAccordion(this)" data-pstatus=')
    
    # Create mock accordion rows
    import random
    months = ['Feb 2026', 'Jan 2026', 'Dec 2025']
    acc_rows = ''
    
    # Extract assignee name
    m = re.search(r'<strong>(.*?)</strong>', row)
    name = m.group(1) if m else "Assignee"
    
    # Extract volume, commission, rate
    m_vol = re.search(r'<td>\$([0-9\.]+[KMB]?)</td>', row)
    vol = m_vol.group(1) if m_vol else "0"
    
    for i, month in enumerate(months):
        acc_rows += f"""
        <tr class="res-accordion-row" data-parent="{name}">
          <td></td>
          <td style="text-align:left; color:var(--text-secondary); padding-left: 36px;">↳ {name}</td>
          <td style="text-align:left;">{month}</td>
          <td>{random.randint(10, 50)}</td>
          <td>$-</td>
          <td style="color:var(--text-muted);">-</td>
          <td style="color:var(--text-secondary);">-</td>
          <td><span class="p-badge badge-green">APPROVED</span></td>
          <td></td>
        </tr>"""
    new_rows.append(row + acc_rows)

content = content[:tbody_start] + '\n' + '\n'.join(new_rows) + '\n                ' + content[tbody_end:]

# Add Modal HTML and JS logic before </body>
modal_html = """
<!-- Assignee Merchant Modal -->
<div id="res-assignee-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;align-items:center;justify-content:center;backdrop-filter:blur(2px);" onclick="if(event.target===this)this.style.display='none'">
  <div style="background:var(--bg-elevated);border-radius:10px;border:1px solid rgba(0,0,0,0.08);width:90%;max-width:1000px;max-height:85vh;display:flex;flex-direction:column;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid rgba(0,0,0,0.06);flex-shrink:0;">
      <div>
        <div style="font-size:14px;font-weight:600;font-family:var(--font-ui);color:var(--text-primary);" id="res-assignee-modal-title">Assignee Merchants</div>
        <div style="font-size:11px;color:var(--text-secondary);font-family:var(--font-data);margin-top:2px;">March 2026 Payout Detail</div>
      </div>
      <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px;" onclick="document.getElementById('res-assignee-modal').style.display='none'">✕</button>
    </div>
    
    <!-- Body Table -->
    <div style="flex:1;overflow:auto;padding:0;" class="res-table-scroll">
      <table class="res-table" style="font-size:11px; white-space:nowrap;">
        <thead>
          <tr>
            <th style="text-align:left;position:sticky;top:0;background:var(--bg-elevated);z-index:2;">Merchant</th>
            <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:2;">Processor</th>
            <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:2;">Volume</th>
            <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:2;">MoM</th>
            <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:2;">Net Income</th>
            <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:2;">Health</th>
            <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:2;">Fee Audit</th>
            <th style="position:sticky;top:0;background:var(--bg-elevated);z-index:2;">Agent</th>
            <th style="text-align:center;position:sticky;top:0;background:var(--bg-elevated);z-index:2;">Detail</th>
          </tr>
        </thead>
        <tbody id="res-assignee-modal-body">
          <!-- Populated by JS -->
        </tbody>
      </table>
    </div>
    
    <!-- Footer Actions -->
    <div style="padding:12px 20px; border-top:1px solid rgba(0,0,0,0.06); display:flex; gap:8px; background:var(--bg-surface); border-bottom-left-radius:10px; border-bottom-right-radius:10px;" id="res-assignee-modal-footer">
      <button class="btn btn-success" id="btn-modal-approve" onclick="assigneeModalAction('approved')">✓ Approve</button>
      <button class="btn btn-ghost" id="btn-modal-hold" onclick="assigneeModalAction('hold')" style="color:var(--red);">Hold</button>
    </div>
  </div>
</div>
"""
if "res-assignee-modal" not in content:
    content = content.replace('</body>', modal_html + '\n</body>')

js_logic = """
<script>
let currentAssigneeRow = null;

function toggleAccordion(tr) {
    // Only toggle if clicked on the row itself, not buttons
    if (event.target.tagName === 'BUTTON') return;
    
    const nextRows = [];
    let curr = tr.nextElementSibling;
    while (curr && curr.classList.contains('res-accordion-row')) {
        nextRows.push(curr);
        curr = curr.nextElementSibling;
    }
    
    nextRows.forEach(row => {
        if (row.classList.contains('open')) {
            row.classList.remove('open');
        } else {
            row.classList.add('open');
        }
    });
}

function openAssigneeModal(btn, assigneeName, status) {
    currentAssigneeRow = btn.closest('tr');
    document.getElementById('res-assignee-modal-title').textContent = assigneeName + ' — Merchants';
    
    // Generate some dummy data
    const tbody = document.getElementById('res-assignee-modal-body');
    let rows = '';
    for(let i=1; i<=6; i++) {
        rows += `<tr>
          <td style="text-align:left;"><strong>Demo Merchant ${i}</strong></td>
          <td>TSYS</td>
          <td>$${(Math.random()*100).toFixed(1)}K</td>
          <td style="color:var(--green);">+2.1%</td>
          <td>$${(Math.random()*1000).toFixed(0)}</td>
          <td><span class="p-badge badge-green">Healthy</span></td>
          <td><span style="color:var(--text-muted);">—</span></td>
          <td>${assigneeName}</td>
          <td style="text-align:center;"><button class="btn btn-ghost" style="padding:3px 8px;font-size:11px;">View</button></td>
        </tr>`;
    }
    tbody.innerHTML = rows;
    
    // Update footer buttons based on status
    const footer = document.getElementById('res-assignee-modal-footer');
    if (status === 'approved') {
        footer.style.display = 'none';
    } else {
        footer.style.display = 'flex';
    }
    
    document.getElementById('res-assignee-modal').style.display = 'flex';
}

function assigneeModalAction(action) {
    if (!currentAssigneeRow) return;
    
    const statusCell = currentAssigneeRow.cells[7];
    const actionsCell = currentAssigneeRow.cells[8];
    
    if (action === 'approved') {
        currentAssigneeRow.setAttribute('data-pstatus', 'approved');
        statusCell.innerHTML = '<span class="p-badge badge-green">APPROVED</span>';
        actionsCell.innerHTML = '<button class="btn btn-ghost" style="font-size:9px;padding:2px 6px;" onclick="openAssigneeModal(this, \'' + document.getElementById('res-assignee-modal-title').textContent.split(' — ')[0] + '\', \'approved\')">View</button>';
    } else if (action === 'hold') {
        currentAssigneeRow.setAttribute('data-pstatus', 'hold');
        statusCell.innerHTML = '<span class="p-badge badge-warn">ON HOLD</span>';
        actionsCell.innerHTML = '<button class="btn btn-ghost" style="font-size:9px;padding:2px 6px;" onclick="openAssigneeModal(this, \'' + document.getElementById('res-assignee-modal-title').textContent.split(' — ')[0] + '\', \'hold\')">Review</button>';
    }
    
    document.getElementById('res-assignee-modal').style.display = 'none';
    resFilterPayouts('all', document.querySelector('#res-payouts .res-filter-btn.active'));
}

// Update the onclick attributes for the action buttons in the main table
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#res-payouts-table tbody tr:not(.res-accordion-row)').forEach(tr => {
        const nameEl = tr.querySelector('strong');
        if(!nameEl) return;
        const name = nameEl.textContent.replace(/'/g, "\\\\'");
        const btn = tr.querySelector('td:last-child button');
        const status = tr.getAttribute('data-pstatus');
        if(btn) {
            btn.setAttribute('onclick', `openAssigneeModal(this, '${name}', '${status}'); event.stopPropagation();`);
        }
    });
});
</script>
"""
if "openAssigneeModal" not in content:
    content = content.replace('</body>', js_logic + '\n</body>')

# Change JS filter function to match 'approved' instead of 'paid'
content = content.replace("filter === 'paid'", "filter === 'approved'")
content = content.replace("=== 'paid'", "=== 'approved'") # just in case

with open('/data/.openclaw/workspace/partner-dashboard-v2/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Second phase completed.")
