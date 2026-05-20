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

  // Defensive: if a prior turn ended with orphan tool_use blocks (e.g. the
  // assistant message hit max_tokens mid-generation and we didn't push
  // tool_results), Anthropic will reject the next request. Repair before
  // sending the new user turn.
  repairOrphanToolUse(session);

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
        // 4096 is plenty for chat turns; a single message of 10+ record_answer
        // tool_use blocks against IRS-style long field names can blow past
        // 1024 and truncate mid-block, which leaves orphan tool_use ids and
        // corrupts the conversation.
        max_tokens: 4096,
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

    // Process tool_use blocks WHENEVER they appear, regardless of stop_reason.
    // If stop_reason is 'max_tokens' (truncation) but Claude still emitted some
    // tool_use blocks, we need to either honor them with tool_results or strip
    // them — otherwise Anthropic rejects the next turn with "tool_use ids were
    // found without tool_result blocks immediately after".
    const toolUses = (reply.content || []).filter((b) => b.type === "tool_use");

    if (toolUses.length === 0) {
      // No tools — plain text turn, hand back to the user.
      break;
    }

    if (reply.stop_reason === "max_tokens") {
      // Truncation: the LAST tool_use may be malformed. Be conservative — strip
      // all tool_use blocks from the assistant message so we don't have to
      // guess which ones are complete, then tell the user to retry.
      const cleaned = (reply.content || []).filter((b) => b.type !== "tool_use");
      session.conversation[session.conversation.length - 1] = {
        role: "assistant",
        content: cleaned.length ? cleaned : [{ type: "text", text: "(response truncated)" }],
      };
      await saveSession(env, session.id, session);
      return jsonResponse({
        assistant_text:
          (assistantText ? assistantText + "\n\n" : "") +
          "(I generated too many tool calls in one shot and hit a length limit. Please rephrase your last answer or try again.)",
        finalize: false,
        answers: session.answers,
        field_count: session.fields.length,
        answered_count: Object.keys(session.answers).length,
        truncated: true,
      });
    }

    // Execute every tool_use block, append a single user message of tool_results,
    // then loop so Claude can continue.
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

// Scan the conversation for any assistant message with tool_use blocks that
// AREN'T immediately followed by a user message containing matching tool_result
// blocks for every tool_use_id. This corruption can happen when a prior turn
// was truncated (max_tokens), errored mid-loop, or saved a new user message
// after an orphan was already in place.
//
// Strategy when corruption is found: strip the orphan tool_use blocks from
// that assistant message AND truncate everything after it (those later
// messages were built on a state Anthropic now rejects). If the cleaned
// assistant message would be empty, drop it entirely. The next live turn will
// re-prompt from a clean point.
function repairOrphanToolUse(session) {
  const convo = session.conversation;
  if (!convo || convo.length === 0) return;

  for (let i = 0; i < convo.length; i++) {
    const msg = convo[i];
    if (!msg || msg.role !== "assistant") continue;

    const toolUseIds = (msg.content || [])
      .filter((b) => b.type === "tool_use")
      .map((b) => b.id);
    if (toolUseIds.length === 0) continue;

    const next = convo[i + 1];
    const nextResultIds = new Set(
      next && next.role === "user"
        ? (next.content || [])
            .filter((b) => b.type === "tool_result")
            .map((b) => b.tool_use_id)
        : [],
    );
    const orphaned = toolUseIds.filter((id) => !nextResultIds.has(id));
    if (orphaned.length === 0) continue;

    // Corruption found at message i. Strip the tool_use blocks from this
    // message and truncate everything that came after.
    const kept = (msg.content || []).filter((b) => b.type !== "tool_use");
    if (kept.length === 0) {
      convo.splice(i); // drop this and everything after
    } else {
      msg.content = kept;
      convo.splice(i + 1); // keep the cleaned message; drop everything after
    }
    return; // one repair per pass — earliest orphan is the real cause
  }
}
