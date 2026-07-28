// GET /api/oura  ->  recent Oura readiness/sleep/HRV/resting-HR.
// Gated behind the same signed login cookie as the Strava endpoints, so only a
// connected device (holding a valid stride_strava cookie) can read this data.
import crypto from "crypto";

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}
function authed(req) {
  const raw = parseCookies(req.headers.cookie).stride_strava;
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return false;
  const val = raw.slice(0, dot), sig = raw.slice(dot + 1);
  const expect = crypto.createHmac("sha256", process.env.COOKIE_SECRET).update(val).digest("hex");
  return !!sig && sig === expect;
}

export default async function handler(req, res) {
  if (!authed(req)) { res.status(401).json({ connected: false, error: "unauthorized" }); return; }
  const token = process.env.OURA_TOKEN;
  if (!token) { res.status(200).json({ connected: false }); return; }

  const fmt = (d) => d.toISOString().slice(0, 10);
  const end = new Date();
  const start = new Date(Date.now() - 30 * 86400000);
  const q = "?start_date=" + fmt(start) + "&end_date=" + fmt(end);
  const base = "https://api.ouraring.com/v2/usercollection/";
  const h = { Authorization: "Bearer " + token };

  try {
    const [rd, sl, sd] = await Promise.all([
      fetch(base + "daily_readiness" + q, { headers: h }).then((r) => r.json()),
      fetch(base + "daily_sleep" + q, { headers: h }).then((r) => r.json()),
      fetch(base + "sleep" + q, { headers: h }).then((r) => r.json()),
    ]);
    const byDay = {};
    (rd.data || []).forEach((x) => { byDay[x.day] = byDay[x.day] || {}; byDay[x.day].readiness = x.score; });
    (sl.data || []).forEach((x) => { byDay[x.day] = byDay[x.day] || {}; byDay[x.day].sleep = x.score; });
    (sd.data || []).forEach((x) => {
      const d = x.day; byDay[d] = byDay[d] || {};
      if (x.average_hrv != null) byDay[d].hrv = Math.round(x.average_hrv);
      if (x.lowest_heart_rate != null) byDay[d].rhr = x.lowest_heart_rate;
    });
    const days = Object.keys(byDay).sort().map((day) => Object.assign({ day: day }, byDay[day]));
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ connected: true, days });
  } catch (e) {
    res.status(200).json({ connected: false, error: "oura_error" });
  }
}
