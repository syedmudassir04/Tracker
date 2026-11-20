// Cloudflare Worker: HTTP API, D1 persistence, daily scheduled Google sync.
const HOUR_MS = 60 * 60 * 1000;
const SESSION_MS = 12 * HOUR_MS;
const ALLOWED_STATUSES = new Set(['Not Applied', 'Applied', 'Assessment', 'Interview', 'Rejected', 'Offer']);
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function getIstDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function getIstDayStartUtc(date = new Date()) {
  return new Date(`${getIstDateKey(date)}T00:00:00+05:30`).toISOString();
}

export function checkStatus(lastCheckedAt, now = Date.now()) {
  if (!lastCheckedAt) return 'due';
  const stamp = Date.parse(lastCheckedAt);
  if (!Number.isFinite(stamp)) return 'due';
  return now >= stamp + HOUR_MS ? 'due' : 'waiting';
}

export function safeHttpUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length > 1000) throw new Error('URL is too long.');
  let url;
  try { url = new URL(text); } catch { throw new Error('Enter a valid full website URL (https://...).'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS links are supported.');
  if (url.username || url.password) throw new Error('Do not include credentials in links.');
  return url.href;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function fail(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function requireText(value, label, maxLength = 150) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error(`${label} is required.`);
  if (result.length > maxLength) throw new Error(`${label} is too long.`);
  return result;
}

function optionalText(value, maxLength = 4000) {
  const result = String(value ?? '').trim();
  if (result.length > maxLength) throw new Error('Text is too long.');
  return result;
}

function safeDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00Z`)) || new Date(`${text}T00:00:00Z`).toISOString().slice(0, 10) !== text) {
    throw new Error('Dates must use YYYY-MM-DD.');
  }
  return text;
}

function validId(id) {
  return /^[a-f0-9-]{36}$/i.test(id);
}

async function bodyJson(req) {
  if (Number(req.headers.get('content-length') || 0) > 50_000) throw new Error('Request too large.');
  const raw = await req.text();
  if (raw.length > 50_000) throw new Error('Request too large.');
  try { return JSON.parse(raw); } catch { throw new Error('Invalid JSON.'); }
}

function toB64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padding), (ch) => ch.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {
    name: 'HMAC', hash: 'SHA-256',
  }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

async function passwordMatches(input, expected) {
  // Compare fixed-length digests rather than password strings.
  const [a, b] = await Promise.all([hmac('login-comparison', input), hmac('login-comparison', expected)]);
  return equalBytes(a, b);
}

async function newSession(secret) {
  const payload = toB64Url(new TextEncoder().encode(JSON.stringify({
    exp: Date.now() + SESSION_MS, nonce: crypto.randomUUID(),
  })));
  return `${payload}.${toB64Url(await hmac(secret, payload))}`;
}

async function sessionValid(req, secret) {
  if (!secret || secret.length < 32) return false;
  const rawCookie = req.headers.get('cookie') || '';
  const sessionPart = rawCookie.split(';').map((s) => s.trim()).find((s) => s.startsWith('job_radar_session='));
  if (!sessionPart) return false;
  const token = sessionPart.slice('job_radar_session='.length);
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  try {
    const expected = await hmac(secret, payload);
    if (!equalBytes(expected, fromB64Url(signature))) return false;
    const data = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
    return Number.isFinite(data.exp) && data.exp > Date.now();
  } catch { return false; }
}

function cookie(value, maxAge) {
  return `job_radar_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function validateWriteOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients; cookies remain protected by SameSite=Strict.
  return origin === new URL(req.url).origin;
}

function parseCompany(data) {
  return {
    name: requireText(data.name, 'Company name', 140),
    career_url: safeHttpUrl(data.career_url),
    linkedin_url: safeHttpUrl(data.linkedin_url),
    notes: optionalText(data.notes, 2000),
  };
}

function parseApplication(data) {
  const status = optionalText(data.status, 30) || 'Not Applied';
  if (!ALLOWED_STATUSES.has(status)) throw new Error('Invalid application status.');
  return {
    company_name: requireText(data.company_name, 'Company', 140),
    job_title: requireText(data.job_title, 'Job title', 200),
    job_url: safeHttpUrl(data.job_url),
    date_posted: safeDate(data.date_posted),
    date_applied: safeDate(data.date_applied),
    status,
    notes: optionalText(data.notes, 2000),
  };
}

async function getState(env) {
  const [companies, applications, emails, sync, checked] = await Promise.all([
    env.DB.prepare('SELECT * FROM companies ORDER BY name COLLATE NOCASE ASC').all(),
    env.DB.prepare('SELECT * FROM applications ORDER BY created_at DESC').all(),
    env.DB.prepare('SELECT * FROM email_leads ORDER BY received_at DESC LIMIT 100').all(),
    env.DB.prepare('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1').first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM check_log WHERE checked_at >= ?').bind(getIstDayStartUtc()).first(),
  ]);
  return {
    ok: true, companies: companies.results, applications: applications.results,
    emails: emails.results, lastSync: sync || null, checksToday: Number(checked?.count ?? 0),
    bridgeConfigured: Boolean(env.APPS_SCRIPT_URL && env.BRIDGE_SHARED_SECRET),
    serverNow: new Date().toISOString(),
  };
}

async function syncGoogle(env, triggerType = 'manual') {
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  const isReady = env.APPS_SCRIPT_URL && env.BRIDGE_SHARED_SECRET;
  if (!isReady) throw new Error('Google bridge is not configured. Set APPS_SCRIPT_URL and BRIDGE_SHARED_SECRET.');
  let countCompanies = 0;
  let countApps = 0;
  let countEmails = 0;
  try {
    const [companyRows, applicationRows, checksToday] = await Promise.all([
      env.DB.prepare('SELECT * FROM companies ORDER BY name COLLATE NOCASE').all(),
      env.DB.prepare('SELECT * FROM applications ORDER BY created_at DESC').all(),
      env.DB.prepare('SELECT COUNT(*) AS count FROM check_log WHERE checked_at >= ?').bind(getIstDayStartUtc()).first(),
    ]);
    const now = Date.now();
    const companies = companyRows.results.map((company) => ({
      ...company,
      check_status: checkStatus(company.last_checked_at, now) === 'due' ? "Didn't check" : 'Need to check back in an hour',
      next_due_at: company.last_checked_at ? new Date(Date.parse(company.last_checked_at) + HOUR_MS).toISOString() : '',
    }));
    const applications = applicationRows.results;
    countCompanies = companies.length;
    countApps = applications.length;
    const endpoint = new URL(env.APPS_SCRIPT_URL);
    if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' || !endpoint.pathname.endsWith('/exec')) {
      throw new Error('APPS_SCRIPT_URL must be a deployed script.google.com /exec URL.');
    }
    const dueCount = companies.filter((company) => company.check_status === "Didn't check").length;
    const response = await fetch(endpoint.toString(), {
      method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        secret: env.BRIDGE_SHARED_SECRET,
        action: 'sync', trigger: triggerType, date_key: getIstDateKey(),
        companies, applications,
        stats: { checks_today: Number(checksToday?.count ?? 0), due_now: dueCount },
      }),
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Google bridge returned HTTP ${response.status}.`);
    let result;
    try { result = await response.json(); }
    catch { throw new Error('Google bridge returned HTML instead of JSON. Check its deployment URL and access settings.'); }
    if (!result.ok) throw new Error(String(result.error || 'Google sync failed.').slice(0, 250));
    const messages = Array.isArray(result.gmail_messages) ? result.gmail_messages.slice(0, 150) : [];
    for (const msg of messages) {
      if (!msg.id || !msg.received_at || !msg.gmail_url) continue;
      const record = {
        id: String(msg.id).slice(0, 140), sender: String(msg.sender || '').slice(0, 300),
        subject: String(msg.subject || '').slice(0, 500),
        received_at: String(msg.received_at).slice(0, 60),
        category: String(msg.category || 'Review').slice(0, 60),
        gmail_url: safeHttpUrl(msg.gmail_url),
      };
      if (!record.gmail_url) continue;
      await env.DB.prepare(`INSERT OR IGNORE INTO email_leads
        (id, sender, subject, received_at, category, gmail_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(
          record.id, record.sender, record.subject, record.received_at,
          record.category, record.gmail_url, new Date().toISOString(),
        ).run();
    }
    countEmails = messages.length;
    const completedAt = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO sync_runs
      (id, started_at, completed_at, status, trigger_type, companies, applications, gmail_messages, error)
      VALUES (?, ?, ?, 'success', ?, ?, ?, ?, '')`).bind(
        runId, startedAt, completedAt, triggerType, countCompanies, countApps, countEmails,
      ).run();
    return { ok: true, synced_at: completedAt, companies: countCompanies, applications: countApps, gmail_messages: countEmails };
  } catch (error) {
    await env.DB.prepare(`INSERT INTO sync_runs
      (id, started_at, completed_at, status, trigger_type, companies, applications, gmail_messages, error)
      VALUES (?, ?, ?, 'failed', ?, ?, ?, ?, ?)`).bind(
        runId, startedAt, new Date().toISOString(), triggerType,
        countCompanies, countApps, countEmails, String(error.message || error).slice(0, 350),
      ).run();
    throw error;
  }
}

async function api(req, env) {
  if (!env.DB) return fail('D1 database binding is missing.', 503);
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 16 || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    return fail('Configure a strong ADMIN_PASSWORD (16+ characters) and SESSION_SECRET (32+ characters).', 503);
  }
  if (!validateWriteOrigin(req)) return fail('Cross-origin write requests are not allowed.', 403);
  const url = new URL(req.url);
  const path = url.pathname;
  if (path === '/api/login' && req.method === 'POST') {
    const payload = await bodyJson(req);
    if (!(await passwordMatches(String(payload.password || ''), env.ADMIN_PASSWORD))) return fail('Incorrect password.', 401);
    const session = await newSession(env.SESSION_SECRET);
    return json({ ok: true }, 200, { 'set-cookie': cookie(session, SESSION_MS / 1000) });
  }
  if (path === '/api/me' && req.method === 'GET') {
    return json({ ok: true, authenticated: await sessionValid(req, env.SESSION_SECRET) });
  }
  if (!(await sessionValid(req, env.SESSION_SECRET))) return fail('Sign in to continue.', 401);
  if (path === '/api/logout' && req.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
  }
  if (path === '/api/state' && req.method === 'GET') return json(await getState(env));
  if (path === '/api/sync' && req.method === 'POST') return json(await syncGoogle(env));
  if (path === '/api/companies' && req.method === 'POST') {
    const parsed = parseCompany(await bodyJson(req));
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO companies
      (id, name, career_url, linkedin_url, notes, last_checked_at, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?)`).bind(
        id, parsed.name, parsed.career_url, parsed.linkedin_url, parsed.notes, new Date().toISOString(),
      ).run();
    return json({ ok: true, id }, 201);
  }
  if (path === '/api/applications' && req.method === 'POST') {
    const parsed = parseApplication(await bodyJson(req));
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO applications
      (id, company_name, job_title, job_url, date_posted, date_applied, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        id, parsed.company_name, parsed.job_title, parsed.job_url, parsed.date_posted,
        parsed.date_applied, parsed.status, parsed.notes, now, now,
      ).run();
    return json({ ok: true, id }, 201);
  }
  const companyMatch = path.match(/^\/api\/companies\/([a-f\d-]{36})(?:\/(check))?$/i);
  if (companyMatch && validId(companyMatch[1])) {
    const id = companyMatch[1];
    const exists = await env.DB.prepare('SELECT id FROM companies WHERE id = ?').bind(id).first();
    if (!exists) return fail('Company not found.', 404);
    if (companyMatch[2] === 'check' && req.method === 'POST') {
      const stamp = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare('UPDATE companies SET last_checked_at = ? WHERE id = ?').bind(stamp, id),
        env.DB.prepare('INSERT INTO check_log (id, company_id, checked_at) VALUES (?, ?, ?)').bind(crypto.randomUUID(), id, stamp),
      ]);
      return json({ ok: true, last_checked_at: stamp });
    }
    if (!companyMatch[2] && req.method === 'PUT') {
      const parsed = parseCompany(await bodyJson(req));
      await env.DB.prepare('UPDATE companies SET name = ?, career_url = ?, linkedin_url = ?, notes = ? WHERE id = ?').bind(
        parsed.name, parsed.career_url, parsed.linkedin_url, parsed.notes, id,
      ).run();
      return json({ ok: true });
    }
    if (!companyMatch[2] && req.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM companies WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }
  const applicationMatch = path.match(/^\/api\/applications\/([a-f\d-]{36})$/i);
  if (applicationMatch && validId(applicationMatch[1])) {
    const id = applicationMatch[1];
    const exists = await env.DB.prepare('SELECT id FROM applications WHERE id = ?').bind(id).first();
    if (!exists) return fail('Application not found.', 404);
    if (req.method === 'PUT') {
      const parsed = parseApplication(await bodyJson(req));
      await env.DB.prepare(`UPDATE applications SET company_name = ?, job_title = ?, job_url = ?,
        date_posted = ?, date_applied = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?`).bind(
          parsed.company_name, parsed.job_title, parsed.job_url, parsed.date_posted,
          parsed.date_applied, parsed.status, parsed.notes, new Date().toISOString(), id,
        ).run();
      return json({ ok: true });
    }
    if (req.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM applications WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }
  return fail('Endpoint not found.', 404);
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/api/')) {
      try { return await api(req, env); }
      catch (error) {
        console.error('API error:', error.message);
        if (error instanceof TypeError || /D1|no such table/i.test(String(error.message))) {
          return fail('Request failed. Check server configuration and database migrations.', 503);
        }
        return fail(String(error.message || 'Unexpected server error.').slice(0, 350), 400);
      }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail('Method not allowed.', 405);
    return env.ASSETS.fetch(req);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(syncGoogle(env, 'scheduled').catch((error) => {
      console.error('Daily Google sync failed:', error.message);
    }));
  },
};
