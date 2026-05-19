// Shared helpers for the form-fill endpoints.

export const ANTHROPIC_BETA = "files-api-2025-04-14";
export const ANTHROPIC_VERSION = "2023-06-01";
export const ANTHROPIC_MODEL = "claude-opus-4-7";

export const TOOLS = [
  {
    name: "record_answer",
    description:
      "Record the user's answer to a single form field. Call this every time the user provides a value for a field shown in the PDF. The `field` argument MUST be the exact technical field name from the field schema (e.g. \"topmostSubform[0].Page1[0].f1_01[0]\") — not a human-readable label.",
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
            "The user's answer. For checkboxes, use 'true' or 'false'. For text fields, use the literal string the user provided.",
        },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "finalize_form",
    description:
      "Call this when EVERY required field in the schema has been answered. The system will fill the PDF with the collected answers and return a download link to the user.",
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
  return `You are a friendly form-filling assistant for Twill Payments merchants. The user has uploaded a PDF form called "${session.filename}". You can see the PDF in this conversation.

Your job:
1. Look at the PDF to understand what each field is asking for.
2. Walk the user through the form ONE field at a time, in the order they appear on the page. Ask short, plain-English questions ("What's your business legal name?", "What's the EIN?"). Do NOT show them the technical field names.
3. When the user answers, call the \`record_answer\` tool with the EXACT technical field name from the schema below and the value the user gave you.
4. For checkboxes, present the choices clearly and pass "true" or "false" as the value depending on whether the box should be checked.
5. When you've collected an answer for every field in the schema, call \`finalize_form\`. Do not call it before you have all the answers.
6. Be concise. One short message per turn. No essays.
7. CRITICAL — respect \`max_length\` constraints. Government forms (W-9, ACH, etc.) often split a single user-facing value across multiple text fields with strict per-field character caps. Example: a W-9 EIN of "12-3456789" splits into a max_length=2 field with "12" and a max_length=7 field with "3456789" — NOT the other way around. When you see two adjacent text fields with small max_length values, ask yourself which one is the prefix and which is the suffix by looking at the visual layout, and split the user's value accordingly. Never put a value longer than max_length into a field; you'll get a tool_result error and have to redo it.

Already-collected answers (do not re-ask these):
${
  Object.keys(session.answers).length === 0
    ? "(none yet)"
    : Object.entries(session.answers)
        .map(([k, v]) => `- ${k} = ${v}`)
        .join("\n")
}

Field schema (${session.fields.length} fields):
${fieldList}`;
}
