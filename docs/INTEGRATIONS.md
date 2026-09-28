# Integration Setup

The application database is always the system of record. Google Sheets or SharePoint is a **synchronised copy** for HR reporting and sharing. Changes are queued in `sync_queue` and pushed by a background worker every 20 seconds while *Sync automatically* is on. They can also be pushed on demand from Settings → Backend sync. Failed pushes are retried up to 8 times. The last error is shown in Settings and on the dashboard.

## A. Google Sheets

1. In the **Google Cloud Console**, create or choose a project and enable the **Google Sheets API**.
2. Go to **IAM & Admin → Service Accounts → Create service account**. No roles are needed. Open the account, then **Keys → Add key → JSON** to download the key file.
3. Create an empty Google Sheet. **Share** it with the service account's `client_email` (for example `exam-sync@project.iam.gserviceaccount.com`) as **Editor**.
4. Copy the Sheet ID from its URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.
5. In the app, go to **Settings → Backend sync**:
   - Backend type: **Google Sheets**
   - Google Sheet ID: `<SHEET_ID>`
   - Google service account JSON: paste the entire key file, or set the `GOOGLE_SERVICE_ACCOUNT_JSON` environment variable
   - Sheet names: keep the defaults or rename them
   - Save, then click **Test connection** → **Create sheets / lists** → **Full resync**.

The app creates eight tabs: Candidates, Exam Attempts, Exam Results, Aptitude Answers, Communication Answers, Question Bank, Communication Question Bank and Audit Log. It writes the header row, then updates or appends rows using the last column, **Sync Key**. Do not edit or remove the Sync Key column. Other columns can be formatted freely, but any edits made in the sheet are overwritten at the next sync.

Authentication uses an RS256 JWT signed with the service-account key and exchanged at `oauth2.googleapis.com/token`, scope `https://www.googleapis.com/auth/spreadsheets`. The SDK is not required.

## B. Microsoft SharePoint (Microsoft Graph)

1. In **Microsoft Entra admin centre → App registrations → New registration**, create an app, for example "Exam System Sync". Note the **Directory (tenant) ID** and the **Application (client) ID**.
2. Under **Certificates & secrets → New client secret**, copy the secret **value**.
3. Under **API permissions → Add → Microsoft Graph → Application permissions**, add **`Sites.Selected`** (recommended) or `Sites.ReadWrite.All`, then **Grant admin consent**.
4. If you use `Sites.Selected`, grant the app write access to the recruitment site. An admin runs this once, for example in Graph Explorer:
   ```http
   POST https://graph.microsoft.com/v1.0/sites/{site-id}/permissions
   { "roles": ["write"], "grantedToIdentities": [{ "application": { "id": "<client-id>", "displayName": "Exam System Sync" } }] }
   ```
   (`GET https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/Recruitment` returns the site id.)
5. In the app, go to **Settings → Backend sync**:
   - Backend type: **SharePoint**
   - Site URL: `https://contoso.sharepoint.com/sites/Recruitment`
   - Tenant ID, Client ID, Client secret (or set the `SHAREPOINT_CLIENT_SECRET` environment variable)
   - List names: defaults are Candidate Master, Exam Results, Aptitude Responses, Communication Responses, Question Bank, Communication Question Bank, Audit Log and Exam Attempts
   - **Test connection** → **Create sheets / lists** → **Full resync**.

Lists are created as custom lists. Columns are single-line text, or multi-line for long text such as answers, feedback and details. The list **Title** holds the record key, and Candidate ID is present on every list as the relationship field. Upserts find the existing item by Title. For large lists (over 5,000 items), index the **Title** column in list settings.

## C. Email (SMTP / Microsoft 365 / Gmail)

Go to Settings → Email and set:

- Transport: **SMTP / Microsoft 365**
- From address
- Host and port:
  - Microsoft 365: `smtp.office365.com`, port 587, *implicit TLS* **off**. The sending mailbox must have *Authenticated SMTP* enabled.
  - Gmail / Google Workspace: `smtp.gmail.com`, port 587, using an app password.
  - Other relays: port 465 with *implicit TLS* **on**.
- Username and password (or the `SMTP_PASSWORD` environment variable)
- HR notification address(es)

Click **Send test email**. With the transport set to **Log only**, nothing is sent; emails are recorded in the outbox shown in Settings, which is useful for testing.

| Email | Recipient | When |
|---|---|---|
| Exam invitation | Candidate | On assignment, retake approval, new link, or exam reset. Includes name, position, link, access code, duration, expiry and instructions |
| Exam submitted | HR address(es) + the assigning recruiter | On submission (aptitude score, communication under evaluation, tab switches) |
| Exam completed – result | HR address(es) + the assigning recruiter | On finalisation (all scores and final status) |
| Completion confirmation | Candidate | On submission (can be switched off) |

## D. AI evaluation

Go to Settings → AI evaluation and set:

- Provider: **Claude (Anthropic)**, **OpenAI** or **Rule-based**
- Model: the defaults are `claude-sonnet-4-5` and `gpt-4o-mini`. Enter any model name your account can use.
- API key (or the `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` environment variable)
- *Evaluate automatically on submission*, and *Fall back to rule-based* if the call fails

Use **Test anthropic / Test openai** to score a sample answer and view the JSON. Evaluators can also re-run evaluation for one exam with a chosen provider from the Evaluate page. Manual scores are never overwritten. See `SCORING.md` for the prompt contract.

Endpoints can be overridden with `ANTHROPIC_BASE_URL`, `OPENAI_BASE_URL`, `GOOGLE_SHEETS_BASE_URL`, `GOOGLE_TOKEN_URL`, `MS_LOGIN_BASE_URL` and `MS_GRAPH_BASE_URL`. This supports proxies, sovereign clouds and the test mocks.
