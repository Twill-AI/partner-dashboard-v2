import { PDFDocument } from "pdf-lib";
import {
  ANTHROPIC_BETA,
  ANTHROPIC_VERSION,
  errorResponse,
  jsonResponse,
  saveSession,
} from "./_lib.js";

// POST /api/forms/upload
// Body: multipart form-data with "file" = PDF
// Returns: { session_id, file_id, filename, fields:[{name,type,required,options?}] }
export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) {
    return errorResponse(
      "ANTHROPIC_API_KEY is not configured. Add it to .dev.vars locally or to CF Pages env vars in prod.",
      500,
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Expected multipart form-data body.");
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return errorResponse('Missing "file" field in form-data.');
  }
  if (file.type && file.type !== "application/pdf") {
    return errorResponse(`Expected application/pdf, got ${file.type}.`);
  }

  const pdfBytes = new Uint8Array(await file.arrayBuffer());

  // 1. Parse AcroForm fields with pdf-lib.
  let fields;
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const formObj = pdfDoc.getForm();
    fields = formObj.getFields().map((f) => {
      const type = f.constructor.name; // PDFTextField | PDFCheckBox | PDFDropdown | PDFRadioGroup | PDFOptionList
      const out = { name: f.getName(), type, required: false };
      // maxLength matters a lot — IRS/government forms often split values
      // (e.g. EINs) across multiple text fields with strict per-field caps.
      if (typeof f.getMaxLength === "function") {
        try {
          const ml = f.getMaxLength();
          if (typeof ml === "number" && ml > 0) out.max_length = ml;
        } catch {
          /* ignore */
        }
      }
      if (typeof f.getOptions === "function") {
        try {
          out.options = f.getOptions();
        } catch {
          /* ignore */
        }
      }
      return out;
    });
  } catch (err) {
    return errorResponse(`Failed to parse PDF: ${err.message}`);
  }

  if (fields.length === 0) {
    return errorResponse(
      "This PDF has no AcroForm fields. V1 only supports fillable PDFs.",
    );
  }

  // 2. Upload PDF to Anthropic Files API (one time — we'll reference by file_id from then on).
  const uploadForm = new FormData();
  uploadForm.append(
    "file",
    new Blob([pdfBytes], { type: "application/pdf" }),
    file.name || "form.pdf",
  );

  const uploadResp = await fetch("https://api.anthropic.com/v1/files", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": ANTHROPIC_BETA,
    },
    body: uploadForm,
  });

  if (!uploadResp.ok) {
    const detail = await uploadResp.text();
    return errorResponse(
      `Anthropic Files API upload failed (${uploadResp.status}): ${detail}`,
      502,
    );
  }
  const uploaded = await uploadResp.json();

  // 3. Create session and persist to KV. We store the raw PDF bytes under a
  // separate KV key (`${id}:pdf`) so the per-turn JSON load stays small. The
  // Anthropic Files API does not let us re-download uploaded files, so we keep
  // our own copy here for finalize() to fill and return.
  const sessionId = crypto.randomUUID();
  const session = {
    id: sessionId,
    file_id: uploaded.id,
    filename: file.name || uploaded.filename || "form.pdf",
    fields,
    answers: {},
    conversation: [], // array of {role, content} message objects passed to Claude
    finalized: false,
    created_at: new Date().toISOString(),
  };
  await Promise.all([
    saveSession(env, sessionId, session),
    env.FORM_SESSIONS.put(`${sessionId}:pdf`, pdfBytes, {
      expirationTtl: 60 * 60 * 24 * 7,
    }),
  ]);

  return jsonResponse({
    session_id: sessionId,
    file_id: uploaded.id,
    filename: session.filename,
    field_count: fields.length,
    fields,
  });
}
