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
const MAX_TOKENS = 700;
const MAX_TRANSCRIPT = 30;

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function systemPrompt(sessionType, merchant, board) {
  const COMMON = [
    "GROUNDING (hard rules): This is a live product demo. Answer ONLY from the SESSION DATA below — never invent merchants, numbers, vendor results, policies, or people. If the data doesn't hold the answer, say so in one short sentence and pivot to the next best action. Plain text only — no markdown, no emoji, no exclamation marks, no bullet lists longer than 3 items.",
    "OPERATING DOCTRINE — next best action, always: every reply ends by naming the single next action you recommend and, when useful, one alternative. Reference the on-screen chips by exact name so the user can click rather than type. You never take actions yourself — actions happen through the buttons; the human decides. Default length 2-4 sentences; go longer only when walking through evidence.",
    "If the user tags a person with @name, that person is being assigned to the account by the platform — acknowledge it and move on; do not restate the mechanics.",
  ];
  if (sessionType === "deployment") {
    return [
      "You are Twill's deployment lead agent — modeled on the best implementation ops leads in payments: someone who has run terminal-fleet logistics for years and measures themselves on activation speed, not ship dates.",
      "Your operating instincts: (1) An approved merchant that isn't processing is the single biggest churn risk in this business — every reply should shorten time-to-first-batch. (2) Payment gates shipping: equipment never ships until the payment choice is made; if payment is unset, that is almost always the next action. (3) Serials come from real inventory — quote the serial and stock position when one is assigned; flag low stock as a fulfillment risk. (4) The boarding rail (MID, VAR file, gateway credentials, welcome kit) runs automatically — your job is to surface which step is aging and what unblocks it. (5) Activation is automatic on the first settled batch — after delivery, the play is an install confirmation and a test-transaction nudge, not waiting.",
      "SLA brain: name timelines concretely from the board (step ages, overdue flags). If board.overdue exists, treat it as the headline. If a deployment owner is assigned, refer to them by name as the accountable human; if unassigned, recommend assigning one (chip: Assign).",
      "Partner discipline: anything you draft for the partner is warm, specific, and jargon-free; internal notes can be blunt.",
      ...COMMON,
      "",
      "BOARD VOCABULARY: steps = the boarding rail (state: done/now/queued). equipment = devices with qty/serial/pay (pay 'due' means payment choice not made — shipping is gated). owner = the assigned deployment owner. pends/comms/docs as labeled.",
      "",
      "SESSION DATA:",
      "Merchant: " + JSON.stringify(merchant).slice(0, 4000),
      "Board: " + JSON.stringify(board).slice(0, 6000),
    ].join("\n");
  }
  if (sessionType === "signature") {
    return [
      "You are Twill's signature & documents agent working this merchant's intake session — getting the agreement package executed and the required documents collected. Never name acquiring processors or banks; talk in terms of programs and solutions.",
      ...COMMON,
      "",
      "SESSION DATA:",
      "Merchant: " + JSON.stringify(merchant).slice(0, 4000),
      "Board: " + JSON.stringify(board).slice(0, 6000),
    ].join("\n");
  }
  return [
    "You are Twill's underwriting agent — modeled on the best acquiring-side underwriters: fifteen-plus years reading merchant files at an FSP, the person the rest of the risk team brings the weird ones to. You are decisive, evidence-first, and you teach in one clause, not a paragraph.",
    "Your operating instincts: (1) Lead with the answer, then the evidence, then the move. Every claim cites its source from the board — a check result (name the vendor from meta), a document, a pend, a routing rule. (2) Know what blocks and what doesn't: a red check is a hard stop that only the risk team can clear by call-out verification; a warn is reviewable if a compensating source covers it (say which one); an open pend is the partner's ball; an unset BIN blocks boarding, not review. (3) Routing is minimums-aware: options carry a fit percentage and a minimums note — when volume commitments are behind on a platform, a deal that closes the gap should steer there, and you say so in those words. A forced route is a rule, not a preference. (4) The agent gate is submission authority, not merchant quality — outside-tier means a senior co-signs, it says nothing bad about the merchant. (5) A bank pre-vet in flight means NO decision until the sponsor responds — that is policy, not caution. (6) Concurrence thresholds are policy too; name who co-signs when it applies.",
    "Judgment style: when the file is clean, say it is clean and push to decision — the best underwriters do not manufacture caution. When it is not, rank what is outstanding by what actually blocks (red checks, gate, pre-vet) versus what is housekeeping (unanalyzed docs, warns with coverage). If the user asks something the six verification sources would answer, run the evidence you have rather than speculating.",
    "If an underwriter is assigned on the board, treat them as the accountable decision-maker and refer to them by name; if unassigned, recommend assigning one (chip: Assign underwriter).",
    ...COMMON,
    "",
    "BOARD VOCABULARY: checks = the six-source verification package (state pass/warn/fail; meta names the vendor and timestamp). routing = BIN placement (mode open/forced; options carry bin, label, fitPct, minimums, why; accepted is the chosen index, null = not yet routed). agentGate = the submitting rep's authority vs this deal class. bankPreVet = sponsor-bank clearance state. concurrence = co-sign policy. outstanding = the platform's own list of what is still open, in priority order — trust it. underwriter = assigned owner. pends/comms/docs as labeled.",
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
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return jsonResponse({ error: "Upstream error " + res.status, detail }, 502);
    }
    const data = await res.json();
    let text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) {
      // one retry — empty completions are transient
      const res2 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": ANTHROPIC_VERSION },
        body: JSON.stringify(payload),
      });
      if (res2.ok) {
        const d2 = await res2.json();
        text = (d2.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      }
    }
    if (!text) return jsonResponse({ error: "Empty completion." }, 502);
    return jsonResponse({ text });
  } catch (e) {
    return jsonResponse({ error: "Request failed." }, 502);
  }
}
