import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const migration = (name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
test('historical import subtracts already saved applications, without duplicating them', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(migration('0001_init.sql'));
    db.exec(migration('0002_site_type.sql'));
    db.exec(migration('0003_application_documents.sql'));
    // A real existing detailed application on Nov 15 must be counted only once.
    const record = db.prepare(`INSERT INTO applications
      (id,company_name,job_title,date_applied,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`);
    record.run('test-1', 'Employer', 'Analyst', '2026-11-15', 'Applied', '2026-11-15', '2026-11-15');
    db.exec(migration('0004_historical_application_totals.sql'));
    const on15 = db.prepare("SELECT reported_total, baseline, existing_at_import FROM historical_application_totals WHERE day='2026-11-15'").get();
    assert.deepEqual({ ...on15 }, { reported_total: 40, baseline: 39, existing_at_import: 1 });
    const total = db.prepare(`SELECT (SELECT SUM(baseline) FROM historical_application_totals)
      + (SELECT COUNT(*) FROM applications WHERE date_applied!='') AS n`).get().n;
    assert.equal(total, 278);
    const unknown = db.prepare("SELECT reported_total FROM historical_application_totals WHERE day='2026-10-05'").get();
    assert.equal(unknown.reported_total, null);
    record.run('test-2', 'Another Employer', 'Analyst', '2026-11-15', 'Applied', '2026-11-15', '2026-11-15');
    const after = db.prepare(`SELECT (SELECT SUM(baseline) FROM historical_application_totals)
      + (SELECT COUNT(*) FROM applications WHERE date_applied!='') AS n`).get().n;
    assert.equal(after, 279);
  } finally { db.close(); }
});
