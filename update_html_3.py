import re

with open('/data/.openclaw/workspace/partner-dashboard-v2/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure all action buttons trigger the modal
content = re.sub(
    r'<button class="btn btn-(ghost|success)" style="font-size:9px;padding:2px 6px;">(View|Approve|Review)</button>',
    r'<button class="btn btn-\1" style="font-size:9px;padding:2px 6px;" onclick="openAssigneeModal(this, \'\', this.closest(\'tr\').getAttribute(\'data-pstatus\')); event.stopPropagation();">\2</button>',
    content
)

# Fix empty name in openAssigneeModal by using the row name
# Replace openAssigneeModal(this, '', ...) with extracting the name inside the function
content = content.replace("function openAssigneeModal(btn, assigneeName, status) {",
"""function openAssigneeModal(btn, assigneeName, status) {
    if (!assigneeName) {
        assigneeName = btn.closest('tr').querySelector('strong').textContent;
    }
""")

with open('/data/.openclaw/workspace/partner-dashboard-v2/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Third phase completed.")
