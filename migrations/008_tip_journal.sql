-- Tip journal: a signed-in user's private log of experiences applying a tip, plus saved
-- AI coaching feedback on that log. kind = 'entry' (user-written) or 'ai' (saved feedback).
-- Rows survive un-favoriting; they go away only with the user, the tip, or explicit deletion.
CREATE TABLE IF NOT EXISTS journal_entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tip_id     INTEGER NOT NULL REFERENCES tips(id) ON DELETE CASCADE,
    kind       TEXT    NOT NULL DEFAULT 'entry',
    content    TEXT    NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_journal_user_tip ON journal_entries(user_id, tip_id);
