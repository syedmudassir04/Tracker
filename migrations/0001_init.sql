CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  career_url TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  last_checked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companies_last_checked ON companies(last_checked_at);

CREATE TABLE IF NOT EXISTS check_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_check_log_time ON check_log(checked_at);
CREATE INDEX IF NOT EXISTS idx_check_log_company ON check_log(company_id);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_url TEXT NOT NULL DEFAULT '',
  date_posted TEXT NOT NULL DEFAULT '',
  date_applied TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Not Applied',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at);

CREATE TABLE IF NOT EXISTS email_leads (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  received_at TEXT NOT NULL,
  category TEXT NOT NULL,
  gmail_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_leads_received ON email_leads(received_at);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  status TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  companies INTEGER NOT NULL DEFAULT 0,
  applications INTEGER NOT NULL DEFAULT 0,
  gmail_messages INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON sync_runs(started_at);
