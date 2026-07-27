// GET /api/withings/callback?code=...  ->  exchanges the code for tokens and stores
// the refresh token in a signed HttpOnly cookie.
import crypto from "crypto";

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) { res.writeHead(302, { Location: "/?withings=0" }); res.end(); return; }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const redirectUri = `https://${host}/api/withings/callback`;
  try {
    const body = new URLSearchParams({
      action: "requesttoken",
      grant_type: "authorization_code",
      client_id: process.env.WITHINGS_CLIENT_ID,
      client_secret: process.env.WITHINGS_SECRET,
      code,
      redirect_uri: redirectUri,
    });
    const r = await fetch("https://wbsapi.withings.net/v2/oauth2", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const j = await r.json();
    const refresh = j && j.body && j.body.refresh_token;
    if (!refresh) { res.writeHead(302, { Location: "/?withings=0" }); res.end(); return; }
    const sig = crypto.createHmac("sha256", process.env.COOKIE_SECRET).update(refresh).digest("hex");
    res.setHeader("Set-Cookie",
      `stride_withings=${refresh}.${sig}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=31536000`);
    res.writeHead(302, { Location: "/?withings=1" });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: "/?withings=0" });
    res.end();
  }
}
