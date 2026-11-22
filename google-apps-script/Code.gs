/**
 * Google-owned bridge for Hyderabad Job Radar.
 * Runs under YOUR Google account, not under Cloudflare's account.
 * Store SPREADSHEET_ID and SHARED_SECRET in Apps Script > Project Settings > Script Properties.
 * Deploy as Web app: Execute as Me; access Anyone; keep SHARED_SECRET private.
 * Google Sheets sync is ONE WAY: website -> spreadsheet, once daily or on Sync Now.
 */

function setup() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  const secret = properties.getProperty('SHARED_SECRET');
  if (!spreadsheetId) throw new Error('Set SPREADSHEET_ID under Project Settings > Script properties.');
  if (!secret || secret.length < 32) throw new Error('Set SHARED_SECRET to a random value at least 32 characters long.');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  ensureSheet_(spreadsheet, 'Companies', [
    'Company Name', 'Careers Page', 'LinkedIn Jobs', 'Check Status', 'Notes', 'Website Type', 'Last Checked (UTC)', 'Next Due (UTC)'
  ]);
  ensureSheet_(spreadsheet, 'Applications', [
    'Company', 'Job Title', 'Job URL', 'Date Posted', 'Date Applied', 'Status', 'Notes'
  ]);
  ensureSheet_(spreadsheet, 'Gmail Leads', [
    'Received (UTC)', 'Sender', 'Subject', 'Category', 'Open Gmail', 'Message ID'
  ]);
  ensureSheet_(spreadsheet, 'Daily Summary', [
    'Day (IST)', 'Synced At (UTC)', 'Companies', 'Checks Today', 'Due Now', 'Applications', 'Gmail Matches', 'Trigger', 'Applications Today', 'Checks All Time'
  ]);
  // This intentionally prompts consent for Gmail access when setup() is run.
  GmailApp.search('newer_than:1d', 0, 1);
  spreadsheet.toast('Google bridge authorized and ready.', 'Job Radar', 5);
}

function doPost(e) {
  const response = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  };
  try {
    if (!e || !e.postData || !e.postData.contents) return response({ ok: false, error: 'No request body.' });
    const request = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    if (!secret || secret.length < 32 || request.secret !== secret) {
      return response({ ok: false, error: 'Unauthorized bridge request.' });
    }
    if (request.action !== 'sync') return response({ ok: false, error: 'Unsupported action.' });
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return response({ ok: false, error: 'A sync is already running.' });
    try {
      return response(sync_(request));
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return response({ ok: false, error: String(error.message || error).slice(0, 300) });
  }
}

function sync_(request) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('SPREADSHEET_ID is not configured.');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const companies = Array.isArray(request.companies) ? request.companies : [];
  const applications = Array.isArray(request.applications) ? request.applications : [];
  const stats = request.stats || {};
  const companyHeaders = [
    'Company Name', 'Careers Page', 'LinkedIn Jobs', 'Check Status', 'Notes', 'Website Type', 'Last Checked (UTC)', 'Next Due (UTC)'
  ];
  const applicationHeaders = [
    'Company', 'Job Title', 'Job URL', 'Date Posted', 'Date Applied', 'Status', 'Notes'
  ];
  const companyRows = companies.map(function (row) {
    return [asCell_(row.name), asCell_(row.career_url), asCell_(row.linkedin_url),
      asCell_(row.check_status), asCell_(row.notes), asCell_(row.site_type || 'Company Website'), asCell_(row.last_checked_at), asCell_(row.next_due_at)];
  });
  const applicationRows = applications.map(function (row) {
    return [asCell_(row.company_name), asCell_(row.job_title), asCell_(row.job_url),
      asCell_(row.date_posted), asCell_(row.date_applied), asCell_(row.status), asCell_(row.notes)];
  });
  const companySheet = replaceRows_(spreadsheet, 'Companies', companyHeaders, companyRows);
  // Six visible company columns: original five plus website type; timing columns stay hidden.
  companySheet.showColumns(6);
  companySheet.hideColumns(7, 2);
  setCompanyStatusColors_(companySheet);
  replaceRows_(spreadsheet, 'Applications', applicationHeaders, applicationRows);

  const gmailMessages = scanGmail_();
  appendNewGmail_(spreadsheet, gmailMessages);
  const summary = ensureSheet_(spreadsheet, 'Daily Summary', [
    'Day (IST)', 'Synced At (UTC)', 'Companies', 'Checks Today', 'Due Now', 'Applications', 'Gmail Matches', 'Trigger', 'Applications Today', 'Checks All Time'
  ]);
  summary.appendRow([
    asCell_(request.date_key), new Date().toISOString(), companies.length,
    Number(stats.checks_today || 0), Number(stats.due_now || 0), applications.length,
    gmailMessages.length, asCell_(request.trigger || 'manual'),
    Number(stats.applications_today || 0), Number(stats.checks_all_time || 0)
  ]);
  SpreadsheetApp.flush();
  return { ok: true, gmail_messages: gmailMessages };
}

function asCell_(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Prevent imported form values from being evaluated as spreadsheet formulas.
  if (/^[=+\-@]/.test(text)) return "'" + text;
  return text.slice(0, 5000);
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8eef8');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 210);
  sheet.setColumnWidth(2, 260);
  return sheet;
}

function replaceRows_(spreadsheet, name, headers, rows) {
  const sheet = ensureSheet_(spreadsheet, name, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    if (sheet.getMaxRows() < rows.length + 1) {
      sheet.insertRowsAfter(sheet.getMaxRows(), rows.length + 1 - sheet.getMaxRows());
    }
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8eef8');
  return sheet;
}

function setCompanyStatusColors_(sheet) {
  const range = sheet.getRange('D2:D');
  const red = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains("Didn't check").setBackground('#fee2e2').setFontColor('#991b1b')
    .setRanges([range]).build();
  const green = SpreadsheetApp.newConditionalFormatRule()
    .whenTextContains('Check back in 24 hours').setBackground('#dcfce7').setFontColor('#166534')
    .setRanges([range]).build();
  sheet.setConditionalFormatRules([red, green]);
}

function scanGmail_() {
  // Gmail is READ ONLY here: this script never sends, deletes, labels, or archives mail.
  // GmailApp itself requests broad authorization; see README security notes.
  const query = 'newer_than:2d {"thank you for applying" "application received" "application submitted" "job alert" "jobs matching" "job recommendations" "assessment" "interview invitation"}';
  const threads = GmailApp.search(query, 0, 80);
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const results = [];
  const seen = {};
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      if (message.getDate().getTime() < cutoff) return;
      const id = message.getId();
      if (seen[id]) return;
      seen[id] = true;
      const subject = message.getSubject() || '(no subject)';
      const sender = message.getFrom() || '';
      const searchable = subject + ' ' + sender;
      let category = 'Review';
      if (/interview/i.test(searchable)) category = 'Interview';
      else if (/assessment|online test|coding challenge/i.test(searchable)) category = 'Assessment';
      else if (/application received|application submitted|thank you for applying|successfully applied/i.test(searchable)) category = 'Application confirmation';
      else if (/job alert|jobs matching|job recommendations|new jobs|open roles|job opening/i.test(searchable)) category = 'Job alert';
      results.push({
        id: id,
        sender: sender.slice(0, 300),
        subject: subject.slice(0, 500),
        received_at: message.getDate().toISOString(),
        category: category,
        gmail_url: 'https://mail.google.com/mail/u/0/#all/' + thread.getId()
      });
    });
  });
  results.sort(function (a, b) { return b.received_at.localeCompare(a.received_at); });
  return results.slice(0, 150);
}

function appendNewGmail_(spreadsheet, results) {
  const sheet = ensureSheet_(spreadsheet, 'Gmail Leads', [
    'Received (UTC)', 'Sender', 'Subject', 'Category', 'Open Gmail', 'Message ID'
  ]);
  const existing = {};
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 6, lastRow - 1, 1).getValues();
    ids.forEach(function (item) { if (item[0]) existing[String(item[0])] = true; });
  }
  const fresh = results.filter(function (item) { return !existing[item.id]; });
  if (fresh.length) {
    const rows = fresh.map(function (row) {
      return [asCell_(row.received_at), asCell_(row.sender), asCell_(row.subject),
        asCell_(row.category), asCell_(row.gmail_url), asCell_(row.id)];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
  }
  sheet.hideColumns(6);
}
