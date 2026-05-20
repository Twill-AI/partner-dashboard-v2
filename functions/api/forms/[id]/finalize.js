import { PDFDocument } from "pdf-lib";
import {
  errorResponse,
  jsonResponse,
  loadSession,
  saveSession,
} from "../_lib.js";

// POST /api/forms/:id/finalize
// Returns: { filename, pdf_base64, answered_count, field_count, skipped: [{name, value, reason}] }
//
// Loads the stored PDF bytes from KV, applies session.answers via pdf-lib,
// returns the filled PDF as base64. The browser triggers the download.
export async function onRequestPost({ env, params }) {
  const session = await loadSession(env, params.id);
  if (!session) return errorResponse("Session not found.", 404);

  const pdfBytes = await env.FORM_SESSIONS.get(`${params.id}:pdf`, "arrayBuffer");
  if (!pdfBytes) {
    return errorResponse("Original PDF bytes missing — session may have expired.", 410);
  }

  let pdfDoc, form;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes);
    form = pdfDoc.getForm();
  } catch (err) {
    return errorResponse(`Failed to reopen PDF: ${err.message}`, 500);
  }

  const skipped = [];
  const intentionallySkipped = [];
  for (const fieldSpec of session.fields) {
    const value = session.answers[fieldSpec.name];
    if (value === undefined) continue; // unanswered — leave blank

    // Skip sentinel from skip_field tool: don't touch the PDF, but track it.
    if (value && typeof value === "object" && value.__skip__) {
      intentionallySkipped.push({ name: fieldSpec.name, reason: value.reason });
      continue;
    }

    const field = form.getFieldMaybe
      ? form.getFieldMaybe(fieldSpec.name)
      : tryGetField(form, fieldSpec.name);
    if (!field) {
      skipped.push({ name: fieldSpec.name, value, reason: "field not found at fill time" });
      continue;
    }

    try {
      switch (fieldSpec.type) {
        case "PDFTextField":
          field.setText(String(value));
          break;
        case "PDFCheckBox":
          if (isTruthy(value)) field.check();
          else field.uncheck();
          break;
        case "PDFDropdown":
        case "PDFOptionList":
          field.select(String(value));
          break;
        case "PDFRadioGroup":
          field.select(String(value));
          break;
        default:
          // Best-effort: try setText.
          if (typeof field.setText === "function") field.setText(String(value));
          else skipped.push({ name: fieldSpec.name, value, reason: `unsupported type ${fieldSpec.type}` });
      }
    } catch (err) {
      skipped.push({ name: fieldSpec.name, value, reason: err.message });
    }
  }

  // Flatten so the filled values render in any PDF viewer (and the user can't
  // accidentally edit them after the fact).
  try {
    form.flatten();
  } catch (err) {
    // Flatten can fail on exotic field types — ship un-flattened in that case.
    skipped.push({ name: "(flatten)", value: "", reason: err.message });
  }

  const outBytes = await pdfDoc.save();
  const b64 = uint8ToBase64(outBytes);

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
    pdf_base64: b64,
    answered_count: Object.keys(session.answers).length,
    field_count: session.fields.length,
    written_count:
      Object.keys(session.answers).length - intentionallySkipped.length,
    intentionally_skipped: intentionallySkipped,
    skipped,
    signature_required: signatureRequired,
  });
}

function isTruthy(v) {
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "checked";
}

function tryGetField(form, name) {
  try {
    return form.getField(name);
  } catch {
    return null;
  }
}

function uint8ToBase64(bytes) {
  // Workers global btoa handles Latin-1 strings; chunk to avoid call-stack limit.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk),
    );
  }
  return btoa(binary);
}
