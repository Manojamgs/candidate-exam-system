# Security & Integrity Controls

## Application security

| Control | Implementation |
|---|---|
| Authentication | Staff: username or email with a bcrypt-hashed password. Accounts lock after 5 failed attempts for 15 minutes (configurable), and login is rate-limited. Candidates: a unique 256-bit link token plus a 6-character access code. Both are stored only as HMAC-SHA256 hashes. |
| Sessions | Random 256-bit tokens in `HttpOnly`, `SameSite=Strict` cookies (`Secure` in production). Only a hash is stored server-side. Staff sessions end after 30 minutes idle (configurable). Changing a password or deactivating a user revokes that user's sessions. |
| Role-based access | Admin: everything. HR: candidates, exams, questions, evaluation and reports, but no settings or users. Evaluator: results and evaluation. Every route checks permissions on the server. |
| CSRF | SameSite=Strict cookies, plus a mandatory `X-Requested-With: cexs` header on every state-changing request. |
| Exam links | Unique per attempt and expiring (default 7 days). *New link* invalidates the previous one. Links are cancelled on cancellation or reset. |
| Answer confidentiality | Correct answers, explanations and marks are never sent to the candidate portal (verified by an automated test). Scoring and validation happen only on the server. |
| Duplicate-submission prevention | Submission is an atomic `UPDATE … WHERE status = 'In Progress'`. Concurrent submits produce exactly one success (verified by test). After submission all answer writes return `409 LOCKED`. |
| Single active session | Opening the exam in a second browser revokes the first session, which then shows "opened elsewhere". Resuming after closing the browser can be disallowed; an Admin/HR *Reset session* allows it once. |
| Secrets | API keys, the service-account JSON, the client secret and the SMTP password are AES-256-GCM encrypted at rest, keyed from `APP_SECRET`. They are never returned to the browser (masked as *configured*). Environment variables take precedence. |
| Transport | HTTPS through a reverse proxy (`TRUST_PROXY`, `SECURE_COOKIES`) or native TLS (`TLS_CERT_PATH`/`TLS_KEY_PATH`). HSTS is sent when secure cookies are on. |
| Headers | Helmet: a strict Content-Security-Policy (`script-src 'self'`, no inline scripts, `frame-ancestors 'none'`), `nosniff`, referrer policy. `Cache-Control: no-store` on all API responses. |
| Output encoding | The UI inserts user data as text nodes or escaped HTML. CSV and Excel exports neutralise formula injection (`=`, `+`, `-`, `@`). |
| Audit | Every significant action is logged with actor, IP address, browser and JSON details: logins, candidate changes, assignment, start, resume, integrity events, submission, scoring, evaluation, manual adjustments, finalise and reopen, exports, settings changes and email delivery. The log is exposed read-only in the UI and exports. |
| Auditability of questions | A question that has appeared in an attempt cannot have its text, options, answer or marks edited, and cannot be deleted; it can only be deactivated. This keeps historical results reproducible. |

- **Exam links (v1.2):** tokens and access codes are stored as HMAC hashes for verification plus an AES-256-GCM encrypted copy (key derived from `APP_SECRET`) so staff with the *exams* permission can re-send the same link. Every view or email of a link is audit-logged with recipients; the encrypted copy is erased when an exam is cancelled or voided, and ignored once a link is regenerated.
- **Logo uploads (v1.2):** Admin only, ≤ 512 KB, type detected from file content, SVGs with scripts/event handlers/external references/embedded HTML rejected, and served with `X-Content-Type-Options: nosniff` and a sandboxed `Content-Security-Policy`. The logo is only rendered through `<img>`, where SVG scripts cannot run.

## Browser-level integrity controls (deterrents, not guarantees)

A browser cannot fully prevent cheating. A candidate can use a second device, another person or a phone camera. These controls **deter and record** behaviour so the recruitment team can review it:

| Control | Behaviour |
|---|---|
| Copy / cut / paste / drag-drop / right-click | Blocked in the exam window (configurable). Each attempt is recorded. |
| Tab switch or window hidden | Counted on the attempt (`tab_switch_count`) and logged. The candidate sees a warning on return, and a final warning after the configured limit. |
| Window blur | Logged, throttled. |
| DevTools, refresh and print shortcuts | Suppressed where the browser allows and logged. |
| Back navigation | Trapped and logged. A leave-page prompt appears on refresh or close. |
| Offline / online | Logged. Answers are queued and saved when the connection returns. |
| Autosave | Every 15 s (configurable), and on answer change, Next/Previous, navigation, section change and tab hide. The final submission sends a full snapshot of all answers. |
| IP address / browser | Captured at exam start and on each audit event. Both can be disabled in Settings. |

Monitoring (Exam Monitoring page) shows live progress, time left, tab switches, flags, resumes, last seen and last autosave. Integrity signals appear on the result, the evaluation page and the PDF report as indicators for review. Human judgement should be applied before drawing any conclusion.

## Privacy notes

- Tell candidates in your privacy notice that exam activity, IP address and browser information are recorded. Recording IP address and browser can be switched off.
- Candidate data stays in your database and in the backend you configure. Communication answers are sent to the selected AI provider only when AI evaluation is enabled. Choose a provider and plan whose data-retention terms suit your policies, or use the offline rule engine.
- The question bank avoids protected personal information and culturally sensitive content. Communication prompts ask about work behaviour, not personal circumstances.

## Operational recommendations

- Use a unique `APP_SECRET` of 32 bytes or more and keep it in a secret store. Rotating it invalidates stored secrets and active links.
- Restrict network access to the staff console if possible, for example with a VPN or IP allow-list on `/`. Candidates only need `/exam/*` and `/api/candidate/*`.
- Back up `data/exam.db`, run `npm audit` periodically and keep Node.js on an LTS release.
- Grant SharePoint the **Sites.Selected** application permission (limited to one site) rather than Sites.ReadWrite.All. Share the Google Sheet only with the service account.
