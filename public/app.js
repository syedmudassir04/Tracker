'use strict';

const IST = 'Asia/Kolkata';
const HOUR_MS = 60 * 60 * 1000;
const STATUS_OPTIONS = ['Not Applied', 'Applied', 'Assessment', 'Interview', 'Rejected', 'Offer'];
const state = { companies: [], applications: [], emails: [], checksToday: 0, lastSync: null, bridgeConfigured: false };
let activePage = 'companies';
let toastTimer;

const $ = (id) => document.getElementById(id);
const byText = (value) => document.createTextNode(String(value ?? ''));
function el(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.append(byText(content));
  return element;
}
function addChildren(parent, ...nodes) { nodes.forEach((node) => parent.append(node)); return parent; }
function toast(message) {
  const target = $('toast');
  target.textContent = message;
  target.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => target.classList.remove('show'), 4500);
}
function istTime(iso, options = {}) {
  if (!iso) return 'Not checked';
  const time = new Date(iso);
  if (!Number.isFinite(time.getTime())) return 'Unknown';
  return time.toLocaleString('en-IN', {
    timeZone: IST, day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', ...options,
  });
}
function istDateToday() {
  const pieces = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date());
  const item = Object.fromEntries(pieces.map((part) => [part.type, part.value]));
  return `${item.year}-${item.month}-${item.day}`;
}
function isDue(company, now = Date.now()) {
  if (!company.last_checked_at) return true;
  const last = new Date(company.last_checked_at).getTime();
  return !Number.isFinite(last) || now >= last + HOUR_MS;
}
function link(label, href) {
  if (!href) return el('span', 'quiet', 'Not added');
  const anchor = el('a', 'tiny-link', label);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}
function actionButton(label, callback, danger = false) {
  const button = el('button', `small-action${danger ? ' danger' : ''}`, label);
  button.type = 'button';
  button.addEventListener('click', callback);
  return button;
}
async function api(path, method = 'GET', body) {
  const response = await fetch(path, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('Server returned an unexpected response.'); }
  if (response.status === 401 && path !== '/api/login') showLogin();
  if (!response.ok || result.ok === false) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}
function showLogin() {
  $('login-view').hidden = false;
  $('app-view').hidden = true;
  $('login-password').value = '';
}
function showApp() {
  $('login-view').hidden = true;
  $('app-view').hidden = false;
}
async function loadState() {
  const result = await api('/api/state');
  Object.assign(state, {
    companies: result.companies || [], applications: result.applications || [],
    emails: result.emails || [], checksToday: result.checksToday || 0,
    lastSync: result.lastSync, bridgeConfigured: result.bridgeConfigured,
  });
  renderAll();
}
function renderStats() {
  $('stat-companies').textContent = state.companies.length;
  $('stat-due').textContent = state.companies.filter((company) => isDue(company)).length;
  $('stat-checks').textContent = state.checksToday;
  $('stat-apps').textContent = state.applications.length;
}
function renderSyncStatus() {
  const target = $('sync-status');
  target.classList.remove('problem');
  if (!state.bridgeConfigured) {
    target.classList.add('problem');
    target.textContent = 'Google connection not configured yet. Company tracking still works. Complete the README setup to enable Gmail and Sheets sync.';
  } else if (!state.lastSync) {
    target.textContent = 'Google is configured. No sync yet. Automatic sync is scheduled for 7:00 PM IST daily, or click Sync Google now.';
  } else if (state.lastSync.status === 'failed') {
    target.classList.add('problem');
    target.textContent = `Last Google sync failed: ${state.lastSync.error}. Try Sync Google now after checking the configuration.`;
  } else {
    target.textContent = `Last successful Google sync: ${istTime(state.lastSync.completed_at)} IST · ${state.lastSync.companies} companies · ${state.lastSync.applications} applications · ${state.lastSync.gmail_messages} Gmail matches. Next scheduled: 7:00 PM IST.`;
  }
}
function statusButton(company) {
  const button = el('button', 'status-button');
  button.type = 'button';
  button.dataset.companyStatus = company.id;
  applyCompanyStatus(button, company);
  button.title = 'Click AFTER checking this company’s career and LinkedIn pages. Clicking again restarts the 60-minute timer.';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await api(`/api/companies/${company.id}/check`, 'POST');
      company.last_checked_at = result.last_checked_at;
      state.checksToday += 1;
      renderCompanies();
      renderStats();
      toast(`${company.name}: checked. Recheck in one hour.`);
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    }
  });
  return button;
}
function applyCompanyStatus(button, company) {
  const due = isDue(company);
  button.classList.toggle('waiting', !due);
  button.replaceChildren(byText(due ? "Didn't check" : 'Need to check back in an hour'));
  const helper = el('span', 'status-extra', company.last_checked_at
    ? `Due: ${istTime(new Date(new Date(company.last_checked_at).getTime() + HOUR_MS).toISOString())} IST`
    : 'Never checked');
  button.append(helper);
}
function renderCompanies() {
  const search = $('company-search').value.toLowerCase().trim();
  const filter = $('company-filter').value;
  const visible = state.companies
    .filter((company) => `${company.name} ${company.notes}`.toLowerCase().includes(search))
    .filter((company) => filter === 'all' || (filter === 'due') === isDue(company))
    .sort((a, b) => Number(isDue(b)) - Number(isDue(a)) || a.name.localeCompare(b.name));
  const body = $('companies-body');
  body.replaceChildren();
  for (const company of visible) {
    const row = el('tr');
    const nameCell = el('td');
    addChildren(nameCell, el('span', 'primary-cell', company.name),
      el('span', 'subline', company.notes || (company.last_checked_at ? `Last checked: ${istTime(company.last_checked_at)} IST` : 'Not yet checked')));
    const careerCell = el('td'); careerCell.append(link('Open careers ↗', company.career_url));
    const linkedinCell = el('td'); linkedinCell.append(link('Open LinkedIn ↗', company.linkedin_url));
    const statusCell = el('td'); statusCell.append(statusButton(company));
    const actions = el('td');
    addChildren(actions, addChildren(el('div', 'cell-actions'),
      actionButton('Edit', () => openForm('company', company)),
      actionButton('Delete', () => removeRecord('company', company), true)));
    addChildren(row, nameCell, careerCell, linkedinCell, statusCell, actions);
    body.append(row);
  }
  $('companies-empty').hidden = visible.length !== 0;
  $('companies-empty').textContent = state.companies.length === 0
    ? 'No companies yet. Add your first company to begin tracking.'
    : 'No companies match your current search or filter.';
}
function renderApplications() {
  const search = $('application-search').value.toLowerCase().trim();
  const filter = $('application-filter').value;
  const apps = state.applications.filter((app) => `${app.company_name} ${app.job_title}`.toLowerCase().includes(search))
    .filter((app) => filter === 'all' || app.status === filter);
  const body = $('applications-body');
  body.replaceChildren();
  for (const app of apps) {
    const row = el('tr');
    const title = el('td');
    addChildren(title, el('span', 'primary-cell', app.job_title), el('span', 'subline', app.company_name));
    const jobUrl = el('td'); jobUrl.append(link('Open listing ↗', app.job_url));
    const date = el('td', '', app.date_applied || 'Not applied');
    const status = el('td'); status.append(el('span', `label-pill ${app.status.replace(/[^a-zA-Z]/g, '')}`, app.status));
    const actions = el('td');
    addChildren(actions, addChildren(el('div', 'cell-actions'),
      actionButton('Edit', () => openForm('application', app)),
      actionButton('Delete', () => removeRecord('application', app), true)));
    addChildren(row, title, jobUrl, date, status, actions);
    body.append(row);
  }
  $('applications-empty').hidden = apps.length !== 0;
}
function renderEmails() {
  const body = $('emails-body');
  body.replaceChildren();
  for (const email of state.emails) {
    const row = el('tr');
    const subject = el('td'); subject.append(el('span', 'primary-cell', email.subject));
    const sender = el('td'); sender.append(el('span', 'subline', email.sender));
    const category = el('td'); category.append(el('span', 'label-pill', email.category));
    const received = el('td', '', istTime(email.received_at));
    const open = el('td'); open.append(link('Open Gmail ↗', email.gmail_url));
    addChildren(row, subject, sender, category, received, open);
    body.append(row);
  }
  $('emails-empty').hidden = state.emails.length !== 0;
}
function renderAll() {
  renderStats(); renderSyncStatus(); renderCompanies(); renderApplications(); renderEmails();
}
function navigate(page) {
  activePage = page;
  ['companies', 'applications', 'emails'].forEach((item) => {
    $(`${item}-page`).hidden = item !== page;
  });
  document.querySelectorAll('[data-page]').forEach((btn) => btn.classList.toggle('active', btn.dataset.page === page));
}
function field(config, value) {
  const label = el('label', '', config.label);
  let input;
  if (config.type === 'select') {
    input = el('select');
    for (const optionValue of config.options) {
      const option = el('option', '', optionValue);
      option.value = optionValue;
      input.append(option);
    }
  } else if (config.type === 'textarea') {
    input = el('textarea');
  } else {
    input = el('input');
    input.type = config.type || 'text';
  }
  input.name = config.key;
  input.value = String(value ?? '');
  input.required = !!config.required;
  if (config.placeholder) input.placeholder = config.placeholder;
  if (config.maxlength) input.maxLength = config.maxlength;
  label.append(input);
  return label;
}
function openForm(kind, record) {
  const editing = Boolean(record);
  $('dialog-title').textContent = `${editing ? 'Edit' : 'Add'} ${kind}`;
  const fields = kind === 'company' ? [
    { key: 'name', label: 'Company name', required: true, maxlength: 140 },
    { key: 'career_url', label: 'Careers page URL', type: 'url', placeholder: 'https://company.com/careers' },
    { key: 'linkedin_url', label: 'LinkedIn jobs URL', type: 'url', placeholder: 'https://www.linkedin.com/company/.../jobs/' },
    { key: 'notes', label: 'Notes', type: 'textarea', maxlength: 2000 },
  ] : [
    { key: 'company_name', label: 'Company name', required: true, maxlength: 140 },
    { key: 'job_title', label: 'Job title', required: true, maxlength: 200 },
    { key: 'job_url', label: 'Job listing URL', type: 'url', placeholder: 'https://...' },
    { key: 'date_posted', label: 'Date posted', type: 'date' },
    { key: 'date_applied', label: 'Date applied', type: 'date' },
    { key: 'status', label: 'Application status', type: 'select', options: STATUS_OPTIONS },
    { key: 'notes', label: 'Notes', type: 'textarea', maxlength: 2000 },
  ];
  const container = $('form-fields');
  container.replaceChildren();
  for (const config of fields) {
    let value = record?.[config.key] ?? '';
    if (!record && kind === 'application' && config.key === 'status') value = 'Not Applied';
    container.append(field(config, value));
  }
  $('record-form').dataset.kind = kind;
  $('record-form').dataset.id = record?.id || '';
  $('form-dialog').showModal();
  const first = container.querySelector('input');
  if (first) first.focus();
}
async function saveRecord(event) {
  event.preventDefault();
  const form = $('record-form');
  const kind = form.dataset.kind;
  const id = form.dataset.id;
  const record = Object.fromEntries(new FormData(form).entries());
  const base = kind === 'company' ? '/api/companies' : '/api/applications';
  const submit = $('save-record');
  submit.disabled = true;
  try {
    await api(id ? `${base}/${id}` : base, id ? 'PUT' : 'POST', record);
    $('form-dialog').close();
    await loadState();
    toast(`${kind === 'company' ? 'Company' : 'Application'} saved.`);
  } catch (error) { toast(error.message); }
  finally { submit.disabled = false; }
}
async function removeRecord(kind, record) {
  const label = kind === 'company' ? record.name : `${record.company_name}: ${record.job_title}`;
  if (!window.confirm(`Delete ${label}?${kind === 'company' ? ' Its check history will also be deleted.' : ''}`)) return;
  try {
    await api(`${kind === 'company' ? '/api/companies' : '/api/applications'}/${record.id}`, 'DELETE');
    await loadState();
    toast('Record deleted.');
  } catch (error) { toast(error.message); }
}
async function syncNow() {
  const button = $('sync-btn');
  button.disabled = true;
  button.textContent = 'Syncing with Google…';
  try {
    const result = await api('/api/sync', 'POST');
    await loadState();
    toast(`Synced ${result.companies} companies, ${result.applications} applications and ${result.gmail_messages} Gmail matches.`);
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = '↻ Sync Google now'; }
}
function updateTimers() {
  if ($('app-view').hidden) return;
  $('clock').textContent = `${new Date().toLocaleTimeString('en-IN', {
    timeZone: IST, hour: 'numeric', minute: '2-digit', second: '2-digit',
  })} IST`;
  for (const button of document.querySelectorAll('[data-company-status]')) {
    const company = state.companies.find((item) => item.id === button.dataset.companyStatus);
    if (company) {
      const due = isDue(company);
      if (due === button.classList.contains('waiting')) applyCompanyStatus(button, company);
    }
  }
  $('stat-due').textContent = state.companies.filter((item) => isDue(item)).length;
}
async function initialize() {
  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('login-error').textContent = '';
    try {
      await api('/api/login', 'POST', { password: $('login-password').value });
      showApp();
      await loadState();
    } catch (error) { $('login-error').textContent = error.message; }
  });
  $('logout-btn').addEventListener('click', async () => {
    try { await api('/api/logout', 'POST'); } catch { /* Logout locally even when server fails. */ }
    showLogin();
  });
  document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
  $('company-search').addEventListener('input', renderCompanies);
  $('company-filter').addEventListener('change', renderCompanies);
  $('application-search').addEventListener('input', renderApplications);
  $('application-filter').addEventListener('change', renderApplications);
  $('add-company-btn').addEventListener('click', () => openForm('company'));
  $('add-application-btn').addEventListener('click', () => openForm('application'));
  $('record-form').addEventListener('submit', saveRecord);
  $('close-dialog').addEventListener('click', () => $('form-dialog').close());
  $('cancel-dialog').addEventListener('click', () => $('form-dialog').close());
  $('sync-btn').addEventListener('click', syncNow);
  navigate('companies');
  try {
    const result = await api('/api/me');
    if (!result.authenticated) showLogin();
    else { showApp(); await loadState(); }
  } catch (error) { showLogin(); $('login-error').textContent = error.message; }
  setInterval(updateTimers, 1000);
  setInterval(() => { if (!$('app-view').hidden) renderCompanies(); }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !$('app-view').hidden) {
      updateTimers();
      loadState().catch((error) => toast(error.message));
    }
  });
}
document.addEventListener('DOMContentLoaded', initialize);
