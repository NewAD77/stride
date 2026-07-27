# Stride — deploy the live version to Vercel

This turns the app into a live, self-refreshing site connected to your Strava.
You do it once. I can drive most of it in your browser — this is the map.

**What you'll set up:** the code goes on GitHub → Vercel builds it → you add 3 secret
settings → you point Strava at the new address → tap "Connect with Strava". Done.

---

## Step 1 — Put the code on GitHub (free)

1. Go to **https://github.com/new** and create a repository named `stride` (Private is fine).
2. On the new repo page, click **"uploading an existing file"**.
3. Drag in **all the files from the `stride-vercel` folder** — including the `api` folder.
4. Click **Commit changes**.

*(No GitHub account? Create one first — free. This is the one account you'll need.)*

---

## Step 2 — Deploy on Vercel

1. Go to **https://vercel.com** and sign in **with GitHub**.
2. Click **Add New… → Project**, find your `stride` repo, click **Import**.
3. Leave all defaults, click **Deploy**.
4. After ~1 minute you get a live address like **`https://stride-xxxx.vercel.app`**. Copy it.

---

## Step 3 — Add the 3 secret settings

In your Vercel project: **Settings → Environment Variables**, add these three, then redeploy
(Deployments → ⋯ → Redeploy):

| Name | Value |
|------|-------|
| `STRAVA_CLIENT_ID` | `268093` |
| `STRAVA_CLIENT_SECRET` | *paste from your Strava API page — click "Show" there* |
| `COOKIE_SECRET` | `92e552a746f739e09da7fd47fd8f585e024e2816eef003330d4ae20b39595db1` |

> `COOKIE_SECRET` just signs your login cookie — the value above is a random one I
> generated for you; you can keep it or replace it with any long random string.
> **Your Client Secret should only ever be typed here in Vercel, never shared in chat.**

---

## Step 4 — Point Strava at your new address

1. Back at **https://www.strava.com/settings/api**, click **Edit**.
2. Change **Authorization Callback Domain** from `localhost` to just your Vercel domain —
   e.g. `stride-xxxx.vercel.app` (no `https://`, no slashes).
3. Save.

---

## Step 5 — Connect & install

1. Open your `https://stride-xxxx.vercel.app` address in **Safari** on your iPhone.
2. Tap **Connect with Strava** → **Authorize**.
3. The app now shows your **live** training (look for the green **LIVE** tag).
4. Tap **Share → Add to Home Screen** to keep it as an app icon.

From now on it refreshes your real runs every time you open it — no more demo data.

---

## What's next
Stage 3 adds **weather** (per-run heat/humidity), then **Oura** (recovery) and
**Withings** (body composition). Each is another small function + a connect step, same
pattern as this one.
