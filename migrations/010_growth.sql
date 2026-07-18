-- Growth & ritual features: usage analytics, practice-this-week, curated paths,
-- and web-push subscriptions.

-- Lightweight usage events (privacy-friendly: no IPs, no user agents; user_id only
-- when signed in, so an admin can see WHAT is used, not track individuals).
CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,               -- e.g. view_tip, view_cards, search, advise
    tip_id     INTEGER REFERENCES tips(id) ON DELETE SET NULL,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_name_time ON events(name, created_at);

-- One current "practice this week" tip per user.
CREATE TABLE IF NOT EXISTS practice (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tip_id     INTEGER NOT NULL REFERENCES tips(id) ON DELETE CASCADE,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Curated paths: an ordered sequence of tips a reader can follow in Cards view.
CREATE TABLE IF NOT EXISTS paths (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    position    INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS path_tips (
    path_id  INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE,
    tip_id   INTEGER NOT NULL REFERENCES tips(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (path_id, tip_id)
);

-- Web-push subscriptions for the daily tip (one row per browser/device).
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT    NOT NULL UNIQUE,
    p256dh     TEXT    NOT NULL,
    auth       TEXT    NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
