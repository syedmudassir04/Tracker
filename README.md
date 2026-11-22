# Hyderabad Job Radar

A private, Cloudflare-hosted job-tracking web application with **independent 24-hour company check timers**, an application tracker, Gmail job-email leads, and a daily Google Sheets export.

**Nothing here requires a paid third-party service.** Cloudflare Workers and D1 have free allowances, but limits and availability depend on your Cloudflare account. Google Apps Script also has service quotas.

## What it does

- Add your own company names, careers URLs, LinkedIn Jobs URLs, and notes. No companies are preloaded.
- Click the single red **Didn't check** button after you visit a company's job pages. It turns green and shows **Check back in 24 hours**.
- Exactly 24 hours after that company's last check, its status becomes due. The web page recalculates the status every second; reopening the site also calculates the correct status from the saved timestamp. Companies' timers are independent.
- Prioritize overdue companies and filter/search quickly. The app keeps a history of checks in Cloudflare D1.
- Log jobs you discover and update their application statuses.
- At **7:00 PM India Standard Time daily**, a Cloudflare Cron Trigger initiates a Google sync. It updates Google Sheets with the latest companies/applications and searches Gmail for matching job-related emails.
- The **Sync Google now** button triggers the same process on demand.
- Gmail email matches are **review leads only**: they never automatically set an application to "Applied." This protects you from incorrect application records.

### Data flow

`Browser → Cloudflare Worker → Cloudflare D1 database`

`Cloudflare Cron (19:00 IST) → Worker → your Google Apps Script → your Google Sheet & Gmail` 

The website can be used before Google is connected, but Gmail and Google Sheets sync will not work until the Google bridge is configured.

## Prerequisites

1. A Cloudflare account and your chosen `workers.dev` URL.
2. Node.js 20+ and PowerShell or a terminal.
3. A Google account, Gmail, and a blank Google Sheet.
4. Ability to authorize your own Apps Script and deploy it as a Web app.

## 1. Create the Cloudflare Worker + database

Extract the ZIP and open a terminal in the `hyderabad-job-radar` folder.

```powershell
npm install
npx wrangler login
npx wrangler d1 create job-radar-db
```

Cloudflare prints a **database_id** for the new database. Open `wrangler.toml` and replace:

`database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"`

with the actual ID Cloudflare returned.

Run the database migration:

```powershell
npm run db:init
```

Deploy your initial Worker:

```powershell
npm run deploy
```

It is normal for API requests to show a configuration error until you add the secrets in step 2.

## 2. Set the login password and session secret

```powershell
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

When prompted, enter a strong private password (16+ characters) and a **different, randomly generated secret** (32+ characters). The passwords do not appear in the project code or in the browser.

To generate a random secret in Windows PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
```

Save your login password somewhere secure. Save your session secret securely too.

## 3. Create and authorize the Google bridge

1. Open [Google Sheets](https://sheets.google.com), create a **new blank spreadsheet**, and name it `Job Radar`.
2. Copy the spreadsheet ID from the address bar: in `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`, copy the text between `/d/` and `/edit`.
3. In the spreadsheet, select **Extensions → Apps Script**.
4. Replace the default `Code.gs` with the entire contents of `google-apps-script/Code.gs` from this project.
5. In Apps Script, select **Project Settings → Script properties** and add:
   - `SPREADSHEET_ID` = the spreadsheet ID copied above.
   - `SHARED_SECRET` = a new long random value (at least 32 characters). Generate it using the PowerShell command above. **This must be different from your login password and session secret.**
6. Save the script, select the function **setup**, and click **Run**. Google will ask you to authorize spreadsheet and Gmail access. Only authorize code you have inspected and trust.
7. Once setup succeeds, select **Deploy → New deployment → Select type: Web app**.
8. Choose **Execute as: Me** and **Who has access: Anyone**, if that option is available to your account. This external endpoint is protected by the private `SHARED_SECRET`, but is reachable on the internet. Treat this as a personal app, not a multi-user app.
9. Deploy and copy the Web app URL ending in `/exec`.

**Security disclosure:** Apps Script's built-in `GmailApp` requests broad Gmail permissions even though this code only searches email headers and does not send, modify, delete, or archive messages. The script runs with your Google account's permissions. It also writes to the specific Sheet ID you provided. Never share your Apps Script secret or deployment management access.

The Apps Script bridge can be used from a Cloudflare Worker because the browser never calls Google Apps Script directly. Your Cloudflare Worker holds the shared secret server-side.

## 4. Connect Cloudflare to Gmail and Google Sheets

Back in the project terminal:

```powershell
npx wrangler secret put APPS_SCRIPT_URL
npx wrangler secret put BRIDGE_SHARED_SECRET
```

- For `APPS_SCRIPT_URL`, paste the Google Apps Script Web app URL ending in `/exec`.
- For `BRIDGE_SHARED_SECRET`, paste the **exact same** `SHARED_SECRET` stored in Apps Script Script Properties.

Deploy again:

```powershell
npm run deploy
```

Open the `workers.dev` URL printed by Wrangler. Sign in using `ADMIN_PASSWORD`, add a company, click its status once, then click **Sync Google now**.

Open the Google Sheet. It should contain four tabs: **Companies**, **Applications**, **Gmail Leads**, and **Daily Summary**.

- **Companies** shows exactly five visible columns: Company Name, Careers Page, LinkedIn Jobs, Check Status, Notes. Behind-the-scenes timestamps are stored in two hidden columns.
- **Applications** is a one-way copy of your website's application records.
- **Gmail Leads** lists email subjects/senders/categories/links, without the email body. Duplicate message IDs are skipped.
- **Daily Summary** appends a row each time a sync completes.

## 5. Daily workflow

1. Open the web application and click the red **Didn't check** companies first.
2. Check the career site and LinkedIn link, then click the red status button to record your check.
3. Apply to relevant openings immediately; create an application record to track each one.
4. Each company becomes due again after 24 hours, independently of all other companies.
5. At **7:00 PM IST**, the scheduled Google sync runs. Cloudflare Cron Triggers use UTC, so the configured schedule is `30 13 * * *`. Cron execution may be delayed by a few minutes.
6. To sync earlier, use **Sync Google now**.

## Limits and important details

- This app **does not continuously scrape company websites or LinkedIn**. It tracks your manual checking. Automated scraping of LinkedIn may run afoul of site restrictions, and career-site integrations vary by company.
- **Gmail is checked only during a Google sync**, not continuously. The sample searches the past 48 hours and up to 80 matching Gmail threads per sync. These are configurable caps in `Code.gs`; search matching is heuristic and can miss notifications.
- **Google Sheets receives snapshots only at sync time**. It is a one-way report, not a live two-way editor. Edits directly to Companies or Applications tabs are overwritten by the next sync. Use the web application for editing.
- Only the app website has live 24-hour check-status updates. The Google Sheet's red/green status reflects the last export.
- The application stores check records and application data in Cloudflare D1. Deleting the database deletes this source data. Create regular backups if it becomes important.
- A single-user password protects API access. Use a strong unique password, keep the URL private, consider Cloudflare Access and rate limiting, and do not reuse a Google account password.
- Both the Apps Script URL and its shared secret must be configured correctly. Never put any of the secrets in `public/` or GitHub.
- If you edit `Code.gs` **after deployment**, publish a **new version** of that Apps Script deployment in Google; changing editor code alone does not update a versioned Web app.
- In some managed Google Workspace accounts, administrators may restrict Apps Script, Gmail permissions, or public web app deployment.
- Cloudflare free-tier CPU, subrequest and D1 limits, and Google Apps Script execution/quotas, can matter for large lists.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "D1 database binding is missing" or missing table | Check the database ID in `wrangler.toml` and run `npm run db:init`. |
| Login fails | Check `ADMIN_PASSWORD` and `SESSION_SECRET` using `wrangler secret put`. Redeploy afterward. |
| No Google connection | Set `APPS_SCRIPT_URL` and `BRIDGE_SHARED_SECRET`; ensure the Google script has been deployed as a Web app. |
| Sync returns HTML instead of JSON | Verify the Apps Script `/exec` URL, deployment access level, and authorization with your own account. |
| Unauthorized bridge request | `BRIDGE_SHARED_SECRET` in Cloudflare must match Apps Script's `SHARED_SECRET`. |
| No Gmail leads | Check Gmail permissions and whether any emails match the search terms within the last 48 hours. |
| Daily sync not happening | Verify Cron Trigger under the deployed Worker in Cloudflare, and inspect Worker logs for exceptions. |

## Source files

- `src/worker.js`: secure API routes, D1 storage, session login, timed checks, scheduled Google sync.
- `public/index.html`: main page.
- `public/style.css`: responsive styling.
- `public/app.js`: forms, rendering, independent company timers, API requests.
- `migrations/0001_init.sql`: D1 tables.
- `google-apps-script/Code.gs`: Google Sheets + Gmail bridge.
- `wrangler.toml`: Workers settings, database binding and 7:00 PM IST schedule.
- `tests/worker.test.mjs`: basic automated tests. Run with `npm test`.

## Updating the website after edits

From this same project folder, run:

```powershell
npm run deploy
```

This updates the **same Worker**, provided its `name` and Cloudflare account remain the same. There is no need to rename your project or create a second website.
