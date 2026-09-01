-- A per-day counter for paid API calls, so a daily spend cap survives restarts and
-- is shared across gunicorn workers (an in-process counter would give each worker
-- its own allowance). `day` is the UTC date, matching every other timestamp here.
CREATE TABLE IF NOT EXISTS api_usage (
  day   TEXT    NOT NULL,
  name  TEXT    NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
