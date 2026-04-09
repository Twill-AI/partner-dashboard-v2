import re

with open('/data/.openclaw/workspace/partner-dashboard-v2/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove "Commissions by Merchant" table (from its start comment to before Payout Trend Chart)
content = re.sub(
    r'<!-- Commissions by Merchant \(drill-down\) -->.*?<!-- Payout Trend Chart -->',
    '<!-- Payout Trend Chart -->',
    content,
    flags=re.DOTALL
)

# 2. In Commissions by Assignee table, replace Role column with Date
content = content.replace('<th style="text-align:left;">Role</th>', '<th style="text-align:left;">Date</th>')
# Remove the Role column contents and replace with empty strings for main rows
content = re.sub(r'<td style="text-align:left;color:var\(--text-secondary\);">Sales Rep</td>', '<td></td>', content)
content = re.sub(r'<td style="text-align:left;color:var\(--text-secondary\);">Sales Manager</td>', '<td></td>', content)
content = re.sub(r'<td style="text-align:left;color:var\(--text-secondary\);">Referral Partner</td>', '<td></td>', content)

# 2d. Change PAID to APPROVED
content = content.replace('data-pstatus="paid"', 'data-pstatus="approved"')
content = content.replace('<span class="p-badge badge-green">PAID</span>', '<span class="p-badge badge-green">APPROVED</span>')
content = content.replace('<strong>18</strong> paid', '<strong>18</strong> approved')

# 3. Import tab - remove the Feb rows
content = re.sub(
    r'<tr style="opacity:0\.5;">\s*<td style="text-align:left;">Feb 14.*?</tr>',
    '',
    content,
    flags=re.DOTALL
)

# 4. Remove Agents tab
content = content.replace('<div class="res-tab" onclick="resShowTab(\'res-agents\', this)">Agents</div>\n', '')

with open('/data/.openclaw/workspace/partner-dashboard-v2/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Basic string replacements done.")
