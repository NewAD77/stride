# Stride

A personal, AI-native training app. It reads your Strava runs and F45 classes,
Oura recovery, Withings body composition, and per-run weather, and turns them into
plain-language coaching — including an "ask your coach" chat powered by Claude.

Live app: `https://stride-ruddy.vercel.app` (installable to the iPhone home screen).

---

## Architecture

```
iPhone (PWA, index.html)
  │  fetches /api/* on load; renders cards, charts, coach
  ▼
Vercel serverless functions (/api)
  │  hold secrets, talk to third parties, gate access with a signed cookie
  ├─ Strava  (OAuth + activities, incl. HR & F45 sessions)
  ├─ Oura    (personal token: readiness / sleep / HRV / RHR)
  ├─ Withings(OAuth: weight / body fat / muscle)
  ├─ Weather (Open-Meteo archive, no key)
  └─ Claude  (Anthropic API: the LLM coach)
```

- **Frontend** (`index.html`): a single-file PWA. No build step. Vanilla JS + Chart.js
  from CDN. Views are rendered by swapping `#content`; a service worker (`sw.js`) caches
  the shell (network-first) but never caches `/api/*`.
- **Backend** (`/api/*`): Vercel Node functions (ESM). Each holds its own third-party
  secret in an environment variable and returns only the fields the app needs.

## Endpoints

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/api/strava/login` | GET | Start Strava OAuth | — |
| `/api/strava/callback` | GET | Store Strava refresh token (signed cookie) | — |
| `/api/strava/activities` | GET | Runs (HR, cadence, GPS, weather) + F45 sessions | cookie |
| `/api/withings/login` `/callback` | GET | Withings OAuth | — |
| `/api/withings/measures` | GET | Weight / body-fat / muscle | cookie |
| `/api/oura` | GET | Readiness / sleep / HRV / RHR | cookie |
| `/api/coach` | POST | LLM coaching read + Q&A | cookie |

**Auth model:** connecting Strava sets a signed, HttpOnly cookie (`stride_strava`,
HMAC-signed with `COOKIE_SECRET`). Every data endpoint verifies that signature, so only a
connected device can read data or spend API credit. Connections are per-device.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Used by |
|---|---|
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | Strava OAuth + token refresh |
| `WITHINGS_CLIENT_ID`, `WITHINGS_SECRET` | Withings OAuth + token refresh |
| `OURA_TOKEN` | Oura personal access token |
| `ANTHROPIC_API_KEY` | Claude (the coach) |
| `COOKIE_SECRET` | signs the login cookie |

No secret is stored in the repo; the API key is never sent to the browser.

## Deploy / update

Push to `main` on GitHub → Vercel auto-builds and promotes to production. Changing an
env var requires a redeploy for it to take effect. Full first-time setup is in `DEPLOY.md`.

## What the analytics compute

- **Combined training load** = weekly relative effort from runs **and** F45 classes.
- **ACWR** (acute:chronic workload ratio) = this week's load ÷ recent 4-week average;
  >~1.5 flags an injury-risk spike.
- **Aerobic efficiency** = speed ÷ heart rate (recent 4 weeks vs the 4 before).
- **Weather** attached to the ~14 most recent GPS runs (Open-Meteo archive).
- **No-GPS watchdog** flags runs recorded without a satellite track.

## Known limitations / future work

- Oura history is limited to ~30 days per request; weather to the ~14 most recent runs.
- The coach question is passed to the model without prompt-injection hardening (low risk
  for a single user); no rate limiting beyond the prepaid API spend cap.
- No automated tests or CI; verification is manual. No TypeScript.
- The aerobic-efficiency metric is a simplified index, not lab-grade.
- Connections are per-device (each phone/browser reconnects once).

## Cost

Coach calls use Claude Haiku (~$0.003 each); the daily read is cached client-side, so
usage is a few calls a day. Anthropic credit is prepaid with no auto-reload, so spend is
hard-capped.
