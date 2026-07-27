// GET /api/withings/login  ->  sends you to Withings to approve access.
export default function handler(req, res) {
  const clientId = process.env.WITHINGS_CLIENT_ID;
  if (!clientId) { res.status(500).send("Missing WITHINGS_CLIENT_ID env var"); return; }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const redirectUri = `https://${host}/api/withings/callback`;
  const url =
    "https://account.withings.com/oauth2_user/authorize2" +
    "?response_type=code" +
    `&client_id=${clientId}` +
    "&scope=user.metrics" +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&state=stride";
  res.writeHead(302, { Location: url });
  res.end();
}
