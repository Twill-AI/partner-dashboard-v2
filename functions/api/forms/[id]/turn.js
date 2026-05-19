import {
  ANTHROPIC_BETA,
  ANTHROPIC_VERSION,
  ANTHROPIC_MODEL,
  TOOLS,
  errorResponse,
  jsonResponse,
  loadSession,
  saveSession,
  systemPrompt,
} from "../_lib.js";

// POST /api/forms/:id/turn
// Body: { message?: string }   // omit on the first call to let Claude open
// Returns:
//   { assistant_text: string, finalize: boolean, answers: {field:value, ...}, field_count, answered_count }
//
// On the first call (empty conversation), we inject the PDF as a `document` block
// referencing the previously-uploaded file_id so the bytes are not re-sent.
export async function onRequestPost({ request, env, params }) {
  if (!env.ANTHROPIC_API_KEY) {
    return errorResponse("ANTHROPIC_API_KEY not configured.", 500);
  }
  const session = await loadSession(env, params.id);
  if (!session) return errorResponse("Session not found.", 404);
  if (session.finalized) {
    return errorResponse("This form session has already been finalized.", 409);
  }

  const body = await safeJson(request);
  const userMessage = body?.message?.trim() || "";

  // Build the user-turn content. On the first turn we attach the document; on
  // every turn after that we just send the user's text.
  const userContent = [];
  if (session.conversation.length === 0) {
    userContent.push({
      type: "document",
      source: { type: "file", file_id: session.file_id },
    });
    userContent.push({
      type: "text",
      text:
        userMessage ||
        "Please walk me through this form one field at a time. Start with the first field.",
    });
  } else {
    if (!userMessage) {
      return errorResponse("Missing 'message' in body.");
    }
    userContent.push({ type: "text", text: userMessage });
  }

  session.conversation.push({ role: "user", content: userContent });

  // Run the tool-use loop until Claude either:
  //   - returns a normal text turn (assistant asks the user a question), OR
  //   - calls finalize_form (we hand the UI a "ready to download" signal).
  // Within a single HTTP turn we may go through several record_answer tool
  // calls before Claude pauses for the user — that's fine, we just loop here.
  const MAX_HOPS = 16;
  let finalize = false;
  let assistantText = "";

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-beta": ANTHROPIC_BETA,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: systemPrompt(session),
        tools: TOOLS,
        messages: session.conversation,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      await saveSession(env, session.id, session); // persist the user turn even on failure
      return errorResponse(
        `Anthropic messages call failed (${resp.status}): ${detail}`,
        502,
      );
    }

    const reply = await resp.json();
    session.conversation.push({ role: "assistant", content: reply.content });

    // Collect any text the assistant emitted in this hop — usually it's the
    // next question, or a confirmation before/after a tool call.
    const textBlocks = (reply.content || []).filter((b) => b.type === "text");
    if (textBlocks.length) {
      assistantText = textBlocks.map((b) => b.text).join("\n").trim();
    }

    if (reply.stop_reason !== "tool_use") {
      // Plain text turn — hand back to the user.
      break;
    }

    // Execute every tool_use block, append a single user message of tool_results,
    // then loop so Claude can continue.
    const toolUses = (reply.content || []).filter((b) => b.type === "tool_use");
    const toolResults = [];
    for (const tu of toolUses) {
      if (tu.name === "record_answer") {
        const { field, value } = tu.input || {};
        if (!field) {
          toolResults.push(toolErr(tu.id, "Missing 'field'."));
          continue;
        }
        // Validate against schema — keeps Claude honest if it invents a field
        // or overflows a max_length constraint.
        const schema = session.fields.find((f) => f.name === field);
        if (!schema) {
          toolResults.push(
            toolErr(
              tu.id,
              `Unknown field '${field}'. Use one of the exact names from the schema.`,
            ),
          );
          continue;
        }
        const stringVal = value == null ? "" : String(value);
        if (
          schema.max_length &&
          stringVal.length > schema.max_length &&
          schema.type === "PDFTextField"
        ) {
          toolResults.push(
            toolErr(
              tu.id,
              `Value '${stringVal}' is ${stringVal.length} chars but field '${field}' has max_length=${schema.max_length}. Split the value across the adjacent field(s) or ask the user for a shorter answer.`,
            ),
          );
          continue;
        }
        session.answers[field] = stringVal;
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Recorded. ${Object.keys(session.answers).length}/${session.fields.length} fields filled.`,
        });
      } else if (tu.name === "finalize_form") {
        const missing = session.fields
          .filter((f) => !(f.name in session.answers))
          .map((f) => f.name);
        if (missing.length > 0) {
          toolResults.push(
            toolErr(
              tu.id,
              `Cannot finalize — ${missing.length} field(s) still missing: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}. Keep asking the user.`,
            ),
          );
        } else {
          finalize = true;
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content:
              "All fields collected. The UI will now call /finalize to fill and download the PDF.",
          });
        }
      } else {
        toolResults.push(toolErr(tu.id, `Unknown tool '${tu.name}'.`));
      }
    }

    session.conversation.push({ role: "user", content: toolResults });

    if (finalize) {
      // One more hop so Claude can produce a "done!" closing message; or break.
      // We break here — the UI shows its own download chip — simpler & cheaper.
      break;
    }
  }

  await saveSession(env, session.id, session);

  return jsonResponse({
    assistant_text: assistantText,
    finalize,
    answers: session.answers,
    field_count: session.fields.length,
    answered_count: Object.keys(session.answers).length,
  });
}

function toolErr(id, msg) {
  return { type: "tool_result", tool_use_id: id, content: msg, is_error: true };
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
