// GET /api/withings/measures  ->  refreshes the token (rotating it in the cookie) and
// returns recent weight / body-fat / muscle measurements.
import crypto from "crypto";

function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}

export default async function handler(req, res) {
  const raw = parseCookies(req.headers.cookie).stride_withings;
  if (!raw) { res.status(200).json({ connected: false }); return; }
  const dot = raw.lastIndexOf(".");
  const refresh = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expect = crypto.createHmac("sha256", process.env.COOKIE_SECRET).update(refresh).digest("hex");
  if (!sig || sig !== expect) { res.status(200).json({ connected: false }); return; }

  try {
    const tb = new URLSearchParams({
      action: "requesttoken",
      grant_type: "refresh_token",
      client_id: process.env.WITHINGS_CLIENT_ID,
      client_secret: process.env.WITHINGS_SECRET,
      refresh_token: refresh,
    });
    const tr = await fetch("https://wbsapi.withings.net/v2/oauth2", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tb,
    });
    const tj = await tr.json();
    const access = tj && tj.body && tj.body.access_token;
    if (!access) { res.status(200).json({ connected: false }); return; }

    // Withings rotates the refresh token — persist the new one back into the cookie.
    const newRefresh = (tj.body.refresh_token) || refresh;
    const nsig = crypto.createHmac("sha256", process.env.COOKIE_SECRET).update(newRefresh).digest("hex");
    res.setHeader("Set-Cookie",
      `stride_withings=${newRefresh}.${nsig}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=31536000`);

    const mb = new URLSearchParams({ action: "getmeas", meastypes: "1,6,8,76", category: "1" });
    const mr = await fetch("https://wbsapi.withings.net/measure", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: "Bearer " + access },
      body: mb,
    });
    const mj = await mr.json();
    const grps = (mj && mj.body && mj.body.measuregrps) || [];
    const series = grps.map((g) => {
      const o = { date: new Date(g.date * 1000).toISOString().slice(0, 10) };
      (g.measures || []).forEach((m) => {
        const v = m.value * Math.pow(10, m.unit);
        if (m.type === 1) o.weight = Math.round(v * 10) / 10;
        if (m.type === 6) o.fat = Math.round(v * 10) / 10;
        if (m.type === 8) o.fatmass = Math.round(v * 10) / 10;
        if (m.type === 76) o.muscle = Math.round(v * 10) / 10;
      });
      return o;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ connected: true, series });
  } catch (e) {
    res.status(200).json({ connected: false, error: "withings_error" });
  }
}
