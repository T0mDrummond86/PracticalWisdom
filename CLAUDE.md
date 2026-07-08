# Practical Wisdom — instructions for Claude

Flask + raw `sqlite3` app for collecting short tips. Vanilla-JS IIFE front end
(no build step, no framework). See `README.md` for setup/config and (on the
`pwa` branch) `DEPLOY.md` for Railway/Google OAuth deploy steps.

## Two branches, maintained in parallel — this is the thing to not forget

- `main` — the base app.
- `pwa` — everything `main` has, **plus** installable/offline PWA support
  (`static/sw.js`, `static/manifest.json`, icons, service-worker registration).

They diverged early and were built independently, so **the same files
(`app.py`, `static/app.js`, `static/styles.css`, `templates/index.html`) have
been edited on both sides**. A plain merge or cherry-pick between them
conflicts. When asked to bring a feature from one branch to the other:

1. Cherry-pick the commit; expect a conflict, usually in `app.py`'s import
   line or wherever the PWA-specific code lives — resolve by keeping both
   sides' additions, not picking one.
2. Run the full test suite on the target branch after resolving. It should
   still show the *union* of both branches' test counts.
3. Never assume a feature landed on both branches just because it's on one.
   If unsure which branch has what: `git log --oneline pwa..main` and
   `git log --oneline main..pwa`.

Ask before unifying them onto one branch — that's a bigger decision the user
should make explicitly, not something to do as a side effect of a feature ask.

## Database migrations

Schema lives in `migrations/NNN_description.sql`, applied in filename order,
each recorded once in `schema_migrations`. Rules:
- Use `CREATE TABLE IF NOT EXISTS` / additive `ALTER TABLE` — migrations must
  be safe to run against an existing database.
- Never edit a migration that's already been committed; add a new numbered
  file instead.
- `init_db()` runs at **module import** (not just under `python app.py`), so
  the schema is created no matter how the app is launched (gunicorn, WSGI,
  etc.) — this was a real production bug once (see git log on `pwa`), don't
  regress it back to only running in `if __name__ == "__main__"`.
- Before assuming a table is "missing" from the schema, check whether it's
  simply not applying (e.g. migrations not running) rather than not defined
  — grep `migrations/*.sql` for `CREATE TABLE` first.

## Testing

```bash
pip install -r requirements-dev.txt
pytest
```

Every test gets a fresh temp SQLite DB (`tests/conftest.py`) — your real
`tips.db` is never touched. **Run the full suite after any backend change**
before considering it done; each session so far has kept it green (87 passing
on `pwa` as of the last check). New features should add tests in the same
style as `tests/test_app.py` (helpers: `add_tip`, `login_admin`, `login_user`,
`get_csrf`).

## Deploying (pwa branch → Railway)

See `DEPLOY.md` on the `pwa` branch. Key gotchas already fixed in code, don't
reintroduce:
- `ProxyFix` is required so `url_for(_external=True)` builds `https://`
  OAuth redirect URIs behind Railway's reverse proxy.
- Migrations must run at import time (see above) — gunicorn's `app:app`
  never executes `if __name__ == "__main__"`.
- The SQLite DB needs a persistent volume (`/data`) or every redeploy wipes
  all data.
- `static/sw.js` has a `CACHE` version constant — **bump it whenever shell
  assets (`app.js`/`styles.css`/`index.html`) change**, or installed PWA users
  keep getting served the old cached version instead of the update.

## Front-end conventions

- One file each: `static/app.js` (all logic, single IIFE), `static/styles.css`
  (all styles, CSS custom properties for theming), `templates/index.html`
  (structure only — no inline `<script>` logic beyond the theme-flash guard).
- Three colour themes via `data-theme` on `<html>`: `light` / `medium` /
  `dark`, persisted in `localStorage`. Keep new UI colours as CSS variables
  defined in all three theme blocks, not hardcoded hex values.
- Admin-only UI lives in the Tips & Tags Management dropdown or the detail
  pane; regular-user UI lives in the account dropdown (click the user's
  name). Admin sign-in itself is *inside* the account dropdown (must be
  signed in with Google first to reach it) — this was a deliberate choice,
  don't add a standalone always-visible Admin button back.
- When adding an admin feature, also update the Help modal
  (`#help-overlay` in `templates/index.html`) — it conditionally shows an
  admin-only section (`#help-admin`, toggled by `isAdmin` in `openHelp()`).

## Working style for this project

- The user is a beginner learning how their own app works — prefer clear,
  concrete explanations over jargon when describing *why* something broke or
  how a fix works, not just *what* changed.
- Verify claims against the actual running server/DB/tests rather than
  reasoning from code alone when a bug report contradicts an earlier fix —
  this has caught real mistakes in this project (e.g. a save button silently
  not persisting one field while another button on the same page did).
- Destructive admin actions (clear all tips, clear all tags) must have an
  explicit confirm step describing exactly what's deleted and that it's
  irreversible.
- Bundle related interleaved changes into one commit rather than splitting
  by file/hunk; always tail the output of long-running commands instead of
  leaving them unobserved.
