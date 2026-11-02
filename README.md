<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Team 2 Hub

Team 2 Hub supports a persistent local data file for development and a Google Sheets store for shared data. Select the mode with `DATA_STORE` in `.env.local`.

## Local mode (default)

The app stores all accounts, tasks, reports, activity, and settings in `data/dashboard-data.json` on this computer. No Google credentials or Apps Script deployment are needed. This file is private local app data and is excluded from Git. Run `npm run dev` and open `http://localhost:3000`.

The first signup in a new local data file creates the admin account using the supplied name, email, and password—no setup code is required. After signing in, use the team page to add the other two people; they can then sign up with their approved email addresses. Passwords are stored as salted hashes. Back up the JSON file if you need to preserve or move this local data. The local JSON file does not sync with Google Sheets or other computers.

Certificates are also stored locally without a database: metadata is kept in `data/certificates.json` and private certificate files are kept in `data/certificate-files/`. The AI assistant's persistent dashboard-change history is stored in `data/assistant-history.json`. Back up these files and folders to preserve certificates and assistant history across reinstalls or when moving the app. PDF, JPG, JPEG, and PNG files up to 10 MB are supported. My Certificates shows only the signed-in user's certificates; the separate Team Certificates view shows certificates belonging to other active team members. Admins can manage employee certificates from the Team Certificates view.

Task actions by every signed-in user are permanently recorded in `data/task-history.json`, including user ID/name/role, task ID, timestamp, action, and before/after snapshots. Daily EOD report submissions and edits are retained in `data/daily-report-history.json` with the same actor metadata and prior/current report values. Each safe atomic history update preserves the previous valid file in a `.bak` backup; deleted tasks remain in task history. Backend SMTP notifications use the existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` settings in `.env.local`; credentials are never needed in the browser. The recipient is `ADMIN_EMAIL` when set, otherwise the report recipient from dashboard settings, then active Admin account emails. EOD report notifications are limited to one successful delivery per user and report date, even if that report is edited multiple times. `TASK_EMAIL_TIMEZONE` selects the scheduler timezone (defaults to the server's timezone), and `TASK_DAILY_SUMMARY_HOUR` sets the daily summary hour from 0 through 23 (default 18). Notification event IDs, report delivery keys, and sent summary dates are persisted in `data/task-email-state.json`; the scheduler retries pending notifications at startup and every minute, while stable message IDs and persistent sent IDs prevent repeated delivery after restart. Email failures are logged and do not roll back saved tasks or reports.

## Optional Google Sheets mode

To store the app's data in the spreadsheet instead, set `DATA_STORE=apps-script` in `.env.local` and deploy [`apps-script/Code.gs`](./apps-script/Code.gs) as a web app. Set `GOOGLE_SHEETS_ID` and `APPS_SCRIPT_URL`, and configure the matching `SHEETS_API_SECRET` in Apps Script Script Properties and `.env.local`. The deployment must execute as the spreadsheet owner and allow access to the web app. No service-account JSON key or Google Cloud CLI is needed. The browser still talks only to Express; the server calls Apps Script.

Keep `SESSION_SECRET` in `.env.local` in either mode. The first signup in a new, empty data store creates the admin account. Passwords are stored as salted hashes in the selected data store, not as plain text.

## Render deployment

For a production host like Render, keep `DATA_STORE=apps-script` and configure the same Google Sheets bridge environment variables described above. Render sets `PORT` and `RENDER=true` automatically, so the app binds to `0.0.0.0` and serves the built frontend correctly. Use:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variables: `NODE_ENV=production`, `SESSION_SECRET`, `DATA_STORE=apps-script`, `GOOGLE_SHEETS_ID`, `APPS_SCRIPT_URL`, `SHEETS_API_SECRET`, and your SMTP settings if you want email notifications.

The app stores live dashboard data in the Google Sheets-backed store and refreshes its dashboard data on a polling interval so changes appear without a manual reload. For Render, keep the data in Google Sheets instead of the local JSON file so all users share one source of truth.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Keep `DATA_STORE=local` in `.env.local` for local-only storage, or configure Google Sheets mode as described above.
3. Start the app: `npm run dev`

Task and report email actions may prepare a Gmail draft for an assignee; the app does not send the email. Admins prepare weekly reports by selecting completed tasks from the current week and currently pending tasks, adding optional notes, and saving the report for employees to view read-only. Independently, configured backend SMTP sends Admin notifications for saved task changes and employee progress. The dashboard chatbot works without an API key: for each question, it reads the latest dashboard records and combines them with automatically archived task, report, profile, certificate, activity, and chatbot-interaction history to provide data-grounded answers. Admins can ask for a specific employee's assigned tasks and reported blockers, including follow-up questions that refer to the employee by pronoun. Sign-ins are not recorded or shown in the activity log; the log focuses on changes made to tasks, reports, team, certificates, and settings. Recent-addition and activity answers also exclude sign-ins and chatbot interactions, and recent additions include certificate records from the last seven days. Employee answers are limited to the signed-in employee's permitted data. Assistant conversations are retained in the local JSON history file along with the other archived dashboard events.

The chatbot can be expanded from its header to fill the main workspace below the application header; use the same control to restore its compact floating size.

Each member and admin can add their own LinkedIn profile URL or ID and WhatsApp number in Hub Settings; admins can also manage member contact details from Our Team. The links appear on each team profile. In Google Sheets mode, deploy the updated Apps Script and initialize it to add the new contact columns to the `users` tab. All signed-in team members and admins can view and download certificates from other active team members; certificate changes remain limited to the owner or an admin.
