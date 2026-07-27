// POST /api/coach  { stats, question }
// Turns the app's computed stats into coaching prose via Claude, and answers questions.
// If ANTHROPIC_API_KEY isn't set, returns { ok:false } so the app falls back to its
// on-device rules engine.
const SYSTEM = [
  "You are Stride, a precise and encouraging running & fitness coach.",
  "You are given the athlete's real training data as JSON. Use ONLY the numbers provided — never invent figures.",
  "Be specific and reference the real numbers. Keep a normal read to 3–5 sentences.",
  "The athlete also does F45 group classes (in the data as 'f45' / 'workouts'); these are high-intensity and count toward training load and recovery cost, even though they have no pace or distance.",
  "If a question is asked, answer it directly and practically using the data. If there is no question, give a short read of their current training and ONE thing to focus on.",
  "Write plain prose — no markdown headers, no bullet lists.",
].join(" ");

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false, reason: "method" }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ ok: false, reason: "no_key" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const stats = (body && body.stats) || {};
  const question = (body && body.question) || "";

  const userContent = "DATA:\n" + JSON.stringify(stats) +
    (question ? "\n\nQUESTION: " + question : "\n\nGive today's coaching read.");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    const j = await r.json();
    if (j && j.content && j.content[0] && j.content[0].text) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ok: true, text: j.content[0].text });
    } else {
      res.status(200).json({ ok: false, reason: "api_error", detail: j });
    }
  } catch (e) {
    res.status(200).json({ ok: false, reason: "server_error" });
  }
}
