# Candidate Aptitude & Communication Examination System

A web-based recruitment assessment platform (v1.2 – see [CHANGELOG](CHANGELOG.md)). HR registers candidates and assigns one of six exam sets. Candidates take a timed online exam with 20 aptitude (multiple-choice) and 10 written communication questions. The system scores aptitude automatically and evaluates the written answers with AI or rule-based scoring. Evaluators can review and adjust scores. The system then calculates pass/fail, and every record can be synchronised to Google Sheets or Microsoft SharePoint.

| | |
|---|---|
| **Stack** | Node.js 20+ · Express · SQLite (better-sqlite3) · vanilla-JS responsive web UI (no build step) |
| **Roles** | Admin/HR (full), HR (no settings/users), Evaluator, Candidate (secure link + access code) |
| **Question bank** | 6 sets × (20 aptitude + 10 communication) = **180 unique questions**, with answer keys and explanations; plus **300 programming questions**: Java, Python, JavaScript, C#, SQL, Salesforce Apex × 5 sets × 10 |
| **Programming section** | Optional exam type: candidate declares skills, chooses a language, and answers 10 written code tasks that AI evaluates against a reference solution (evaluator review as fallback) |
| **Scheduling & rescheduling** | Exam windows (available from / expires); HR raises reschedule requests with auto-captured diagnostics, and an Admin approves (resume + extra time, new window, or new uncounted attempt on a different set) |
| **AI evaluation** | Pluggable: Claude (Anthropic), OpenAI, or the built-in offline rule engine (automatic fallback) |
| **Backends** | Local database (always) + optional sync to **Google Sheets** or **SharePoint Lists** |
| **Exports** | Excel, CSV and PDF for every dataset, plus a per-candidate Complete Candidate Report (PDF) |
| **Branding & email links** | Company logo and colours (Settings → Branding) across console, candidate portal, emails and PDFs; staff can email the exam URL to the candidate or others, with CC and a personal message |
| **Tests** | 52 automated tests covering the workflow end to end, plus Playwright browser smoke tests |

---

## 1. Quick start (local)

```bash
# Requires Node.js 20 or newer (22 LTS recommended)
cd candidate-exam-system
npm install
cp .env.example .env          # then edit: set APP_SECRET, ADMIN_PASSWORD, APP_BASE_URL=http://localhost:3000, NODE_ENV=development
npm start                     # creates data/exam.db, the admin user and loads the 6 exam sets
```

Open **http://localhost:3000** and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env` (defaults: `admin` / `ChangeMe@123` if unset). Change the password after your first sign-in (top bar → **Password**).

Optional demo data (12 candidates in every workflow state, 2 demo staff users):

```bash
npm run seed:demo     # on an empty database only; staff logins: hr.demo / evaluator.demo, password Demo@Pass2026
```

Candidates never use the staff console. They open the personal link in their invitation email (`/exam/?t=…`) and enter the 6-character access code.

### npm scripts

| Script | Purpose |
|---|---|
| `npm start` | Start the server (background jobs: auto-submit sweeper, sync worker, email retry) |
| `npm run dev` | Start with auto-reload |
| `npm test` | Run the full automated test suite (unit, end-to-end workflow, integrations, timers) |
| `npm run seed` | Load or refresh the seed question bank (idempotent) |
| `npm run seed:demo` | Load demo candidates and results |
| `npm run reset -- --yes` | Delete the database (irreversible) |
| `npm run export:answer-keys` | Regenerate `docs/ANSWER_KEYS.md` and `docs/QUESTION_BANK.xlsx` |

---

## 2. What is included (deliverables map)

| # | Requirement | Where |
|---|---|---|
| 1 | Complete application | `server/`, `public/` |
| 2 | Database / data model | `server/db/schema.sql`, [docs/DATA_MODEL.md](docs/DATA_MODEL.md) |
| 3–6 | Six exam sets, 120 aptitude + 60 communication questions, answer keys | `seed/questions/set-01…06.json`, [docs/ANSWER_KEYS.md](docs/ANSWER_KEYS.md), `docs/QUESTION_BANK.xlsx` |
| v1.1 | Skills, 300 programming questions + reference solutions, AI code evaluation, scheduling, reschedule approval | `seed/programming/*.json`, [docs/PROGRAMMING_BANK.md](docs/PROGRAMMING_BANK.md), `server/services/programming.js`, `reschedule.js`, `scripts/verify/` |
| 7 | Communication scoring framework | [docs/SCORING.md](docs/SCORING.md) |
| 8–9 | Admin dashboard, candidate portal | `public/js/pages/*`, `public/exam/*` |
| 10–14 | Timer, autosave, auto-scoring, AI evaluation, manual evaluation | `server/services/examEngine.js`, `results.js`, `evaluation/` |
| 15–16 | Google Sheets + SharePoint integration | `server/services/sync/`, [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) |
| 17 | Email notifications | `server/services/email.js` |
| 18–19 | PDF report, Excel/CSV export | `server/services/exports.js` |
| 20–21 | Audit logging, security controls | `server/lib/audit.js`, [docs/SECURITY.md](docs/SECURITY.md) |
| 22–23 | Setup / configuration, API docs | this file, [docs/API.md](docs/API.md), [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) |
| 24–25 | Test data, end-to-end testing | `scripts/seed-demo.js`, `tests/`, [docs/TEST_REPORT.md](docs/TEST_REPORT.md) |
| — | How-to for HR, evaluators and candidates | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |

---

## 3. Workflow

```
Candidate Created → Exam Assigned (exam type; set chosen: manual / least-recently-used / random; optional schedule window; paper randomised server-side)
→ Invitation email (unique expiring link + access code) → Candidate opens link → authenticates with access code
→ [window not open yet → countdown] → Your skills (several, with level & years) + programming language → Instructions
→ "I Agree & Start Examination" → timer starts (server-authoritative)
→ Aptitude → Communication → [Programming] → Review (answered x of 30/40, unanswered highlighted) → Submit
   (technical issue? HR raises a reschedule request → Admin approves: resume + extra time / new window / new uncounted attempt)
→ Attempt locked → Aptitude auto-scored → Communication (AI / rule-based) and Programming (AI; otherwise evaluator) evaluated in the background
→ Evaluator reviews / adjusts / comments → Finalise → PASS/FAIL → candidate record + backend sync → HR email
→ Result available (to candidates only if Admin enables it)
```

Status values used on the Candidate Master: New, Shortlisted, Exam Assigned, Exam Started, Exam Completed, Under Evaluation, Passed, Failed, Selected, Rejected, On Hold.

---

## 4. Configuration (Admin → Settings)

Everything below is configurable at runtime. No restart is needed.

- **Scoring and passing:** section weights (default 50/50, or 40/30/30 when programming is included, all normalised to 100). Minimum programming score (default 60%). Minimum aptitude, communication and overall scores (default 60% each; every minimum is mandatory). Whether an evaluator must finalise each result.
- **Timer and exam:**
  - Combined timer (default 60 min) or separate section timers (default 30 + 30 min).
  - Network grace period and autosave interval.
  - Resume allowed or not.
  - Randomisation of questions and options.
  - Copy/paste blocking and tab-switch warning limit.
  - Whether IP address and browser are recorded.
  - Whether results and correct answers are shown to candidates.
- **Assignment and attempts:** assignment method, link expiry (default 7 days), access code required, maximum attempts (default 2), retakes allowed, retake approval, and whether a retake must use a new set.
- **Programming & skills:** default exam type; whether the candidate or HR chooses the language; whether skills are collected and the minimum number; programming minutes (default 45); AI evaluation of code.
- **Rescheduling:** on or off, self-approval (off by default for segregation of duties), limit per candidate, default extra minutes, and whether a voided attempt counts.
- **AI evaluation:** provider, model names, API keys (stored encrypted), evaluation on submit, and fallback to the rule engine.
- **Backend sync:** Google Sheets or SharePoint connection details and sheet or list names, plus buttons to *test*, *create sheets/lists*, *sync now* and run a *full resync*.
- **Branding:** logo, primary/accent colours, title and subtitle.
- **Email:** log-only or SMTP / Microsoft 365, sender address, HR notification addresses, and a test email.
- **Users:** create staff accounts, assign roles, reset passwords and deactivate accounts.

Secrets can also be supplied as environment variables (see `.env.example`); environment values take precedence and are never shown in the UI.

---

## 5. Production deployment checklist

**Quickest route online:** Render + GitHub. See [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md); `render.yaml` is included.

1. Put the app behind HTTPS: a reverse proxy (nginx, IIS, Azure App Service, and so on) with `TRUST_PROXY=true` and `SECURE_COOKIES=true`, or set `TLS_CERT_PATH` / `TLS_KEY_PATH`.
2. Set `NODE_ENV=production`, a long random `APP_SECRET` (the server refuses to start without one), `APP_BASE_URL` (used in exam links) and a strong `ADMIN_PASSWORD`.
3. Keep `DB_PATH` on persistent storage and back up the `.db` file daily. SQLite in WAL mode is safe to copy with `sqlite3 exam.db ".backup backup.db"`.
4. Configure SMTP (Settings → Email) and send a test email.
5. Configure the AI provider and run *Test anthropic* / *Test openai*. Rule-based scoring is used if no key is set.
6. Configure Google Sheets or SharePoint, then run *Test connection* → *Create sheets / lists* → *Full resync*.
7. Review the question bank, deactivate anything not suitable for your roles, and set the passing criteria.
8. Update your candidate privacy notice to cover recorded activity (tab switches, IP address and browser). Both can be switched off.
9. Docker: `docker compose up -d --build` (data is kept in the `exam-data` volume).

Scaling note: SQLite comfortably handles hundreds of concurrent candidates on one server. For multi-server deployments, move to PostgreSQL. The data-access layer is plain SQL in `server/services/*`, and the schema is portable.

---

## 6. Project structure

```
server/
  index.js            HTTP(S) server + background jobs      app.js     Express app (security headers, routes)
  config.js           environment configuration              db/        schema.sql, connection, seed loader
  lib/                settings (encrypted secrets), audit, ids, crypto, utils
  middleware/auth.js  sessions, roles/permissions, CSRF guard
  routes/staff.js     Admin/HR/Evaluator API                 routes/candidate.js   Candidate portal API
  services/           candidates, assignment, examEngine, results, evaluation/{rule,ai}, questions, email, exports, sync/{googleSheets,sharepoint}
public/
  index.html, js/app.js, js/pages/*   staff console (15 pages)      exam/   candidate portal
seed/questions/       6 exam-set JSON files (+ QUESTION_SPEC.md)
scripts/              seed, demo data, reset, answer-key export
tests/                node:test suites + mocks (Google, Graph, SMTP, AI) + browser smoke tests
docs/                 data model, API, integrations, scoring, security, user guide, test report, answer keys
```

## 7. Extending: new exam types and sets

- **More sets:** go to Question Bank → *New exam set* (for example SET-07) and add 20 aptitude and 10 communication questions. The set becomes assignable automatically once it is complete. Nothing is hard-coded to six sets.
- **New exam types** (Technical, Salesforce, English, …): add a row to `exam_types`. Its `config.sections` list defines each section's key, label, kind (`mcq` or `written`) and question count. The assignment logic, randomisation, timer, scoring and reporting are driven by that configuration. The admin UI currently manages the default type; the API accepts `exam_type_id` on assignment.

## 8. Known limitations

- **Browser controls deter misconduct but cannot prevent it.** No web application can fully stop cheating, so the controls are designed to deter and record: copy/paste blocking, tab-switch detection, single active session and so on. Candidates can still use a second device. Treat recorded signals as prompts for review, not as proof.
- **The rule-based evaluator is a heuristic.** It uses surface features and is meant as a safety net. For hiring decisions use AI evaluation with a human review, which the finalisation step enforces by default.
- **Integration tests use mocks.** Google Sheets, SharePoint, SMTP and the AI providers were tested against protocol-faithful mock servers. Run *Test connection* and a *Full resync* against your real tenant before go-live.
