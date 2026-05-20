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
      "Record the user's answer to one or more form fields. CALL THIS IN PARALLEL with multiple invocations in a single assistant turn whenever a single user answer covers multiple fields. Examples: an address answer fills street, city, state, ZIP — emit 4 record_answer calls in one turn. An EIN like '12-3456789' fills two adjacent max_length=2 and max_length=7 sub-fields — emit 2 record_answer calls. A tax-classification answer like 'LLC, partnership' may fill a checkbox AND a letter-code field — emit both. Never serialize calls across multiple turns when one turn would do. The `field` argument MUST be the exact technical field name from the schema (e.g. 'topmostSubform[0].Page1[0].f1_01[0]') — not a human-readable label. ALWAYS include a `label` — a short human-readable name for what this field represents (e.g. 'Business name', 'EIN prefix', 'Street address', 'LLC checkbox'). The label is shown to the merchant in the review drawer's Edit mode, so they can correct the value without seeing the opaque technical name.",
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
        label: {
          type: "string",
          description:
            "Short human-readable name for this field (e.g. 'Business name', 'EIN', 'Street'). Shown in the review drawer's Edit mode. For sub-divided values, label them descriptively like 'EIN prefix (2 digits)' and 'EIN suffix (7 digits)' so the merchant can edit each piece.",
        },
      },
      required: ["field", "value", "label"],
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
      "Call this IMMEDIATELY once every field in the schema has been answered via record_answer or skipped via skip_field. Call it in the SAME assistant turn as the last record_answer/skip_field calls — do not show a summary, do not ask the merchant to confirm, do not say 'say ship it'. The merchant reviews the filled PDF in a review drawer that opens automatically, with built-in Edit and Sign controls. Your job is to finish the data collection and trigger finalize; the drawer takes it from there.",
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

// Build an `editable_fields` array for the review drawer: one entry per
// field that was actually answered (not skipped), with a friendly label.
export function buildEditableFields(session) {
  const labels = session.answer_labels || {};
  return session.fields
    .filter((f) => {
      const v = session.answers[f.name];
      if (v === undefined) return false;
      if (v && typeof v === "object" && v.__skip__) return false;
      return true;
    })
    .map((f) => ({
      field: f.name,
      label: labels[f.name] || prettyFallbackLabel(f.name),
      value: String(session.answers[f.name]),
      type: f.type,
      max_length: f.max_length || null,
      options: f.options || null,
    }));
}

// If Claude forgot to provide a label (or this came in via /update before
// any agent label existed), make something less ugly than the raw IRS-style
// technical name.
function prettyFallbackLabel(name) {
  const tail = name.split(".").pop() || name;
  return tail.replace(/[\[\]]/g, " ").trim();
}

// Encode bytes as base64 in a way that works inside Cloudflare Workers
// without exhausting the call stack on larger PDFs.
export function uint8ToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToUint8(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function isTruthyValue(v) {
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "checked";
}

// Fill an AcroForm PDF with the session's collected answers. Returns
// { bytes, writeErrors, intentionallySkipped }. PDFDocument is passed in
// from the caller so this module doesn't need a top-level pdf-lib import.
export async function fillPdfFromSession({ PDFDocument, pdfBytes, session, flatten = true }) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();
  const writeErrors = [];
  const intentionallySkipped = [];

  for (const fieldSpec of session.fields) {
    const value = session.answers[fieldSpec.name];
    if (value === undefined) continue;
    if (value && typeof value === "object" && value.__skip__) {
      intentionallySkipped.push({ name: fieldSpec.name, reason: value.reason });
      continue;
    }

    let field = null;
    try {
      field = form.getField(fieldSpec.name);
    } catch {
      writeErrors.push({ name: fieldSpec.name, value, reason: "field not found" });
      continue;
    }

    try {
      switch (fieldSpec.type) {
        case "PDFTextField":
          field.setText(String(value));
          break;
        case "PDFCheckBox":
          if (isTruthyValue(value)) field.check();
          else field.uncheck();
          break;
        case "PDFDropdown":
        case "PDFOptionList":
        case "PDFRadioGroup":
          field.select(String(value));
          break;
        default:
          if (typeof field.setText === "function") field.setText(String(value));
          else writeErrors.push({ name: fieldSpec.name, value, reason: `unsupported type ${fieldSpec.type}` });
      }
    } catch (err) {
      writeErrors.push({ name: fieldSpec.name, value, reason: err.message });
    }
  }

  if (flatten) {
    try {
      form.flatten();
    } catch (err) {
      writeErrors.push({ name: "(flatten)", value: "", reason: err.message });
    }
  }

  const bytes = await pdfDoc.save();
  return { bytes, writeErrors, intentionallySkipped };
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

## 0. READ THE WHOLE PDF FIRST — before your first user-facing message.
You have the entire PDF as a \`document\` block in this conversation. Before you ask anything, study every page so you know:
- What every visible field is for (the field schema below uses opaque technical names — only the PDF tells you what they mean).
- Which fields are mutually exclusive (SSN vs EIN, individual vs entity tax class, etc.).
- Which fields are optional or for the requester/processor to fill, not the merchant.
- Which fields are subdivided across multiple text inputs (look for adjacent boxes with small max_length values — these are split values like EIN, SSN, dates, phone numbers).
Plan the entire conversation in your head before the first message. Then execute the plan in the fewest possible turns.

## 1. BATCH every question. Aim for 2–4 user turns total, not 15.
Combine multiple fields into ONE question whenever it makes natural sense. Group by topic:
- **Identity:** name + DBA + tax classification in one ask.
- **Contact:** street + city + state + ZIP in one ask.
- **Tax ID:** EIN (or SSN) in one ask.
- **Yes/no defaults:** stack the rare-yes questions ("Quick check: no foreign partners, no FATCA exemptions, no DBA, right?") and assume "no" if the merchant agrees.
The IDEAL flow for a typical W-9-style form is ONE OR TWO user messages: one batched answer covering identity+tax+address+EIN, then (only if any rare-yes fields remain unresolved) one yes/no confirmation. Then the agent auto-finalizes and the drawer pops up for review. Don't make merchants click 15 times when 1–2 will do.
When the user answers a batched question, call \`record_answer\` IN PARALLEL — multiple tool_use blocks in the same assistant turn, one per field you can fill from that answer. Never serialize across turns when one turn would do.

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

## 5. Auto-finalize the instant every field is resolved. NO ship-it ceremony.
The moment the field schema is fully covered (every field has been recorded or skipped), call \`finalize_form\` in the SAME assistant turn as your last \`record_answer\`/\`skip_field\` calls. Do not show a summary. Do not say "look right?" or "say ship it". Do not pause for confirmation. The merchant will see the filled PDF in a slide-in review drawer that has its own Edit button (to change values) and signature pad — your confirmation step is unnecessary and just slows them down.
The ONE exception: if the user clearly indicated uncertainty mid-conversation ("I'm not sure about the EIN, let me check"), end that turn with a short single-line reassurance before finalizing on the next turn. Otherwise: collect → finalize, same turn.

## 6. Tone.
Short. Direct. Friendly. Use **bold** for the field they're answering. One question per turn unless you're batching. Never paste the technical field names.

# Already-collected answers (do not re-ask)
${answeredList}

# Field schema (${session.fields.length} fields — show NONE of these technical names to the user)
${fieldList}`;
}
