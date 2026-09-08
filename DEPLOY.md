# Deploying to Railway (with Google sign-in)

The app runs as-is on Railway; these are the account/credential steps only you can do.

## 1. Google OAuth credentials (Google Cloud Console)
1. APIs & Services → **Credentials** → **Create credentials → OAuth client ID** → *Web application*.
2. **Authorized redirect URI:** `https://<your-railway-domain>/auth/callback`
   (add both the temporary `*.up.railway.app` domain and any custom domain you attach).
3. Copy the **Client ID** and **Client secret**.

## 2. Railway project
1. New Project → **Deploy from GitHub repo** → pick this repo, branch **`pwa`**.
   The `Procfile` runs migrations then starts gunicorn; `PORT` is provided by Railway.
2. **Add a Volume** (Storage → Add Volume) mounted at **`/data`**.
   SQLite lives on disk — without a volume, every redeploy wipes all tips/users.

## 3. Environment variables (Railway → Variables)
| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from step 1 |
| `GOOGLE_CLIENT_SECRET` | from step 1 |
| `SECRET_KEY` | a long random string (e.g. `python -c "import secrets;print(secrets.token_hex(32))"`) |
| `ADMIN_PASSWORD` | fallback admin password — see "Who administers the site" below |
| `DB_PATH` | `/data/tips.db` (must match the volume mount) |
| `COOKIE_SECURE` | `1` |
| `GROQ_API_KEY` | *(optional)* enables AI advice/tag suggestions |
| `EMBEDDINGS_API_KEY` | **required for semantic features on Railway** — see below |
| `VAPID_PRIVATE_KEY` | web-push signing key (PEM, newlines as `\n`) — from your local `.env` |
| `VAPID_PUBLIC_KEY` | web-push public key — from your local `.env` |
| `VAPID_SUB` | `mailto:` contact for push, e.g. `mailto:you@example.com` |
| `PUSH_HOUR` | *(optional)* hour (server time, 0-23) for the daily tip; default 8 |
| `IMAGE_DAILY_LIMIT` | *(optional)* picture generations per day; default 5 |
| `EMBEDDINGS_API_URL` | your provider's `/v1/embeddings` endpoint |
| `EMBEDDINGS_API_MODEL` | your provider's embedding model name |

### Who administers the site

Administrators are Google accounts, not a shared password. Migration `015_admin_users.sql`
performs a **one-time grant**: every account that had already signed in when it ran became
an administrator. It is recorded in `schema_migrations`, so it runs once — anyone signing
in afterwards is an ordinary reader until an existing admin promotes them.

**Check who that promoted before you rely on it.** Open *Tips & Tags Management → Who can
administer* after deploying: it lists every account and lets you promote or revoke. If
people you did not expect had signed in to save favourites, they are administrators until
you remove them, and admin can delete every tip. The last remaining administrator cannot
remove themselves, so the site can never be left with none.

`ADMIN_PASSWORD` still works and is deliberately kept: it is the way back in if the
account list is ever wrong. Note that `ADMIN_PASSWORD_HASH`, if set, silently overrides
`ADMIN_PASSWORD` — if the password has ever seemed not to take effect, check for a
leftover hash variable.

### Spend limits on the public AI routes

Meaning search, Ask and Explore reach a metered API and need no login, so each one has a
per-IP burst window (60 seconds) and a global daily ceiling. Past the ceiling the feature
pauses with a clear message and resets at midnight UTC; keyword search is never limited.
The defaults are deliberately loose — they stop a scripted loop, not a real visitor — and
all of them are optional environment variables you can retune without a redeploy:

| Variable | Default | Guards |
|---|---|---|
| `SEARCH_BURST_PER_MIN` / `SEARCH_DAILY_MAX` | 20 / 500 | `GET /api/tips/search` (one embedding call each) |
| `ADVISE_BURST_PER_MIN` / `ADVISE_DAILY_MAX` | 5 / 100 | `POST /api/advise` (an embedding **and** a completion) |
| `ANALYZE_BURST_PER_MIN` / `ANALYZE_DAILY_MAX` | 10 / 200 | `POST /api/tips/<id>/analyze`; an admin-written lens is served from the database and stays free |
| `EVENTS_BURST_PER_MIN` | 60 | `POST /api/events` — costs nothing, just stops the table being stuffed |
| `MAX_QUERY_CHARS` / `MAX_SITUATION_CHARS` | 500 / 1000 | truncates input before it reaches a metered API |
| `MAX_BODY_BYTES` | 16MB | request-body ceiling; must stay above the 12MB picture upload |

Counts live in SQLite (`rate_hits`, `api_usage`) rather than in process memory, so they are
shared across gunicorn workers and survive a redeploy. This also means the limits depend on
`ProxyFix` being configured with `x_for=1` — without it every visitor behind Railway's proxy
shares one bucket.

### Semantic features (Meaning links / search / advice) — use the hosted API
The local embedding model needs ~0.5–1 GB of RAM to load and will **OOM-kill the worker** on a
small instance. Instead, set an OpenAI-compatible embeddings API so it uses almost no memory:

- **Google Gemini (free tier):**
  `EMBEDDINGS_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/embeddings`,
  `EMBEDDINGS_API_MODEL=text-embedding-004`, `EMBEDDINGS_API_KEY=<AI Studio key>`
- **OpenAI:** `EMBEDDINGS_API_URL=https://api.openai.com/v1/embeddings`,
  `EMBEDDINGS_API_MODEL=text-embedding-3-small`
- **Jina (free tier):** `EMBEDDINGS_API_URL=https://api.jina.ai/v1/embeddings`,
  `EMBEDDINGS_API_MODEL=jina-embeddings-v3`

After deploying with these set, run **Tips & Tags Management → ✨ Rebuild semantic index** once
to embed all existing tips. New tips added on the site embed automatically. To keep the image
small you can also remove `fastembed` from `requirements.txt` (the API backend doesn't need it).

## 4. First run
- Open the Railway URL → **Sign in with Google** → click your name → **Admin sign-in…** →
  username `admin`, password = your `ADMIN_PASSWORD`.
- Add tips (or **Import tips from Excel**), then **Rebuild semantic index** (see above).

## Notes
- **Redirect-URI mismatch** is the usual first-deploy error — the URI in Google must exactly
  match `https://<domain>/auth/callback`. `ProxyFix` in `app.py` ensures the app builds the
  `https://` form behind Railway's proxy.
- **Memory:** without `EMBEDDINGS_API_KEY`, the app tries the local model (fastembed), which OOMs
  on small instances. Set the API key (above) to run semantic features with almost no memory.
- **PWA updates:** bump `CACHE` in `static/sw.js` whenever you ship new shell assets, or returning
  installed users keep the cached old version.

## Daily tip notifications & nightly backups
- The web process runs an internal scheduler: daily tip push at `PUSH_HOUR` and a
  nightly `.xlsx` backup at 03:00 to `/data/backups` (last 14 kept — on the volume,
  so download one occasionally for true offsite safety).
- Copy the three `VAPID_*` values from your local `.env` into Railway's variables,
  then users turn on "🔔 Daily tip" in their account menu (installed app).
- Note: Railway's clock is UTC — set `PUSH_HOUR` accordingly (e.g. 0 = 8am AWST).
