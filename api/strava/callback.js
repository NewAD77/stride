import crypto from "crypto";
export default async function handler(req, res) {
const { code, error } = req.query;
if (error || !code) { res.writeHead(302, { Location: "/?connected=0" }); res.end(); return; }
try {
const r = await fetch("https://www.strava.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, code, grant_type: "authorization_code" }) });
const data = await r.json();
const refresh = data.refresh_token;
if (!refresh) { res.writeHead(302, { Location: "/?connected=0" }); res.end(); return; }
const sig = crypto.createHmac("sha256", process.env.COOKIE_SECRET).update(refresh).digest("hex");
const value = `${refresh}.${sig}`;
res.setHeader("Set-Cookie", `stride_strava=${value}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=31536000`);
res.writeHead(302, { Location: "/?connected=1" });
res.end();
} catch (e) {
res.writeHead(302, { Location: "/?connected=0" });
res.end();
}
}
