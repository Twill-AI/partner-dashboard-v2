// POST /api/agent/chat — free-text turn for the Agent Desk demo chat.
// Grounded in the session state the page sends; falls back client-side if this errors.
//
// Body: {
//   token?: string,                     // must match env.DEMO_CHAT_TOKEN when that is set
//   sessionType: "uw" | "deployment",
//   merchant: object,                   // application summary as shown on the Session Board
//   board: object,                      // current rail state: checks, pends, comms, docs, steps
//   transcript: [{ role: "agent"|"user"|"system", text: string }],  // trimmed session log
//   message: string                     // the user's free-text input
// }
// Returns: { text: string }

const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 400;
const MAX_TRANSCRIPT = 30;

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function systemPrompt(sessionType, merchant, board) {
  const role =
    sessionType === "deployment"
      ? "You are Twill's deployment agent working this merchant's equipment fulfillment session."
      : "You are Twill's underwriting assistant working this merchant's review session.";
  return [
    role,
    "This is a live product demo. Answer ONLY from the session data below — never invent merchants, numbers, vendor results, or policies. If the data doesn't contain the answer, say so in one short sentence and steer back to the next best action.",
    "Style: competent and terse, 1–3 short sentences, no emoji, no exclamation marks. You may reference the on-screen action chips (Approve, Pend, Message partner, Ask the team) when relevant.",
    "You never take actions yourself — actions happen through the buttons. The human decides.",
    "",
    "SESSION DATA:",
    "Merchant: " + JSON.stringify(merchant).slice(0, 4000),
    "Board: " + JSON.stringify(board).slice(0, 6000),
  ].join("\n");
}

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY not configured." }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }
  if (env.DEMO_CHAT_TOKEN && body.token !== env.DEMO_CHAT_TOKEN) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }
  const message = (body.message || "").toString().slice(0, 2000).trim();
  if (!message) return jsonResponse({ error: "Empty message." }, 400);

  const transcript = Array.isArray(body.transcript) ? body.transcript.slice(-MAX_TRANSCRIPT) : [];
  const messages = transcript
    .filter((t) => t && t.text)
    .map((t) => ({
      role: t.role === "user" ? "user" : "assistant",
      content: String(t.text).slice(0, 1500),
    }));
  // Anthropic requires alternating-ish sanity; collapse consecutive same-role turns.
  const collapsed = [];
  for (const m of messages) {
    const last = collapsed[collapsed.length - 1];
    if (last && last.role === m.role) last.content += "\n" + m.content;
    else collapsed.push({ ...m });
  }
  if (!collapsed.length || collapsed[collapsed.length - 1].role === "user") {
    // ensure the new user message is the final turn without doubling
  }
  collapsed.push({ role: "user", content: message });

  const payload = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0.4,
    system: systemPrompt(body.sessionType, body.merchant || {}, body.board || {}),
    messages: collapsed,
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return jsonResponse({ error: "Upstream error " + res.status }, 502);
    }
    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) return jsonResponse({ error: "Empty completion." }, 502);
    return jsonResponse({ text });
  } catch (e) {
    return jsonResponse({ error: "Request failed." }, 502);
  }
}
