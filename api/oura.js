// GET /api/oura  ->  returns recent daily readiness, sleep, HRV and resting HR from Oura.
// Uses a personal access token stored in the OURA_TOKEN env var. If no token is set,
// responds { connected: false } so the app simply hides the recovery card.
export default async function handler(req, res) {
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
