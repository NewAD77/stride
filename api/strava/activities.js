import crypto from "crypto";
function parseCookies(header) {
const out = {};
(header || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
return out;
}
export default async function handler(req, res) {
const raw = parseCookies(req.headers.cookie).stride_strava;
if (!raw) { res.status(401).json({ error: "not_connected" }); return; }
const dot = raw.lastIndexOf(".");
const refresh = raw.slice(0, dot);
const sig = raw.slice(dot + 1);
const expect = crypto.createHmac("sha256", process.env.COOKIE_SECRET).update(refresh).digest("hex");
if (!sig || sig !== expect) { res.status(401).json({ error: "bad_cookie" }); return; }
try {
const tr = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: refresh }) });
const t = await tr.json();
if (!t.access_token) { res.status(401).json({ error: "refresh_failed" }); return; }
const ar = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=100", { headers: { Authorization: "Bearer " + t.access_token } });
const acts = await ar.json();
if (!Array.isArray(acts)) { res.status(502).json({ error: "strava_error", detail: acts }); return; }
const runs = acts.filter((a) => a.type === "Run" && a.distance > 0).map((a) => ({ d: (a.start_date_local || "").slice(0, 10), m: a.distance, t: a.moving_time, mps: a.average_speed, c: a.average_cadence ? Math.round(a.average_cadence) : 0, e: a.suffer_score || 0, el: a.total_elevation_gain || 0, g: !!(a.map && a.map.summary_polyline && a.map.summary_polyline.length > 1) || (Array.isArray(a.start_latlng) && a.start_latlng.length === 2) }));
res.setHeader("Cache-Control", "no-store");
res.status(200).json({ runs });
} catch (e) {
res.status(500).json({ error: "server_error" });
}
}
