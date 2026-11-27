# Tracker update - 27 November 2026

Includes:
- Daily application totals since 5 October 2026; imported historical data is aggregated (278 reported), not fake job records.
- Existing detailed D1 applications at import time are subtracted from the historical baseline to prevent double counting.
- Blank reported dates 5–9 October are kept as unspecified, not zero.
- Latest 3 dates shown in Applications by default; Show full history reveals all dates.
- Total applications now includes historical imports plus detailed applications.
- Resume files stored on your laptop as `Syed_Mudassir_23rdNovember2026.pdf` (date follows the application date; file extension preserved). Existing files remain accessible.
- Google Sheets `Daily Activity` tab and morning Gmail review at 8 AM IST; existing 7 PM IST sync retained.
- Gmail inspection uses matching subject/sender metadata only, not message bodies. Heuristics may miss or incorrectly classify replies.

**Google authorization remains necessary**. Existing status `Google connection not configured yet` means the Worker secrets have not been connected.

Google setup:
1. Create a blank Google Sheet named `Job Radar`.
2. In Extensions > Apps Script, paste `google-apps-script/Code.gs`.
3. In Apps Script Project Settings > Script properties, set `SPREADSHEET_ID` and a random 32+ character `SHARED_SECRET`.
4. Run `setup()` and authorize Gmail and Sheets. Review permissions: `GmailApp` requests broad account authorization despite our use of only message subjects/senders.
5. Deploy as web app: Execute as **Me**, access **Anyone** (the private shared secret protects requests). Copy the `/exec` URL. Apps Script public endpoint exposure is a security tradeoff.
6. In your project PowerShell terminal run `npx.cmd wrangler secret put APPS_SCRIPT_URL --name tracker`, paste the `/exec` URL.
7. Run `npx.cmd wrangler secret put BRIDGE_SHARED_SECRET --name tracker`, enter the same `SHARED_SECRET`.
8. Run `npx.cmd wrangler deploy` and click `Sync Google now` to verify; `Gmail replies` and Google Sheet data should update.
9. When `Code.gs` changes later, publish a new Apps Script *version* for the existing deployment.

The sync is one-way: D1 -> Google Sheets. The Worker never receives Gmail passwords; the bridge sees Gmail metadata under your Google authorization.

If the automatic morning sync isn't configured yet, it fails safely and doesn't interfere with company tracking. The Cron Triggers are approximate, not exact-to-the-second.
