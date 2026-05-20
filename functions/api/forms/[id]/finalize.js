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

// POST /api/forms/:id/finalize
// Loads stored PDF + answers, fills + flattens via shared helper, returns
// base64 + editable_fields + signature_required for the review drawer.
export async function onRequestPost({ env, params }) {
  const session = await loadSession(env, params.id);
  if (!session) return errorResponse("Session not found.", 404);

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
    return errorResponse(`Failed to fill PDF: ${err.message}`, 500);
  }

  session.finalized = true;
  session.finalized_at = new Date().toISOString();
  await saveSession(env, session.id, session);

  const baseName = (session.filename || "form.pdf").replace(/\.pdf$/i, "");
  // Heuristic: most onboarding/IRS/ACH forms need a signature. We default to
  // true for the demo so the drawer always shows the signature step. Future:
  // detect a Sig field in AcroForm, or have the agent set this in the session.
  const signatureRequired = true;
  return jsonResponse({
    filename: `${baseName}-filled.pdf`,
    pdf_base64: uint8ToBase64(filled.bytes),
    answered_count: Object.keys(session.answers).length,
    field_count: session.fields.length,
    written_count:
      Object.keys(session.answers).length - filled.intentionallySkipped.length,
    intentionally_skipped: filled.intentionallySkipped,
    skipped: filled.writeErrors,
    signature_required: signatureRequired,
    editable_fields: buildEditableFields(session),
  });
}
