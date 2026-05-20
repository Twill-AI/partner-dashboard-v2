import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  base64ToUint8,
  buildEditableFields,
  errorResponse,
  fillPdfFromSession,
  jsonResponse,
  loadSession,
  saveSession,
  uint8ToBase64,
} from "../_lib.js";

// POST /api/forms/:id/sign
// Body: { signature_png_base64: "...", signer_name: "Acme...", signed_date?: "MM/DD/YYYY" }
// Re-fills the PDF (un-flattened), stamps the signature PNG + typed name +
// date near the bottom of the LAST page, then flattens. Returns the signed
// PDF as base64. Heuristic placement — for a real form-specific demo we'd
// detect signature-line coordinates per template.
export async function onRequestPost({ request, env, params }) {
  const session = await loadSession(env, params.id);
  if (!session) return errorResponse("Session not found.", 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Expected JSON body.");
  }
  const sigB64 = body && body.signature_png_base64;
  const signerName = (body && body.signer_name) || "(unsigned)";
  const signedDate =
    (body && body.signed_date) || new Date().toLocaleDateString("en-US");
  if (!sigB64) return errorResponse("Missing 'signature_png_base64'.");

  const pdfBytes = await env.FORM_SESSIONS.get(`${params.id}:pdf`, "arrayBuffer");
  if (!pdfBytes) {
    return errorResponse("Original PDF bytes missing — session may have expired.", 410);
  }

  // 1. Re-fill the form WITHOUT flattening so we can still stamp/draw onto
  //    the page surface easily, then flatten at the end.
  let filled;
  try {
    filled = await fillPdfFromSession({
      PDFDocument,
      pdfBytes,
      session,
      flatten: false,
    });
  } catch (err) {
    return errorResponse(`Failed to re-fill PDF before stamping: ${err.message}`, 500);
  }

  // 2. Stamp signature image + typed name + date onto the last page.
  let signedBytes;
  try {
    const pdfDoc = await PDFDocument.load(filled.bytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width, height } = lastPage.getSize();

    // Decode the PNG dataURL → bytes
    const pngBase64Clean = sigB64.replace(/^data:image\/png;base64,/, "");
    const pngBytes = base64ToUint8(pngBase64Clean);
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // Heuristic placement: signature box near the bottom-left of the last
    // page. Sized to fit ~180x50 pt. Tweak per form if needed.
    const sigBoxW = 180;
    const sigBoxH = 50;
    const sigX = 60;
    const sigY = 110; // pts from bottom of page
    // Scale image to fit inside the box preserving aspect ratio
    const scale = Math.min(sigBoxW / pngImage.width, sigBoxH / pngImage.height);
    const drawW = pngImage.width * scale;
    const drawH = pngImage.height * scale;
    lastPage.drawImage(pngImage, {
      x: sigX + (sigBoxW - drawW) / 2,
      y: sigY + (sigBoxH - drawH) / 2,
      width: drawW,
      height: drawH,
    });

    // Typed name + date in light text below the signature image
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    lastPage.drawText(`Signed by: ${signerName}`, {
      x: sigX,
      y: sigY - 14,
      size: 9,
      font: helv,
      color: rgb(0.1, 0.1, 0.2),
    });
    lastPage.drawText(`Date: ${signedDate}`, {
      x: sigX,
      y: sigY - 28,
      size: 9,
      font: helv,
      color: rgb(0.1, 0.1, 0.2),
    });

    // Flatten AcroForm so the filled values are baked in alongside our stamps
    try {
      pdfDoc.getForm().flatten();
    } catch {
      /* form may be empty after flatten; ignore */
    }

    signedBytes = await pdfDoc.save();

    // Suppress unused-import warning for width/height — we keep them around
    // in case a future iteration wants right-aligned placement.
    void width;
    void height;
  } catch (err) {
    return errorResponse(`Failed to stamp signature: ${err.message}`, 500);
  }

  // Persist signing metadata for the partner-side timeline / audit.
  session.signed = true;
  session.signed_at = new Date().toISOString();
  session.signed_by = signerName;
  session.signed_date = signedDate;
  await saveSession(env, session.id, session);

  const baseName = (session.filename || "form.pdf").replace(/\.pdf$/i, "");
  return jsonResponse({
    filename: `${baseName}-signed.pdf`,
    pdf_base64: uint8ToBase64(signedBytes),
    signed_by: signerName,
    signed_date: signedDate,
    written_count:
      Object.keys(session.answers).length - filled.intentionallySkipped.length,
    field_count: session.fields.length,
    intentionally_skipped: filled.intentionallySkipped,
    editable_fields: buildEditableFields(session),
  });
}
