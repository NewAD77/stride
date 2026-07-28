// POST /api/nutrition  { text?, imageB64?, mime? }
// Estimates nutrition from a food photo and/or a text description (incl. recipes),
// via Claude vision. Auth-gated by the signed login cookie. Returns strict JSON.
import crypto from "crypto";

const SYSTEM =
  "You are a precise nutrition estimator. You receive a food photo and/or a text " +
  "description (which may be a recipe with ingredients and quantities). Identify the " +
  "item and estimate its nutrition for the whole portion described; if it's a recipe, " +
  "sum the ingredients. Respond with ONLY a JSON object and nothing else, in exactly " +
  'this shape: {"name":string,"portion":string,"calories":number,"protein":number,' +
  '"carbs":number,"fat":number,"confidence":"low"|"medium"|"high","note":string}. ' +
  "calories are kcal; protein/carbs/fat are grams. Be realistic; if unsure, estimate and lower confidence.";

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
function authed(req) {
  const raw = parseCookies(req.headers.cookie).stride_strava;
  if (!raw) return false;
  const dot = raw.lastIndexOf("."); if (dot < 1) return false;
  const val = raw.slice(0, dot), sig = raw.slice(dot + 1);
  const expect = crypto.createHmac("sha256", process.env.COOKIE_SECRET).update(val).digest("hex");
  return !!sig && sig === expect;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ ok: false }); return; }
  if (!authed(req)) { res.status(401).json({ ok: false, reason: "unauthorized" }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ ok: false, reason: "no_key" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const text = String((body && body.text) || "").slice(0, 1200);
  const imageB64 = body && body.imageB64;
  const mime = (body && body.mime) || "image/jpeg";
  if (!text && !imageB64) { res.status(200).json({ ok: false, reason: "empty" }); return; }

  const content = [];
  if (imageB64) content.push({ type: "image", source: { type: "base64", media_type: mime, data: imageB64 } });
  content.push({ type: "text", text: (imageB64 ? "Estimate the nutrition of the food shown." : "Estimate the nutrition of this food.") + (text ? " Description: " + text : "") });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 400, system: SYSTEM, messages: [{ role: "user", content }] }),
    });
    const j = await r.json();
    const txt = j && j.content && j.content[0] && j.content[0].text;
    if (!txt) { res.status(200).json({ ok: false, reason: "api_error" }); return; }
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) { res.status(200).json({ ok: false, reason: "parse", raw: txt }); return; }
    const item = JSON.parse(m[0]);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, item });
  } catch (e) {
    res.status(200).json({ ok: false, reason: "server_error" });
  }
}
