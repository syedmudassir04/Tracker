import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { checkStatus, getIstDateKey, getIstDayStartUtc, safeHttpUrl } from '../src/worker.js';

test('one-hour status uses independent timestamps and expires at exact hour', () => {
  const start = Date.parse('2026-11-20T08:00:00.000Z');
  assert.equal(checkStatus(null, start), 'due');
  assert.equal(checkStatus(new Date(start).toISOString(), start + 59 * 60 * 1000), 'waiting');
  assert.equal(checkStatus(new Date(start).toISOString(), start + 60 * 60 * 1000), 'due');
  assert.equal(checkStatus('invalid', start), 'due');
});

test('India date rollover correctly determines the start of the local day', () => {
  const now = new Date('2026-11-20T19:20:00.000Z');
  assert.equal(getIstDateKey(now), '2026-11-21');
  assert.equal(getIstDayStartUtc(now), '2026-11-20T18:30:00.000Z');
});

test('website URL validation prevents unsupported schemes and credential URLs', () => {
  assert.equal(safeHttpUrl('  https://example.org/jobs '), 'https://example.org/jobs');
  assert.equal(safeHttpUrl(''), '');
  assert.throws(() => safeHttpUrl('javascript:alert(1)'));
  assert.throws(() => safeHttpUrl('https://username:password@example.com/'));
});

test('login issues a secure signed cookie and authenticated session is recognized', async () => {
  const env = {
    DB: {},
    ADMIN_PASSWORD: 'a-strong-password-that-is-not-real',
    SESSION_SECRET: 'local-test-session-secret-with-32-plus-characters',
  };
  const url = 'https://job-radar.example.com';
  const denied = await worker.fetch(new Request(`${url}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'wrong' }),
  }), env);
  assert.equal(denied.status, 401);

  const allowed = await worker.fetch(new Request(`${url}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
  }), env);
  assert.equal(allowed.status, 200);
  const cookie = allowed.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  const session = cookie.split(';')[0];
  const me = await worker.fetch(new Request(`${url}/api/me`, { headers: { cookie: session } }), env);
  assert.equal((await me.json()).authenticated, true);
  const anon = await worker.fetch(new Request(`${url}/api/me`), env);
  assert.equal((await anon.json()).authenticated, false);
});

test('company creation, hourly check, application logging, edits, and deletion work against SQL schema', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { readFileSync } = await import('node:fs');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0002_site_type.sql', import.meta.url), 'utf8'));
  const env = {
    ADMIN_PASSWORD: 'another-strong-private-test-password',
    SESSION_SECRET: 'another-local-test-secret-with-more-than-32-characters',
    DB: {
      prepare(sql) {
        const statement = sqlite.prepare(sql);
        let args = [];
        return {
          bind(...values) { args = values; return this; },
          all() { return Promise.resolve({ results: statement.all(...args) }); },
          first() { return Promise.resolve(statement.get(...args) ?? null); },
          run() { return Promise.resolve(statement.run(...args)); },
        };
      },
      async batch(statements) {
        sqlite.exec('BEGIN');
        try {
          for (const statement of statements) await statement.run();
          sqlite.exec('COMMIT');
        } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      },
    },
  };
  const host = 'https://job-radar.example.com';
  const call = (path, method = 'GET', payload, cookies = '') => worker.fetch(new Request(`${host}${path}`, {
    method, headers: { ...(payload ? { 'content-type': 'application/json' } : {}), ...(cookies ? { cookie: cookies } : {}) },
    body: payload ? JSON.stringify(payload) : undefined,
  }), env);
  const authResponse = await call('/api/login', 'POST', { password: env.ADMIN_PASSWORD });
  const session = authResponse.headers.get('set-cookie').split(';')[0];
  const noAuth = await call('/api/companies', 'POST', { name: 'Not allowed' });
  assert.equal(noAuth.status, 401);
  const created = await call('/api/companies', 'POST', {
    name: 'Example Co', career_url: 'https://example.com/jobs', linkedin_url: '', notes: 'Track monthly',
  }, session);
  assert.equal(created.status, 201);
  const companyId = (await created.json()).id;
  // Exact company and normalized URL duplicates are rejected.
  const duplicate = await call('/api/companies', 'POST', {
    name: ' example CO ', career_url: 'https://example.com/jobs/', site_type: 'Company Website',
  }, session);
  assert.equal(duplicate.status, 409);
  const sameCareerPage = await call('/api/companies', 'POST', {
    name: 'Other Company', career_url: 'https://example.com/jobs/?utm_source=linkedin', site_type: 'Company Website',
  }, session);
  assert.equal(sameCareerPage.status, 409);
  const badCareer = await call('/api/companies', 'POST', {
    name: 'Bad Session', career_url: 'https://site.example.com/login?state=abandoned',
  }, session);
  assert.equal(badCareer.status, 400);

  let stateResponse = await call('/api/state', 'GET', undefined, session);
  let data = await stateResponse.json();
  assert.equal(data.companies.length, 1);
  assert.equal(data.companies[0].last_checked_at, null);
  assert.equal(data.checksToday, 0);
  const checked = await call(`/api/companies/${companyId}/check`, 'POST', {}, session);
  assert.equal(checked.status, 200);
  const checkedData = await checked.json();
  assert.equal(checkStatus(checkedData.last_checked_at), 'waiting');
  const application = await call('/api/applications', 'POST', {
    company_name: 'Example Co', job_title: 'Data Analyst', job_url: 'https://example.com/jobs/12',
    date_posted: '2026-11-20', date_applied: '2026-11-20', status: 'Applied', notes: '',
  }, session);
  assert.equal(application.status, 201);
  const appId = (await application.json()).id;
  stateResponse = await call('/api/state', 'GET', undefined, session);
  data = await stateResponse.json();
  assert.equal(data.checksToday, 1);
  assert.equal(data.applications.length, 1);
  assert.equal(data.applications[0].status, 'Applied');
  const updated = await call(`/api/applications/${appId}`, 'PUT', {
    company_name: 'Example Co', job_title: 'Data Analyst', job_url: 'https://example.com/jobs/12',
    date_posted: '2026-11-20', date_applied: '2026-11-20', status: 'Interview', notes: 'Round 1',
  }, session);
  assert.equal(updated.status, 200);
  const erased = await call(`/api/companies/${companyId}`, 'DELETE', undefined, session);
  assert.equal(erased.status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM check_log').get().n, 0);
  stateResponse = await call('/api/state', 'GET', undefined, session);
  data = await stateResponse.json();
  assert.equal(data.companies.length, 0);
  assert.equal(data.applications[0].status, 'Interview');
  sqlite.close();
});

test('manual Google sync sends website snapshot and imports Gmail leads without changing applications', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { readFileSync } = await import('node:fs');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0002_site_type.sql', import.meta.url), 'utf8'));
  const statements = (sql) => {
    const statement = sqlite.prepare(sql);
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      all() { return Promise.resolve({ results: statement.all(...args) }); },
      first() { return Promise.resolve(statement.get(...args) ?? null); },
      run() { return Promise.resolve(statement.run(...args)); },
    };
  };
  const db = { prepare: statements };
  const env = {
    DB: db, ADMIN_PASSWORD: 'a-demo-password-stronger-than-16-characters',
    SESSION_SECRET: 'a-session-secret-longer-than-32-characters',
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/TEST/exec',
    BRIDGE_SHARED_SECRET: 'a-bridge-secret-longer-than-32-characters',
  };
  const originalFetch = globalThis.fetch;
  let received;
  globalThis.fetch = async (_url, options) => {
    received = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true, gmail_messages: [{
      id: 'message-123', sender: 'careers@example.org', subject: 'Application received',
      received_at: '2026-11-20T08:00:00.000Z', category: 'Application confirmation',
      gmail_url: 'https://mail.google.com/mail/u/0/#all/test-thread',
    }] }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    sqlite.prepare(`INSERT INTO companies (id,name,career_url,linkedin_url,notes,last_checked_at,created_at)
      VALUES (?,?,?,?,?,?,?)`).run('x', 'Private Company', '', '', '', null, new Date().toISOString());
    const base = 'https://job-radar.example.com';
    const login = await worker.fetch(new Request(`${base}/api/login`, {
      method: 'POST', body: JSON.stringify({ password: env.ADMIN_PASSWORD }),
    }), env);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const response = await worker.fetch(new Request(`${base}/api/sync`, {
      method: 'POST', headers: { cookie }, body: '{}',
    }), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).gmail_messages, 1);
    assert.equal(received.companies.length, 1);
    assert.equal(received.companies[0].check_status, "Didn't check");
    assert.equal(received.action, 'sync');
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM email_leads').get().n, 1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM sync_runs').get().n, 1);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM applications').get().n, 0);
  } finally { globalThis.fetch = originalFetch; sqlite.close(); }
});
