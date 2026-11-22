'use strict';
import { LocalDocumentLibrary, validateDocument } from './local-files.js';

const IST = 'Asia/Kolkata';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STATUS_OPTIONS = ['Not Applied', 'Applied', 'Assessment', 'Interview', 'Rejected', 'Offer'];
const state = {
  companies: [], applications: [], emails: [], files: [], dailyActivity: [], checksToday: 0,
  checksAllTime: 0, applicationsToday: 0, undatedApplications: 0,
  lastSync: null, bridgeConfigured: false,
};
const localDocuments = new LocalDocumentLibrary();
let activeFileApplicationId = null;
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
  return !Number.isFinite(last) || now >= last + CHECK_INTERVAL_MS;
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
    emails: result.emails || [], dailyActivity: result.dailyActivity || [],
    checksToday: result.checksToday || 0, checksAllTime: result.checksAllTime || 0,
    applicationsToday: result.applicationsToday || 0,
    undatedApplications: result.undatedApplications || 0,
    lastSync: result.lastSync, bridgeConfigured: result.bridgeConfigured,
  });
  renderAll();
}
function renderStats() {
  $('stat-companies').textContent = state.companies.length;
  $('stat-due').textContent = state.companies.filter((company) => isDue(company)).length;
  $('stat-checks').textContent = state.checksToday;
  $('stat-total-checks').textContent = state.checksAllTime;
  $('stat-apps-today').textContent = state.applicationsToday;
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
  button.title = 'Click AFTER checking this company’s career and LinkedIn pages. Clicking again restarts the 24-hour timer.';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const result = await api(`/api/companies/${company.id}/check`, 'POST');
      company.last_checked_at = result.last_checked_at;
      state.checksToday += 1;
      state.checksAllTime += 1;
      const today = istDateToday();
      const dailyRow = state.dailyActivity.find((row) => row.day === today);
      if (dailyRow) dailyRow.checks += 1;
      renderDailyActivity();
      renderCompanies();
      renderStats();
      toast(`${company.name}: checked. Recheck in 24 hours.`);
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
  button.replaceChildren(byText(due ? "Didn't check" : 'Check back in 24 hours'));
  const helper = el('span', 'status-extra', company.last_checked_at
    ? `Due: ${istTime(new Date(new Date(company.last_checked_at).getTime() + CHECK_INTERVAL_MS).toISOString())} IST`
    : 'Never checked');
  button.append(helper);
}
function renderCompanies() {
  const search = $('company-search').value.toLowerCase().trim();
  const filter = $('company-filter').value;
  const typeFilter = $('site-filter').value;
  const visible = state.companies
    .filter((company) => `${company.name} ${company.notes}`.toLowerCase().includes(search))
    .filter((company) => filter === 'all' || (filter === 'due') === isDue(company))
    .filter((company) => typeFilter === 'all' || (company.site_type || 'Company Website') === typeFilter)
    .sort((a, b) => Number(isDue(b)) - Number(isDue(a)) || a.name.localeCompare(b.name));
  const body = $('companies-body');
  body.replaceChildren();
  for (const company of visible) {
    const row = el('tr');
    const nameCell = el('td');
    addChildren(nameCell, el('span', 'primary-cell', company.name),
      el('span', 'subline', company.notes || (company.last_checked_at ? `Last checked: ${istTime(company.last_checked_at)} IST` : 'Not yet checked')));
    const careerCell = el('td');
    if (company.career_url) {
      careerCell.append(el('span', `site-type ${company.site_type === 'Career Website' ? 'job-board' : 'employer'}`,
        company.site_type || 'Company Website'));
    }
    careerCell.append(link('Open careers ↗', company.career_url));
    const linkedinCell = el('td');
    if (company.linkedin_url) linkedinCell.append(el('span', 'site-type job-board', 'Career Website'));
    linkedinCell.append(link('Open LinkedIn ↗', company.linkedin_url));
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
    const date = el('td', '', app.date_applied || 'No applied date');
    if (state.files.some((file) => file.application_id === app.id)) {
      const attached = state.files.filter((file) => file.application_id === app.id);
      date.append(el('span', 'subline', attached.map((file) => file.kind === 'resume' ? 'Resume saved' : 'Cover letter saved').join(' · ')));
    }
    const status = el('td'); status.append(el('span', `label-pill ${app.status.replace(/[^a-zA-Z]/g, '')}`, app.status));
    const actions = el('td');
    addChildren(actions, addChildren(el('div', 'cell-actions'),
      actionButton('Edit', () => openForm('application', app)),
      actionButton('Files', () => openFiles(app.id)),
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
function renderDailyActivity() {
  const tbody = $('daily-body');
  tbody.replaceChildren();
  for (const rowData of state.dailyActivity) {
    const row = el('tr');
    const day = el('td', 'daily-date', new Date(`${rowData.day}T12:00:00+05:30`).toLocaleDateString('en-IN', {
      timeZone: IST, day: '2-digit', month: 'short', year: 'numeric', weekday: 'short',
    }));
    const applications = el('td', 'daily-num', rowData.applications);
    const checks = el('td', 'daily-num', rowData.checks);
    if (rowData.day === istDateToday()) row.classList.add('today-row');
    addChildren(row, day, applications, checks);
    tbody.append(row);
  }
  $('undated-warning').hidden = state.undatedApplications === 0;
  $('undated-warning').textContent = `${state.undatedApplications} application(s) have a status beyond Not Applied but no Date applied. Add their original date to count them in the daily totals.`;
}

function documentLabel(kind) { return kind === 'resume' ? 'Resume' : 'Cover letter'; }
function fileSize(bytes) { return bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }
function folderStatus() {
  const status = $('folder-status');
  const reconnect = $('reconnect-folder-btn');
  const warning = $('documents-warning');
  reconnect.hidden = !localDocuments.root || localDocuments.ready;
  if (!localDocuments.supported) {
    status.textContent = 'This browser cannot write directly to laptop folders.';
    warning.textContent = 'Open this website in Chrome or Microsoft Edge on your laptop. Your files will stay locally stored.';
  } else if (localDocuments.ready) {
    status.textContent = `Connected to: ${localDocuments.folderName} · Files stay on this laptop`;
  } else if (localDocuments.root) {
    status.textContent = `Folder remembered: ${localDocuments.folderName} · Reconnect required`;
    warning.textContent = 'The browser needs renewed permission to access your saved folder. Click Reconnect folder.';
  } else {
    status.textContent = 'No laptop folder selected';
    warning.textContent = 'Choose a dedicated folder on your computer. The site will create one Role - Company - Date subfolder per application.';
  }
  warning.hidden = localDocuments.ready;
}

async function refreshLocalDocuments() {
  try {
    state.files = localDocuments.ready ? await localDocuments.scan() : [];
  } catch (error) {
    state.files = [];
    toast(`Local folder: ${error.message}`);
  }
  folderStatus();
  updateApplicationFolderStatus();
  renderDocuments();
  renderApplications();
  if (activeFileApplicationId && $('file-dialog').open) renderFilesModal();
}

async function chooseLocalFolder() {
  try {
    await localDocuments.chooseFolder();
    await refreshLocalDocuments();
    toast(`Using laptop folder: ${localDocuments.folderName}.`);
  } catch (error) {
    if (error.name !== 'AbortError') toast(error.message);
    folderStatus();
    updateApplicationFolderStatus();
  }
}
async function reconnectLocalFolder() {
  try {
    await localDocuments.reconnect();
    await refreshLocalDocuments();
    toast(`Reconnected: ${localDocuments.folderName}.`);
  } catch (error) { toast(error.message); folderStatus(); updateApplicationFolderStatus(); }
}

async function openLocalFile(record, view = false) {
  // Opening a blank tab synchronously avoids popup blockers while reading an async local file.
  const preview = view ? window.open('about:blank', '_blank') : null;
  try {
    const file = await localDocuments.getFile(record);
    const url = URL.createObjectURL(file);
    if (view && preview) {
      preview.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 180000);
    } else {
      if (preview) preview.close();
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = record.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  } catch (error) {
    if (preview) preview.close();
    toast(`Unable to open local file: ${error.message}`);
  }
}
function documentLinks(file) {
  const outer = el('span', 'file-links');
  if (file.media_type === 'application/pdf') outer.append(actionButton('View PDF ↗', () => openLocalFile(file, true)));
  outer.append(actionButton('Download ↗', () => openLocalFile(file, false)));
  return outer;
}
function renderDocuments() {
  folderStatus();
  const term = $('documents-search').value.trim().toLowerCase();
  const visible = state.files.filter((file) => `${file.company_name} ${file.job_title} ${file.filename} ${file.folder_name} ${documentLabel(file.kind)}`.toLowerCase().includes(term));
  const body = $('documents-body');
  body.replaceChildren();
  for (const file of visible) {
    const row = el('tr');
    const application = el('td');
    const exists = state.applications.some((a) => a.id === file.application_id);
    addChildren(application, el('span', 'primary-cell', file.company_name),
      el('span', 'subline', `${file.job_title}${exists ? '' : ' · Application deleted from tracker'}`),
      el('span', 'subline', `Folder: ${file.folder_name}`));
    const type = el('td'); type.append(el('span', 'label-pill', documentLabel(file.kind)));
    const filename = el('td');
    addChildren(filename, el('span', 'primary-cell', file.filename), el('span', 'subline', fileSize(file.file_size)));
    const when = el('td', '', istTime(file.uploaded_at));
    const controls = el('td');
    controls.append(documentLinks(file));
    if (exists) controls.append(actionButton('Manage', () => openFiles(file.application_id)));
    else controls.append(actionButton('Remove', () => removeFile(file), true));
    addChildren(row, application, type, filename, when, controls);
    body.append(row);
  }
  $('documents-empty').hidden = visible.length !== 0;
  $('documents-empty').textContent = !localDocuments.ready
    ? 'Choose or reconnect your laptop folder to show saved documents.'
    : 'No local documents yet. Go to Applications → Add application to attach a resume and cover letter.';
}

function openFiles(applicationId) {
  activeFileApplicationId = applicationId;
  $('file-upload-error').textContent = '';
  renderFilesModal();
  $('file-dialog').showModal();
}

function renderFilesModal() {
  const application = state.applications.find((app) => app.id === activeFileApplicationId);
  if (!application) { $('file-dialog').close(); activeFileApplicationId = null; return; }
  $('file-dialog-title').textContent = 'Application documents';
  $('file-dialog-subtitle').textContent = `${application.company_name} · ${application.job_title}`;
  const note = $('files-folder-note');
  note.textContent = localDocuments.ready
    ? `Laptop folder: ${localDocuments.folderName} → ${localDocuments.folders.get(application.id)?.name || 'New folder: ' + folderNameForDisplay(application)}`
    : 'Go to Documents → Choose laptop folder, then return here to save files.';
  for (const kind of ['resume', 'cover_letter']) {
    const slot = $(`file-slot-${kind}`);
    slot.replaceChildren();
    slot.append(el('h3', '', documentLabel(kind)));
    const existing = state.files.find((f) => f.application_id === application.id && f.kind === kind);
    if (existing) {
      slot.append(el('p', 'file-info', `${existing.filename} · ${fileSize(existing.file_size)} · ${istTime(existing.uploaded_at)} IST`));
      const buttons = el('div', 'file-actions');
      buttons.append(documentLinks(existing));
      buttons.append(actionButton('Remove', () => removeFile(existing), true));
      slot.append(buttons);
    } else slot.append(el('p', 'small muted', 'No file saved yet.'));
    const row = el('div', 'upload-row');
    const input = el('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.doc';
    input.setAttribute('aria-label', `Select ${documentLabel(kind)} file`);
    const upload = el('button', 'btn btn-primary', existing ? 'Replace file' : 'Save to laptop');
    upload.type = 'button';
    upload.disabled = !localDocuments.ready;
    upload.addEventListener('click', () => uploadFile(application.id, kind, input, upload));
    row.append(input, upload);
    slot.append(row);
  }
}

function folderNameForDisplay(application) {
  const date = application.date_applied || (application.created_at || '').slice(0,10) || 'Undated';
  return `${application.job_title} - ${application.company_name} - ${date}`;
}

async function uploadFile(applicationId, kind, input, button) {
  const file = input.files?.[0];
  if (!file) { $('file-upload-error').textContent = 'Select a document first.'; return; }
  const application = state.applications.find((app) => app.id === applicationId);
  if (!application) return;
  if (state.files.some((f) => f.application_id === applicationId && f.kind === kind) &&
      !window.confirm(`Replace the saved ${documentLabel(kind).toLowerCase()} in the laptop folder?`)) return;
  button.disabled = true;
  button.textContent = 'Saving locally…';
  $('file-upload-error').textContent = '';
  try {
    const folder = await localDocuments.save(application, kind, file);
    await refreshLocalDocuments();
    toast(`${documentLabel(kind)} saved to ${folder}.`);
  } catch (error) {
    $('file-upload-error').textContent = error.message;
    button.disabled = false;
    button.textContent = 'Try again';
  }
}

async function removeFile(file) {
  if (!window.confirm(`Delete ${file.filename} from your laptop folder? This cannot be undone.`)) return;
  try {
    await localDocuments.remove(file);
    await refreshLocalDocuments();
    toast('Local document removed.');
  } catch (error) { $('file-upload-error').textContent = error.message; toast(error.message); }
}

function renderAll() {
  renderStats(); renderSyncStatus(); renderCompanies(); renderApplications();
  renderDailyActivity(); renderDocuments(); renderEmails();
  if (activeFileApplicationId && $('file-dialog').open) renderFilesModal();
}
function navigate(page) {
  activePage = page;
  ['companies', 'applications', 'documents', 'emails'].forEach((item) => {
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
/** File pickers live inside Add/Edit Application, not in a separate post-save step. */
function updateApplicationFolderStatus() {
  const status = $('application-folder-status');
  const reconnect = $('application-reconnect-folder-btn');
  if (!status) return;
  reconnect.hidden = !localDocuments.root || localDocuments.ready;
  if (!localDocuments.supported) {
    status.textContent = 'Local folder upload requires Chrome or Edge on your laptop.';
  } else if (localDocuments.ready) {
    status.textContent = `Saving to laptop folder: ${localDocuments.folderName}`;
  } else if (localDocuments.root) {
    status.textContent = `Folder ${localDocuments.folderName} needs permission. Click Reconnect folder.`;
  } else {
    status.textContent = 'Choose a laptop folder before saving attachments (only needed once).';
  }
}
function applicationAttachmentFields(application) {
  const section = el('section', 'application-attachments');
  section.id = 'application-attachments';
  section.append(el('h3', '', 'Resume and cover letter'));
  section.append(el('p', 'small muted', 'Optional. Attach the exact files used for this application. They are saved ONLY to your chosen laptop folder. PDF, DOCX or DOC, maximum 8 MB per file.'));
  const folder = el('div', 'application-folder-toolbar');
  const choose = el('button', 'btn btn-outline', 'Choose laptop folder');
  choose.type = 'button';
  choose.id = 'application-choose-folder-btn';
  choose.addEventListener('click', chooseLocalFolder);
  const reconnect = el('button', 'btn btn-outline', 'Reconnect folder');
  reconnect.type = 'button';
  reconnect.id = 'application-reconnect-folder-btn';
  reconnect.hidden = true;
  reconnect.addEventListener('click', reconnectLocalFolder);
  folder.append(choose, reconnect);
  const status = el('p', 'small muted');
  status.id = 'application-folder-status';
  folder.append(status);
  section.append(folder);
  for (const kind of ['resume', 'cover_letter']) {
    const label = el('label', 'attachment-label', `${documentLabel(kind)} (optional)`);
    const input = el('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.doc';
    input.id = `application-file-${kind}`;
    input.setAttribute('aria-label', `Attach ${documentLabel(kind).toLowerCase()}`);
    // Deliberately no name attribute. File objects must NEVER be sent to the API.
    label.append(input);
    const previouslySaved = application && state.files.find(file => file.application_id === application.id && file.kind === kind);
    if (previouslySaved) label.append(el('span', 'small muted', `Already saved: ${previouslySaved.filename}. Selecting another file replaces it.`));
    section.append(label);
  }
  const error = el('p', 'small error');
  error.id = 'application-attachment-error';
  error.setAttribute('role', 'alert');
  section.append(error);
  return section;
}
function openForm(kind, record) {
  const editing = Boolean(record);
  $('dialog-title').textContent = `${editing ? 'Edit' : 'Add'} ${kind}`;
  const fields = kind === 'company' ? [
    { key: 'name', label: 'Company name', required: true, maxlength: 140 },
    { key: 'site_type', label: 'Website type', type: 'select', options: ['Company Website', 'Career Website'] },
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
  if (kind === 'application') {
    const status = container.querySelector('[name="status"]');
    const appliedDate = container.querySelector('[name="date_applied"]');
    const fillDate = () => {
      if (status.value !== 'Not Applied' && !appliedDate.value && !record) appliedDate.value = istDateToday();
    };
    status.addEventListener('change', fillDate);
    fillDate();
    container.append(applicationAttachmentFields(record));
    updateApplicationFolderStatus();
  }
  $('record-form').dataset.kind = kind;
  $('record-form').dataset.id = record?.id || '';
  $('save-record').textContent = kind === 'application' ? (editing ? 'Save changes and files' : 'Save application and files') : 'Save';
  $('form-dialog').showModal();
  const first = container.querySelector('input');
  if (first) first.focus();
}
async function saveRecord(event) {
  event.preventDefault();
  const form = $('record-form');
  const kind = form.dataset.kind;
  const originalId = form.dataset.id;
  const record = Object.fromEntries(new FormData(form).entries());
  const base = kind === 'company' ? '/api/companies' : '/api/applications';
  const attachments = kind === 'application'
    ? ['resume', 'cover_letter'].map((type) => ({ type, file: $(`application-file-${type}`)?.files?.[0] })).filter((item) => item.file)
    : [];
  const submit = $('save-record');
  const errorOutput = $('application-attachment-error');
  if (errorOutput) errorOutput.textContent = '';
  submit.disabled = true;
  let createdId = null;
  try {
    // Validate local prerequisites BEFORE creating a new D1 application record.
    if (attachments.length) {
      if (!localDocuments.ready) throw new Error('Choose or reconnect your laptop folder before saving the attached files.');
      for (const item of attachments) await validateDocument(item.file);
    }
    const result = await api(originalId ? `${base}/${originalId}` : base,
      originalId ? 'PUT' : 'POST', record);
    const savedId = originalId || result.id;
    if (kind === 'application' && !originalId) {
      // If writing a local file fails, retry will UPDATE rather than duplicate the application.
      createdId = savedId;
      form.dataset.id = savedId;
    }
    if (attachments.length) {
      const old = state.applications.find((app) => app.id === savedId);
      const application = {
        ...old, ...record, id: savedId,
        created_at: old?.created_at || new Date().toISOString(),
      };
      for (const item of attachments) await localDocuments.save(application, item.type, item.file);
      await refreshLocalDocuments();
    }
    $('form-dialog').close();
    await loadState();
    toast(kind === 'application'
      ? `Application saved${attachments.length ? ` with ${attachments.length} local document(s)` : ''}. View files under Documents.`
      : 'Company saved.');
  } catch (error) {
    const message = createdId
      ? `The application was saved, but a document could not be stored: ${error.message}. Fix the problem and click Save again. The application will NOT be duplicated.`
      : error.message;
    if (errorOutput) errorOutput.textContent = message;
    toast(message);
  } finally { submit.disabled = false; }
}

async function removeRecord(kind, record) {
  const label = kind === 'company' ? record.name : `${record.company_name}: ${record.job_title}`;
  if (!window.confirm(`Delete ${label}?${kind === 'company' ? ' Its historical checks will remain in your overall totals.' : ' Local documents will remain on your laptop.'}`)) return;
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
      await localDocuments.restore();
      await refreshLocalDocuments();
    } catch (error) { $('login-error').textContent = error.message; }
  });
  $('logout-btn').addEventListener('click', async () => {
    try { await api('/api/logout', 'POST'); } catch { /* Logout locally even when server fails. */ }
    showLogin();
  });
  document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
  $('company-search').addEventListener('input', renderCompanies);
  $('company-filter').addEventListener('change', renderCompanies);
  $('site-filter').addEventListener('change', renderCompanies);
  $('application-search').addEventListener('input', renderApplications);
  $('application-filter').addEventListener('change', renderApplications);
  $('documents-search').addEventListener('input', renderDocuments);
  $('choose-folder-btn').addEventListener('click', chooseLocalFolder);
  $('reconnect-folder-btn').addEventListener('click', reconnectLocalFolder);
  $('refresh-documents-btn').addEventListener('click', refreshLocalDocuments);
  $('add-company-btn').addEventListener('click', () => openForm('company'));
  $('add-application-btn').addEventListener('click', () => openForm('application'));
  $('record-form').addEventListener('submit', saveRecord);
  $('close-dialog').addEventListener('click', () => $('form-dialog').close());
  $('cancel-dialog').addEventListener('click', () => $('form-dialog').close());
  $('sync-btn').addEventListener('click', syncNow);
  $('close-file-dialog').addEventListener('click', () => $('file-dialog').close());
  $('finish-file-dialog').addEventListener('click', () => $('file-dialog').close());
  $('file-dialog').addEventListener('close', () => { activeFileApplicationId = null; });
  navigate('companies');
  try {
    const result = await api('/api/me');
    if (!result.authenticated) showLogin();
    else { showApp(); await loadState(); await localDocuments.restore(); await refreshLocalDocuments(); }
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
