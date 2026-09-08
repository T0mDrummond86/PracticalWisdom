-- Administrators are Google accounts rather than a shared password.
--
-- The UPDATE is a ONE-TIME grant: every account that had already signed in when this
-- migration ran becomes an administrator. It runs once (schema_migrations records it),
-- so accounts created afterwards default to 0 and stay ordinary readers until an
-- existing admin promotes them. The password login is kept as a way back in.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
UPDATE users SET is_admin = 1;
