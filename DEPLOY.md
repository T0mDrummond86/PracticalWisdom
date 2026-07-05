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
| `ADMIN_PASSWORD` | your admin password (do **not** keep the default `admin`) |
| `DB_PATH` | `/data/tips.db` (must match the volume mount) |
| `COOKIE_SECURE` | `1` |
| `GROQ_API_KEY` | *(optional)* enables AI advice/tag suggestions |

## 4. First run
- Open the Railway URL → **Sign in with Google** → click your name → **Admin sign-in…** →
  username `admin`, password = your `ADMIN_PASSWORD`.
- Add tips (or **Import tips from Excel**).

## Notes
- **Redirect-URI mismatch** is the usual first-deploy error — the URI in Google must exactly
  match `https://<domain>/auth/callback`. `ProxyFix` in `app.py` ensures the app builds the
  `https://` form behind Railway's proxy.
- **Memory:** semantic search/advice loads a local embedding model (fastembed). If the instance
  is memory-tight, remove `fastembed` from `requirements.txt` to run leaner (those features turn
  off gracefully).
- **PWA updates:** bump `CACHE` in `static/sw.js` whenever you ship new shell assets, or returning
  installed users keep the cached old version.
