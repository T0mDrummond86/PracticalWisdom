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
| `EMBEDDINGS_API_KEY` | **required for semantic features on Railway** — see below |
| `EMBEDDINGS_API_URL` | your provider's `/v1/embeddings` endpoint |
| `EMBEDDINGS_API_MODEL` | your provider's embedding model name |

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
