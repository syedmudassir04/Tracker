-- Cloudflare D1-compatible historical application import.
-- Uses VALUES, not UNION ALL (D1 limits compound SELECTs).
-- Safe to re-apply: INSERT OR IGNORE preserves imported date rows and real applications.
CREATE TABLE IF NOT EXISTS historical_application_totals (
  day TEXT PRIMARY KEY,
  reported_total INTEGER,
  baseline INTEGER NOT NULL DEFAULT 0 CHECK (baseline >= 0),
  existing_at_import INTEGER NOT NULL DEFAULT 0
);
WITH source(day, reported) AS (
  VALUES
  ('2026-10-05', NULL),
  ('2026-10-06', NULL),
  ('2026-10-07', NULL),
  ('2026-10-08', NULL),
  ('2026-10-09', NULL),
  ('2026-10-10', 1),
  ('2026-10-11', 3),
  ('2026-10-12', 2),
  ('2026-10-13', 1),
  ('2026-10-14', 4),
  ('2026-10-15', 1),
  ('2026-10-16', 2),
  ('2026-10-17', 2),
  ('2026-10-18', 1),
  ('2026-10-19', 3),
  ('2026-10-20', 0),
  ('2026-10-21', 0),
  ('2026-10-22', 0),
  ('2026-10-23', 0),
  ('2026-10-24', 0),
  ('2026-10-25', 0),
  ('2026-10-26', 2),
  ('2026-10-27', 12),
  ('2026-10-28', 7),
  ('2026-10-29', 29),
  ('2026-10-30', 12),
  ('2026-10-31', 0),
  ('2026-11-01', 4),
  ('2026-11-02', 1),
  ('2026-11-03', 16),
  ('2026-11-04', 7),
  ('2026-11-05', 0),
  ('2026-11-06', 4),
  ('2026-11-07', 6),
  ('2026-11-08', 9),
  ('2026-11-09', 1),
  ('2026-11-10', 22),
  ('2026-11-11', 5),
  ('2026-11-12', 15),
  ('2026-11-13', 16),
  ('2026-11-14', 22),
  ('2026-11-15', 40),
  ('2026-11-16', 0),
  ('2026-11-17', 9),
  ('2026-11-18', 0),
  ('2026-11-19', 0),
  ('2026-11-20', 2),
  ('2026-11-21', 6),
  ('2026-11-22', 7),
  ('2026-11-23', 2),
  ('2026-11-24', 0),
  ('2026-11-25', 0),
  ('2026-11-26', 2)
)
INSERT OR IGNORE INTO historical_application_totals
  (day, reported_total, baseline, existing_at_import)
SELECT source.day, source.reported,
  CASE WHEN source.reported IS NULL THEN 0
       ELSE MAX(0, source.reported - (SELECT COUNT(*) FROM applications WHERE date_applied = source.day)) END,
  (SELECT COUNT(*) FROM applications WHERE date_applied = source.day)
FROM source;
