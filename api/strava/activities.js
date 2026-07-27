import crypto from "crypto";

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}

async function fetchWeather(lat, lon, date) {
  try {
    const u = "https://archive-api.open-meteo.com/v1/archive?latitude=" + lat +
      "&longitude=" + lon + "&start_date=" + date + "&end_date=" + date +
      "&daily=temperature_2m_mean,temperature_2m_max,wind_speed_10m_max,precipitation_sum&timezone=auto";
    const r = await fetch(u);
    const j = await r.json();
    const d = j && j.daily;
    if (!d || !d.time || !d.time.length) return null;
    return {
      t: d.temperature_2m_mean ? d.temperature_2m_mean[0] : null,
      tmax: d.temperature_2m_max ? d.temperature_2m_max[0] : null,
      wind: d.wind_speed_10m_max ? d.wind_speed_10m_max[0] : null,
      precip: d.precipitation_sum ? d.precipitation_sum[0] : null,
    };
  } catch (e) { return null; }
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

    const runs = acts.filter((a) => a.type === "Run" && a.distance > 0).map((a) => ({
      d: (a.start_date_local || "").slice(0, 10), m: a.distance, t: a.moving_time, mps: a.average_speed,
      c: a.average_cadence ? Math.round(a.average_cadence) : 0, e: a.suffer_score || 0, el: a.total_elevation_gain || 0,
      hr: a.average_heartrate ? Math.round(a.average_heartrate) : null, hrmax: a.max_heartrate ? Math.round(a.max_heartrate) : null,
      g: !!(a.map && a.map.summary_polyline && a.map.summary_polyline.length > 1) || (Array.isArray(a.start_latlng) && a.start_latlng.length === 2),
      ll: Array.isArray(a.start_latlng) && a.start_latlng.length === 2 ? a.start_latlng : null,
    }));

    // F45 / cross-training: any non-run/walk/hike session of 10+ minutes (the user logs F45 as "Workout"/"cardio")
    const skip = { Run: 1, Walk: 1, Hike: 1 };
    const workouts = acts.filter((a) => !skip[a.type] && (a.moving_time || 0) >= 600).map((a) => ({
      d: (a.start_date_local || "").slice(0, 10), t: a.moving_time, e: a.suffer_score || 0,
      hr: a.average_heartrate ? Math.round(a.average_heartrate) : null, hrmax: a.max_heartrate ? Math.round(a.max_heartrate) : null,
      name: a.name || "", type: a.type || "Workout",
    }));

    const recent = runs.slice(0, 14);
    await Promise.all(recent.map(async (r) => { if (r.ll) { const w = await fetchWeather(r.ll[0], r.ll[1], r.d); if (w) r.wx = w; } }));

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ runs, workouts });
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
}
