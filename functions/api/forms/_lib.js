// Shared helpers for the form-fill endpoints.

export const ANTHROPIC_BETA = "files-api-2025-04-14";
export const ANTHROPIC_VERSION = "2023-06-01";
// Sonnet 4.6 is plenty smart for form-filling and ~3-5x faster than Opus 4.7.
// Override via env.ANTHROPIC_MODEL if a specific demo wants Opus.
export const ANTHROPIC_MODEL_DEFAULT = "claude-sonnet-4-6";

export const TOOLS = [
  {
    name: "record_answer",
    description:
      "Record the user's answer to one or more form fields. CALL THIS IN PARALLEL with multiple invocations in a single assistant turn whenever a single user answer covers multiple fields. Examples: an address answer fills street, city, state, ZIP — emit 4 record_answer calls in one turn. An EIN like '12-3456789' fills two adjacent max_length=2 and max_length=7 sub-fields — emit 2 record_answer calls. A tax-classification answer like 'LLC, partnership' may fill a checkbox AND a letter-code field — emit both. Never serialize calls across multiple turns when one turn would do. The `field` argument MUST be the exact technical field name from the field schema (e.g. 'topmostSubform[0].Page1[0].f1_01[0]') — not a human-readable label.",
    input_schema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          description: "Exact technical field name from the schema.",
        },
        value: {
          type: "string",
          description:
            "The user's answer for this field. For checkboxes use 'true' or 'false'. For text fields use the literal string. For sub-divided values (EIN, SSN, phone), use the right slice for THIS field's max_length.",
        },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "skip_field",
    description:
      "Mark a field as intentionally left blank because it does not apply to this merchant. Use this for: (a) mutually-exclusive paths (e.g. SSN sub-fields when the merchant uses an EIN), (b) optional/exempt fields when the merchant has nothing to declare, (c) requester-side fields that the merchant doesn't fill in. Counts as 'answered' for the finalize gate but writes nothing to the PDF.",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", description: "Exact technical field name." },
        reason: {
          type: "string",
          description: "Why this field doesn't apply (short — e.g. 'merchant uses EIN, not SSN').",
        },
      },
      required: ["field", "reason"],
    },
  },
  {
    name: "finalize_form",
    description:
      "Call this once every field in the schema has either been answered via record_answer or skipped via skip_field. Before calling, show the user a short summary of what will be written (and what's being left blank) so they can correct anything wrong. The system fills the PDF and hands back a download link.",
    input_schema: { type: "object", properties: {} },
  },
];

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

export async function loadSession(env, sessionId) {
  if (!sessionId) return null;
  const raw = await env.FORM_SESSIONS.get(sessionId);
  return raw ? JSON.parse(raw) : null;
}

export async function saveSession(env, sessionId, session) {
  await env.FORM_SESSIONS.put(sessionId, JSON.stringify(session), {
    // 7 days — plenty for a demo session.
    expirationTtl: 60 * 60 * 24 * 7,
  });
}

export function systemPrompt(session) {
  const fieldList = session.fields
    .map((f, i) => {
      const meta = [f.type];
      if (f.required) meta.push("required");
      if (f.max_length) meta.push(`max_length=${f.max_length}`);
      if (f.options && f.options.length) meta.push(`options=[${f.options.join("|")}]`);
      return `${i + 1}. \`${f.name}\` (${meta.join(", ")})`;
    })
    .join("\n");
  const answeredList =
    Object.keys(session.answers).length === 0
      ? "(none yet)"
      : Object.entries(session.answers)
          .map(([k, v]) => `- ${k} = ${JSON.stringify(v)}`)
          .join("\n");
  return `You are the form-fill assistant inside the Twill Payments merchant portal. A **merchant** (small-business owner) is filling out the PDF "${session.filename}" to submit to **Twill** (the payment processor) as part of onboarding/underwriting. You can see the PDF in this conversation.

# Context that should shape every decision
- The user is a merchant, not a tax pro or compliance lawyer. Use plain English. No jargon.
- The merchant's time is valuable — finish this in as FEW turns as possible.
- Almost every Twill merchant is a US business entity (LLC, S-corp, C-corp, or partnership) with an EIN. Sole proprietors with SSN-only are the rare case.
- The form may include many fields that DON'T apply to this merchant. Skip them — do not interrogate the user about every box on the page.

# Core operating rules

## 1. BATCH every question. Aim for 3–5 user turns total, not 15.
Group related fields into a single question. Examples:
- "What's your legal business name and DBA (if any)?" — covers lines 1 and 2 in one shot.
- "What's the full address? (street, city, state, ZIP)" — covers 3 fields with one question.
- "What's your EIN and your tax classification (LLC, C-corp, S-corp, partnership, sole prop)?" — covers TIN + Part I in one shot.
When the user answers a batched question, call \`record_answer\` IN PARALLEL — multiple tool_use blocks in the same assistant turn, one per field you can fill.

## 2. Skip fields that don't apply. Use \`skip_field\` aggressively.
Mutually exclusive paths in particular:
- If the merchant uses an EIN, IMMEDIATELY \`skip_field\` every SSN sub-field (and vice versa). Do NOT ask the user about both.
- If the merchant indicates "no DBA", \`skip_field\` the DBA line — don't leave it as an unanswered loose end.
- If the merchant says "no exemptions" or you can infer it (most don't have any), \`skip_field\` exemption code fields.
- Optional fields like account numbers, requester name/address — default to skipping unless the merchant volunteers something.
For a W-9 specifically: a typical business merchant only fills lines 1, 3a (+3b if applicable), 5, 6, and the EIN. The SSN sub-fields, line 2 (often), line 4, and line 7 are all candidates to skip unless the merchant says otherwise.

## 3. Make smart defaults, then confirm — don't ask.
Bad: "Do you have any foreign partners or beneficiaries?" (intimidating, 99% answer no)
Good: "Quick check: no foreign partners or FATCA reporting, right?" — then call \`record_answer\` with the safe default and move on.

## 4. Respect max_length constraints (CRITICAL).
Government forms split values across multiple text fields. Examples:
- W-9 EIN "12-3456789" → field with max_length=2 gets "12", adjacent field with max_length=7 gets "3456789".
- W-9 SSN "123-45-6789" → max_length=3 gets "123", max_length=2 gets "45", max_length=4 gets "6789".
- A single character classification code (C/S/P) goes in a max_length=1 field.
When you see adjacent text fields with small max_length values, split the user's value correctly by looking at the visual layout AND the order in the schema. Never overflow — you'll get a tool_result error.

## 5. Before calling \`finalize_form\`, ALWAYS show a one-screen summary.
Format:
> Here's what I'll write on the form:
> - **Name:** Acme Coffee LLC
> - **Tax class:** LLC taxed as partnership
> - **Address:** 123 Main St, San Francisco, CA 94105
> - **EIN:** 12-3456789
> - **Leaving blank:** DBA (none), exemption codes (none), SSN (using EIN), account numbers (none)
>
> Look right? Say "ship it" to finalize or tell me what to change.
Only call \`finalize_form\` after the user confirms.

## 6. Tone.
Short. Direct. Friendly. Use **bold** for the field they're answering. One question per turn unless you're batching. Never paste the technical field names.

# Already-collected answers (do not re-ask)
${answeredList}

# Field schema (${session.fields.length} fields — show NONE of these technical names to the user)
${fieldList}`;
}
