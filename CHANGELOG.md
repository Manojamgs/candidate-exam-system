# Changelog

## 1.2.0 – Company branding & emailing exam links

### Online deployment
- `render.yaml` Blueprint (Node 22, persistent disk for the database, generated `APP_SECRET`, health check) and the step-by-step guide [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md).
- Exam links automatically use Render's public HTTPS URL, and the proxy is trusted on Render. The database is closed cleanly on shutdown so a redeploy loses nothing.

### Email exam link
- **Email link** action on every Assigned / In Progress exam (candidate page), and an **Email this link** panel in every dialog that shows a link (assignment, new link, reset, retake approval, reschedule approval).
- Send to the candidate (default) or another address, CC up to 5 colleagues, add a personal message, and choose whether the access code is included (it can be shared separately, e.g. by phone).
- The email uses the standard branded invitation; the dialog shows the delivery result (sent / failed and retried / log-only mode).
- **Open in my email app** creates a pre-filled draft in Outlook or Mail (mailto) for sending from a personal mailbox.
- Links and access codes are now stored encrypted (AES-256-GCM) alongside their hashes so the same link can be re-sent without invalidating it. Links issued before v1.2 are re-issued on first send, after explicit confirmation.
- Viewing and emailing a link are audit-logged (`EXAM_LINK_VIEWED`, `EXAM_LINK_EMAILED` with recipients). Cancelled / voided exams have their stored link wiped.
- API: `GET /api/exams/:id/link`, `POST /api/exams/:id/send-link`.

### Company branding (Settings → Branding)
- Upload the company logo (SVG, PNG, JPEG or WebP, ≤ 512 KB). It appears in the staff sidebar, the sign-in page, the candidate portal (every screen and the exam header), the favicon, emails (PNG/JPEG, embedded so it shows even when images are blocked) and PDF reports (PNG/JPEG).
- Primary and accent colours, application title and subtitle. All UI colours are CSS tokens served from `/brand/theme.css`; text colour on the brand colours is chosen automatically for contrast.
- Security: file type is detected from content (not the declared type); SVGs containing scripts, event handlers, external references or embedded HTML are rejected; the logo is served with `nosniff` and a sandboxed CSP.

## 1.1.0 – Skills, Programming section, Scheduling & Rescheduling

### Candidate skills
- Candidates list several skills, each with a proficiency level (Beginner, Intermediate, Advanced or Expert) and years of experience. This happens on a new **Your skills** step before the instructions. It is required when the exam has a programming section, and can be switched on or off for other exams.
- HR can also view and edit skills on the candidate page. Each skill records whether the candidate or HR entered it.
- Skills are validated (a level is required, years must be 0–50, at most 25 skills, duplicates removed regardless of case) and every change is audit-logged.
- Skills are synced as a Candidate Skills sheet or list and as a *Skills* column on the Candidate Master.

### Programming section (new exam type `APT-COMM-PRG`)
- **Section 3 – Programming:** 10 written code tasks in one language: write code, fix a bug, predict the output, or complete given code. Each task is worth 10 marks, for 100 in total.
- **Six languages:**
  - Question bank: Java, Python, JavaScript, C#, SQL and Salesforce Apex, each with **5 sets × 10 questions** (300 questions). Every set has 3 Easy, 5 Medium and 2 Hard questions.
  - Uniqueness: no question is repeated within a language.
  - Verification: reference solutions were executed against their test cases (Java, Python, JavaScript, C# and SQL). Apex was checked by hand twice, since no compiler is available.
- **Choosing the language:**
  - By default the candidate chooses it from their declared skills; the system matches common names such as "Salesforce" → Apex and "C Sharp" → C#.
  - HR can instead fix the language when assigning the exam (Settings → Assignment).
- **Set rotation:** each language rotates through its sets, least recently used first, and a candidate never gets a set they have already taken. Retakes and rescheduled attempts use a different set.
- **Editor:** a monospace code editor. Tab indents, Enter keeps indentation, and an *Insert starter code* button is provided because pasting is disabled.
- **Confidentiality:** reference solutions, evaluation points and test cases are never sent to the candidate portal. This is verified by an automated test.
- **AI code evaluation:**
  - The rubric totals 100: correctness 40, logic 20, code quality 15, efficiency 10, edge cases 15. The AI also returns a verdict, feedback, strengths, improvements and specific issues.
  - The AI grades against the reference solution and evaluation points. It never executes code, ignores instructions written inside the answer, and has its total recalculated by the server.
  - Blank answers score 0 automatically.
  - Without AI, or if an AI call fails, programming answers wait for **manual evaluator review**. There is deliberately no heuristic scoring for code.
  - Evaluators can adjust any programming score; each criterion is validated against its maximum, and every change is kept in the history and the audit log.
- **Scoring:** results use three sections when programming is included. Default weights are 40/30/30, the programming minimum is 60%, and both are configurable.
- **Timer:** the programming section adds 45 minutes (configurable). Separate section timers now work for any number of sections in order.
- **Reporting:**
  - Dashboard: average programming score by language.
  - Results: programming columns.
  - Evaluate page: code review with the reference solution.
  - Result page: a programming rubric chart and a topic breakdown.
  - PDF report: a Programming Result section and a Programming Responses page.
  - Exports: programming evaluations, the programming question bank and skills.
  - Sync: to Google Sheets and SharePoint.

### Scheduling
- An exam can be assigned with **Available from** and **Link expires** dates and times. Before the window opens, candidates see a countdown, and starting returns `425 NOT_YET_OPEN`. The window is validated: it must be in the future, expire after it opens, and open no more than 180 days ahead.

### Reschedule workflow (technical issues)
- **HR raises a request.** Each request records:
  - a reason category: internet outage, power failure, device failure, browser/system error, platform issue, medical/personal emergency, or other
  - a description, the incident time and an evidence reference
  - the requested action:
    - **Resume with extra time** (exam in progress)
    - **New link / new window** (exam not started)
    - **New attempt on a different set** (exam started or finished)
- **System diagnostics are captured automatically** with each request: connection losses, resumes and logins, distinct IPs, last autosave, answers saved, time used and a session timeline.
- **An Admin approves or rejects it:**
  - HR cannot approve.
  - Segregation of duties: an Admin cannot approve their own request unless Settings allow it.
  - Rejecting requires notes.
  - Approval is refused if the exam's state has changed since the request.
  - A per-candidate limit applies, with an explicit override.
- **Approving a new attempt:**
  - The interrupted attempt is **voided** and kept for audit.
  - It does not count toward the attempt limit (configurable).
  - A fresh attempt is created on different sets and linked back to the original.
- **Notifications:** Admins are emailed about new requests. The requester and HR are emailed the decision, and the candidate gets a new invitation or a "you can resume" email.
- **Records:** requests can be withdrawn. Nothing is deleted, and every request, decision, void and new attempt is audit-logged, synced and exportable.
- There is a new **Reschedule Requests** page, and a **Request reschedule** action on each exam in the candidate history.

### Other
- Additive database migrations run automatically on start, so existing databases keep all their data.
- New settings: programming weights and minimum, programming minutes, default exam type, who chooses the language, skills collection, and rescheduling rules.
- Tests: 50 automated tests, including 13 new ones for skills, programming, scheduling and rescheduling.

## 1.0.0
- Initial release: aptitude and communication examination, six sets, AI and manual evaluation, Google Sheets / SharePoint sync, email, exports, audit.
