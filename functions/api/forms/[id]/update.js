import { PDFDocument } from "pdf-lib";
import {
  buildEditableFields,
  errorResponse,
  fillPdfFromSession,
  jsonResponse,
  loadSession,
  saveSession,
  uint8ToBase64,
} from "../_lib.js";

// POST /api/forms/:id/update
// Body: { changes: { "<technicalFieldName>": "<newValue>", ... } }
// Applies the merchant's drawer-Edit-mode edits to session.answers and
// re-renders the filled PDF. Returns the same shape as /finalize so the
// drawer can just swap the iframe.
export async function onRequestPost({ request, env, params }) {
  const session = await loadSession(env, params.id);
  if (!session) return errorResponse("Session not found.", 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Expected JSON body with { changes: { field: value } }.");
  }
  const changes = body && body.changes;
  if (!changes || typeof changes !== "object") {
    return errorResponse("Missing 'changes' object.");
  }

  // Apply edits to the answers. Validate each against the schema and
  // max_length so the merchant gets a useful error per field.
  const fieldErrors = {};
  for (const [field, rawValue] of Object.entries(changes)) {
    const schema = session.fields.find((f) => f.name === field);
    if (!schema) {
      fieldErrors[field] = "unknown field";
      continue;
    }
    const value = rawValue == null ? "" : String(rawValue);
    if (
      schema.max_length &&
      value.length > schema.max_length &&
      schema.type === "PDFTextField"
    ) {
      fieldErrors[field] = `too long (${value.length} chars, max ${schema.max_length})`;
      continue;
    }
    session.answers[field] = value;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return errorResponse(
      "Some edits couldn't be applied: " +
        Object.entries(fieldErrors)
          .map(([k, v]) => `${k} — ${v}`)
          .join("; "),
      400,
    );
  }

  // Re-render the PDF.
  const pdfBytes = await env.FORM_SESSIONS.get(`${params.id}:pdf`, "arrayBuffer");
  if (!pdfBytes) {
    return errorResponse("Original PDF bytes missing — session may have expired.", 410);
  }
  let filled;
  try {
    filled = await fillPdfFromSession({
      PDFDocument,
      pdfBytes,
      session,
      flatten: true,
    });
  } catch (err) {
    return errorResponse(`Failed to re-fill PDF: ${err.message}`, 500);
  }

  await saveSession(env, session.id, session);

  const baseName = (session.filename || "form.pdf").replace(/\.pdf$/i, "");
  return jsonResponse({
    filename: `${baseName}-filled.pdf`,
    pdf_base64: uint8ToBase64(filled.bytes),
    written_count:
      Object.keys(session.answers).length - filled.intentionallySkipped.length,
    field_count: session.fields.length,
    intentionally_skipped: filled.intentionallySkipped,
    skipped: filled.writeErrors,
    editable_fields: buildEditableFields(session),
  });
}
