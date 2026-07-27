// GET /api/strava/login  sends you to Strava to approve access, then back to callback
export default function handler(req, res) {
const clientId = process.env.STRAVA_CLIENT_ID;
if (!clientId) { res.status(500).send("Missing STRAVA_CLIENT_ID env var"); return; }
const host = req.headers["x-forwarded-host"] || req.headers.host;
const redirectUri = `https://${host}/api/strava/callback`;
const url = "https://www.strava.com/oauth/authorize?client_id=" + clientId + "&response_type=code&redirect_uri=" + encodeURIComponent(redirectUri) + "&approval_prompt=auto&scope=activity:read_all,read";
res.writeHead(302, { Location: url });
res.end();
}
