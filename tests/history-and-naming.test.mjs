import assert from 'node:assert/strict';
import test from 'node:test';
import { resumeFileName } from '../public/local-files.js';
import { readFileSync } from 'node:fs';

test('resume filename uses application date and ordinal, preserving file format', () => {
  assert.equal(resumeFileName({ date_applied: '2026-11-23' }, 'pdf'), 'Syed_Mudassir_23rdNovember2026.pdf');
  assert.equal(resumeFileName({ date_applied: '2026-11-11' }, 'docx'), 'Syed_Mudassir_11thNovember2026.docx');
  assert.equal(resumeFileName({ date_applied: '2026-10-01' }, 'pdf'), 'Syed_Mudassir_1stOctober2026.pdf');
});
test('historical SQL seeds 278 reported applications and preserves unknown dates', () => {
  const text = readFileSync(new URL('../data/historical_applications.csv', import.meta.url), 'utf8').trim().split(/\r?\n/).slice(1);
  const rows = text.map((line) => line.split(','));
  assert.equal(rows.length, 53);
  assert.equal(rows.filter((row) => row[1] === '').length, 5);
  assert.equal(rows.reduce((sum, row) => sum + Number(row[1] || 0), 0), 278);
});
test('morning and evening triggers configured', () => {
  const text = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.match(text, /name = \"tracker\"/);
  assert.doesNotMatch(text, /REPLACE_WITH_YOUR_D1_DATABASE_ID/);
  assert.match(text, /30 2 \* \* \*/);
  assert.match(text, /30 13 \* \* \*/);
});
