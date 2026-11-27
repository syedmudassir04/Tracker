// Cloudflare Worker: HTTP API, D1 persistence, daily scheduled Google sync.
const HOUR_MS = 60 * 60 * 1000;
const IST_DAY_MS = 24 * HOUR_MS;
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

// A check stays current until midnight in Hyderabad, even if that is only minutes away.
export function checkStatus(lastCheckedAt, now = Date.now()) {
  if (!lastCheckedAt) return 'due';
  const stamp = Date.parse(lastCheckedAt);
  if (!Number.isFinite(stamp) || stamp > now) return 'due';
  return getIstDateKey(new Date(stamp)) === getIstDateKey(new Date(now)) ? 'waiting' : 'due';
}

export function getNextIstMidnightUtc(lastCheckedAt) {
  const stamp = Date.parse(lastCheckedAt);
  if (!Number.isFinite(stamp)) return '';
  const start = Date.parse(getIstDayStartUtc(new Date(stamp)));
  return new Date(start + IST_DAY_MS).toISOString();
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
  const site_type = data.site_type || 'Company Website';
  if (!['Company Website', 'Career Website'].includes(site_type)) {
    throw new Error('Select Company Website or Career Website.');
  }
  const career_url = safeHttpUrl(data.career_url);
  if (career_url) {
    const link = new URL(career_url);
    if (/\/(?:login|sign_in|applythankyou|thank-you|application-success|maintenance-page|unavailableCareerSection)(?:[/?#]|$)/i.test(link.pathname)
        || /\/(?:apply\/|careers\/applyjob\/)/i.test(link.pathname)
        || /\/(?:apply-success|completed\/application)/i.test(link.pathname)
        || ['state','candidateId','jobApplicationId','Job_Application_ID','token','tid'].some(key => link.searchParams.has(key))) {
      throw new Error('Use a reusable careers/job-search page, not a login, confirmation or application-session URL.');
    }
  }
  return {
    name: requireText(data.name, 'Company name', 140),
    career_url,
    linkedin_url: safeHttpUrl(data.linkedin_url),
    site_type,
    notes: optionalText(data.notes, 2000),
  };
}

// Prevent duplicates without treating two employers on the same ATS hostname as identical.
async function duplicateCompany(env, parsed, exceptId = '') {
  const data = await env.DB.prepare('SELECT id, name, career_url FROM companies').all();
  const normalizeName = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const urlKey = (value) => {
    if (!value) return '';
    try {
      const u = new URL(value);
      const tenant = u.searchParams.get('domain') || u.searchParams.get('jobBoardSlug') || u.searchParams.get('org') || '';
      return u.hostname.toLowerCase() + u.pathname.replace(/\/+$/, '').toLowerCase() + (tenant ? `|${tenant.toLowerCase()}` : '');
    }
    catch { return ''; }
  };
  return data.results.find((row) => row.id !== exceptId && (
    normalizeName(row.name) === normalizeName(parsed.name) ||
    (parsed.career_url && row.career_url && urlKey(row.career_url) === urlKey(parsed.career_url))
  ));
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

function dailyActivity(checkRows, applicationRows, historicalRows, todayKey = getIstDateKey()) {
  const byDay = new Map();
  const [year, month, day] = todayKey.split('-').map(Number);
  const end = Date.UTC(year, month - 1, day);
  const start = Date.parse('2026-10-05T00:00:00Z');
  for (let tick = start; tick <= end; tick += IST_DAY_MS) {
    const key = new Date(tick).toISOString().slice(0, 10);
    byDay.set(key, { day: key, checks: 0, applications: 0 });
  }
  for (const row of checkRows) if (byDay.has(row.day)) byDay.get(row.day).checks = Number(row.total);
  for (const row of applicationRows) if (byDay.has(row.day)) byDay.get(row.day).applications = Number(row.total);
  for (const row of historicalRows) {
    if (byDay.has(row.day) && row.reported_total == null && !Number(byDay.get(row.day).applications)) {
      byDay.get(row.day).applications = null; // Blank was not a reported zero.
    }
  }
  return [...byDay.values()].reverse();
}

async function getState(env) {
  const todayKey = getIstDateKey();
  const windowStart = '2026-10-04T18:30:00.000Z'; // October 5, 2026 at midnight IST
  const [companies, applications, emails, sync, checked, allChecks, dailyChecks, dailyApplications, historyRows, historySum] = await Promise.all([
    env.DB.prepare('SELECT * FROM companies ORDER BY name COLLATE NOCASE ASC').all(),
    env.DB.prepare('SELECT * FROM applications ORDER BY created_at DESC').all(),
    env.DB.prepare('SELECT * FROM email_leads ORDER BY received_at DESC LIMIT 100').all(),
    env.DB.prepare('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1').first(),
    env.DB.prepare('SELECT (SELECT COUNT(*) FROM check_log WHERE checked_at >= ?) + (SELECT COUNT(*) FROM archived_check_log WHERE checked_at >= ?) AS count').bind(getIstDayStartUtc(), getIstDayStartUtc()).first(),
    env.DB.prepare('SELECT (SELECT COUNT(*) FROM check_log) + (SELECT COUNT(*) FROM archived_check_log) AS count').first(),
    env.DB.prepare("SELECT date(checked_at, '+330 minutes') AS day, COUNT(*) AS total FROM (SELECT checked_at FROM check_log UNION ALL SELECT checked_at FROM archived_check_log) WHERE checked_at >= ? GROUP BY day").bind(windowStart).all(),
    env.DB.prepare(`SELECT day, SUM(total) AS total FROM (
      SELECT date_applied AS day, COUNT(*) AS total FROM applications
        WHERE date_applied >= '2026-10-05' AND date_applied != '' GROUP BY date_applied
      UNION ALL
      SELECT day, baseline AS total FROM historical_application_totals WHERE day >= '2026-10-05'
    ) GROUP BY day`).all(),
    env.DB.prepare("SELECT day, reported_total FROM historical_application_totals WHERE day >= '2026-10-05'").all(),
    env.DB.prepare('SELECT COALESCE(SUM(baseline), 0) AS total FROM historical_application_totals').first(),
  ]);
  const activity = dailyActivity(dailyChecks.results, dailyApplications.results, historyRows.results, todayKey);
  const appliedToday = Number(activity.find((row) => row.day === todayKey)?.applications ?? 0);
  const applicationsAllTime = Number(historySum?.total ?? 0) + applications.results.filter((a) => Boolean(a.date_applied)).length;
  const undatedApplications = applications.results.filter((a) => !a.date_applied && a.status !== 'Not Applied').length;
  return {
    ok: true, companies: companies.results, applications: applications.results,
    emails: emails.results,
    lastSync: sync || null, checksToday: Number(checked?.count ?? 0),
    checksAllTime: Number(allChecks?.count ?? 0), applicationsToday: appliedToday,
    applicationsAllTime,
    undatedApplications, dailyActivity: activity,
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
    const [companyRows, applicationRows, checksToday, checksAllTime] = await Promise.all([
      env.DB.prepare('SELECT * FROM companies ORDER BY name COLLATE NOCASE').all(),
      env.DB.prepare('SELECT * FROM applications ORDER BY created_at DESC').all(),
      env.DB.prepare('SELECT (SELECT COUNT(*) FROM check_log WHERE checked_at >= ?) + (SELECT COUNT(*) FROM archived_check_log WHERE checked_at >= ?) AS count').bind(getIstDayStartUtc(), getIstDayStartUtc()).first(),
      env.DB.prepare('SELECT (SELECT COUNT(*) FROM check_log) + (SELECT COUNT(*) FROM archived_check_log) AS count').first(),
    ]);
    const reportRows = await env.DB.prepare(`SELECT day, SUM(total) AS applications FROM (
      SELECT date_applied AS day, COUNT(*) AS total FROM applications
        WHERE date_applied >= '2026-10-05' AND date_applied != '' GROUP BY date_applied
      UNION ALL
      SELECT day, baseline AS total FROM historical_application_totals WHERE day >= '2026-10-05'
    ) GROUP BY day ORDER BY day DESC`).all();
    const checksByDay = await env.DB.prepare(`SELECT date(checked_at, '+330 minutes') AS day,
      COUNT(*) AS checks FROM (SELECT checked_at FROM check_log UNION ALL SELECT checked_at FROM archived_check_log)
      WHERE checked_at >= '2026-10-04T18:30:00.000Z' GROUP BY day`).all();
    const days = new Map(reportRows.results.map((x) => [x.day, { day: x.day, applications: Number(x.applications), checks: 0 }]));
    for (const item of checksByDay.results) {
      const record = days.get(item.day) || { day: item.day, applications: 0, checks: 0 };
      record.checks = Number(item.checks);
      days.set(item.day, record);
    }
    const history = await env.DB.prepare('SELECT day, reported_total FROM historical_application_totals').all();
    for (const item of history.results) {
      const record = days.get(item.day) || { day: item.day, applications: 0, checks: 0 };
      if (item.reported_total == null && record.applications === 0) record.applications = null;
      days.set(item.day, record);
    }
    const daily_activity = [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
    const applications_all_time = daily_activity.reduce((n, row) => n + (Number(row.applications) || 0), 0);
    const now = Date.now();
    const companies = companyRows.results.map((company) => ({
      ...company,
      check_status: checkStatus(company.last_checked_at, now) === 'due' ? "Didn't check" : 'Checked today - check tomorrow',
      next_due_at: company.last_checked_at ? getNextIstMidnightUtc(company.last_checked_at) : '',
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
        companies, applications, daily_activity,
        stats: { checks_today: Number(checksToday?.count ?? 0), checks_all_time: Number(checksAllTime?.count ?? 0),
          applications_today: daily_activity.find((d) => d.day === getIstDateKey())?.applications || 0,
          applications_all_time, due_now: dueCount },
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
    const existing = await duplicateCompany(env, parsed);
    if (existing) return fail(`Already tracked as ${existing.name}.`, 409);
    const id = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO companies
      (id, name, career_url, linkedin_url, site_type, notes, last_checked_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`).bind(
        id, parsed.name, parsed.career_url, parsed.linkedin_url, parsed.site_type, parsed.notes, new Date().toISOString(),
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
      const duplicate = await duplicateCompany(env, parsed, id);
      if (duplicate) return fail(`Already tracked as ${duplicate.name}.`, 409);
      await env.DB.prepare('UPDATE companies SET name = ?, career_url = ?, linkedin_url = ?, site_type = ?, notes = ? WHERE id = ?').bind(
        parsed.name, parsed.career_url, parsed.linkedin_url, parsed.site_type, parsed.notes, id,
      ).run();
      return json({ ok: true });
    }
    if (!companyMatch[2] && req.method === 'DELETE') {
      const company = await env.DB.prepare('SELECT name FROM companies WHERE id = ?').bind(id).first();
      await env.DB.batch([
        env.DB.prepare(`INSERT OR IGNORE INTO archived_check_log (id, company_name, checked_at)
          SELECT id, ?, checked_at FROM check_log WHERE company_id = ?`).bind(company.name, id),
        env.DB.prepare('DELETE FROM companies WHERE id = ?').bind(id),
      ]);
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
  async scheduled(controller, env, ctx) {
    const triggerType = controller.cron === '30 2 * * *' ? 'morning-gmail' : 'evening-sync';
    ctx.waitUntil(syncGoogle(env, triggerType).catch((error) => {
      console.error(`Google ${triggerType} failed:`, error.message);
    }));
  },
};
