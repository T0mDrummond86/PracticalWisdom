-- Per-IP request timestamps for the burst limiter. In SQLite rather than in memory so
-- the limit is shared across gunicorn workers and survives a redeploy: the old
-- in-process dict gave every worker its own allowance and reset on every deploy.
-- Rows are pruned opportunistically once they fall outside the window.
CREATE TABLE IF NOT EXISTS rate_hits (
  name TEXT NOT NULL,
  ip   TEXT NOT NULL,
  ts   REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_hits_lookup ON rate_hits(name, ip, ts);
