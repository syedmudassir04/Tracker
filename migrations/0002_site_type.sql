-- Add source classification without replacing the user's D1 tables.
ALTER TABLE companies ADD COLUMN site_type TEXT NOT NULL DEFAULT 'Company Website';
CREATE INDEX IF NOT EXISTS idx_companies_site_type ON companies(site_type);
