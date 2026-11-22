-- Daily statistics: retain lifetime checks when a company is deleted. No document bytes or metadata in Cloudflare.
-- Preserve lifetime check counts when a tracked company is deleted.
CREATE TABLE IF NOT EXISTS archived_check_log (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_archived_check_log_time ON archived_check_log(checked_at);
