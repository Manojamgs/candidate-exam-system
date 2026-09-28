# Test Report

**Run date:** 28 Sep 2026 (v1.2) · **Result:** 52 of 52 automated tests passed (`npm test`, about 20 s) · Browser smoke tests passed (Chromium, desktop 1366×860 and mobile 390×844).

## How to run

```bash
npm test                                   # all automated suites
node --test tests/e2e.workflow.test.js     # a single suite
```

Each suite starts the real application in-process against its own temporary SQLite database.

External services are replaced by protocol-faithful mocks, so no real credentials are needed:

- **Google Sheets:** a v4 values/batchUpdate/append API. The service-account JWT signature is verified with a generated RSA key.
- **Microsoft Graph:** client-credentials token, sites, lists, columns and items with Title filtering.
- **SMTP:** a real SMTP server (`smtp-server`) with authentication.
- **AI providers:** Anthropic Messages and OpenAI Chat Completions.

## Coverage against the specification's pre-deployment checklist (§47)

| Required scenario | Test(s) | Result |
|---|---|---|
| At least 10 sample candidates | *HR creates 10 candidates…* (+ `seed:demo` creates 12) | ✔ |
| All 6 exam sets | *exam assignment uses all six sets (least recently used first)* | ✔ |
| Multiple attempts | *retakes: reason required, HR needs approval, new set, max attempts enforced* | ✔ |
| Incomplete answers | *C2: incomplete answers → unanswered recorded, FAIL* | ✔ |
| Timer expiry | *C3* (client request after expiry), *C4* (server sweeper, browser closed), *sectional mode … aptitude time expiry* | ✔ |
| Manual submission | *C1*, *C5*, *C8* | ✔ |
| Auto submission | *C3*, *C4*, sectional timer test; admin force-submit in *C7* | ✔ |
| AI evaluation | *C1* (Claude), *C9* (OpenAI), *C10* (AI outage → rule fallback, audit-logged) | ✔ |
| Manual score adjustment | *C8* (history preserved, answer unchanged, audit entry, re-run does not overwrite, finalised result frozen, admin reopen) | ✔ |
| Google Sheets synchronisation | *Google Sheets: provision tabs, full sync, incremental upsert*; *…failures are retried* | ✔ (mock API) |
| SharePoint synchronisation | *SharePoint: provision lists, full sync, upsert by Candidate ID* | ✔ (mock Graph) |
| Email notification | *Email: SMTP delivery of invitation, HR notifications and completion email*; outbox count in the assignment test | ✔ |
| Duplicate submission prevention | *C5: duplicate & concurrent submissions → exactly one succeeds* | ✔ |
| Candidate result generation | *C1*, *dashboard, results, exports, PDF report…*, *candidate result screen honours admin visibility settings* | ✔ |

## v1.1 – skills, programming, scheduling, rescheduling (`tests/programming.test.js`, 13 tests)

| Scenario | Result |
|---|---|
| 6 languages × 5 ready sets × 10 = 300 unique programming questions loaded; APT-COMM-PRG exam type present | ✔ |
| Candidate cannot start until skills and a language are provided; skills validated and de-duplicated; skills and language locked after start | ✔ |
| Combined timer 60 + 45 min; paper has 10 questions in the chosen language; no reference solution, evaluation points or test cases leaked | ✔ |
| AI code evaluation (9 answers), blank answer scored 0 automatically, reference solution sent to the AI only, totals recalculated by the server, programming % and 40/30/30 overall score correct | ✔ |
| Evaluator programming adjustment: maxima validated, AI evaluation kept in history, audit entry, result recalculated, finalise | ✔ |
| No AI: programming answers wait for manual review, result stays Pending Evaluation, finalise blocked until scored | ✔ |
| HR-fixed language mode, candidate choice ignored; retake gets a different programming set and a different aptitude/communication set; 5 new Java candidates spread over all 5 sets | ✔ |
| HR skills editing, validation, permissions, audit | ✔ |
| Scheduling: invalid windows rejected; exam not startable before `available_from` (425); invitation shows "Available from" | ✔ |
| Reschedule, resume with extra time: evidence captured (connection lost, answers saved); duplicate pending blocked; HR cannot approve; deadline extended by exactly the granted minutes; resume allowed once even when resume is disabled; answers kept | ✔ |
| Reschedule, new attempt: self-approval blocked; rejection requires notes; original **Voided** and not counted; new attempt on different sets, linked, scheduled; old link refused; attempt limit not consumed; audit and emails | ✔ |
| Reschedule, new window for an expired, not-started exam; option validated against exam state; withdrawn, rejected and approved requests all kept | ✔ |
| Sectional timer across 3 sections: locked or not-yet-open sections reject saves; transitions in order | ✔ |
| Programming bank management: validation, lock after use, deactivate-on-delete, incomplete set not assignable, add language | ✔ |
| Exports (programming, programming questions, reschedules), PDF with programming, sync mappings for the 4 new entities | ✔ |
| Google Sheets / SharePoint mocks: 12 sheets or lists provisioned, including Programming Question Bank (300 rows) and Candidate Skills | ✔ |

## v1.2 – email exam link & branding (`tests/email-link.test.js`, 2 tests)

| Scenario | Result |
|---|---|
| Link/code stored encrypted; view returns the same link as issued; evaluator forbidden; invalid To/CC and >5 CC rejected | ✔ |
| Send to candidate + 2 CC with a personal message (HTML-escaped) over real SMTP; email contains the URL and code; send to another address without the code; audit entries with recipients | ✔ |
| Regenerated link supersedes the stored one; pre-v1.2 link needs explicit regenerate, old link then refused; email disabled → 409; cancelled exam → stored link wiped, 409 | ✔ |
| Branding colours validated (admin only), theme.css contrast-aware; SVG with script / event handler / external href / foreignObject rejected; content sniffing; 512 KB limit | ✔ |
| SVG logo served with nosniff + sandbox CSP; PNG logo embedded as CID in the invitation email and drawn in the PDF; remove logo | ✔ |

Browser (v1.2): Email link dialog (send, CC, message, status line), Branding settings with logo preview and colour pickers, branded sidebar, sign-in page and candidate portal. No JavaScript errors.

Programming seed verification (`scripts/verify/`):

- Java 50/50, Python 126 test cases, JavaScript 134 checks, C# 50/50 (Mono) and SQL 95 test cases all executed and passed. Buggy starter code for fix-bug tasks was confirmed to fail.
- Apex was checked by hand twice for syntax, SOQL and bulk safety; no compiler is available.
- Structure check: 3/5/2 difficulty per set and no near-duplicates in any language.

Browser (v1.1): skills step with language picker, instructions with the programming section, code editor (tab indent, starter-code insert), review dialog with P1–P10, reschedule review and approval, evaluation page with code review, result page with programming charts, assign dialog with programming and schedule, dashboard. No JavaScript errors.

## Additional verified behaviour

- **Security:**
  - The candidate paper never contains `correct`, `explanation` or option keys.
  - A candidate session cannot call the staff API.
  - A missing CSRF header is rejected.
  - A wrong access code gives 401; an invalid link gives 404; an expired link gives 410.
  - A regenerated link invalidates the old one.
  - Role permissions: an evaluator or HR user cannot change settings, and HR cannot manage users.
- **Integrity:** single active session (an old tab gets `SESSION_REVOKED`); resume blocking and admin session reset; tab-switch, copy and paste events counted and shown in Monitoring.
- **Timer:**
  - A combined-timer save after expiry is rejected.
  - In sectional mode, communication is locked until aptitude is finished, and aptitude is locked afterwards.
  - The move to communication happens automatically when aptitude time ends.
- **Scoring:** the specification example (70% / 75% gives 72.5%, PASS), a section minimum forcing FAIL, custom weights, and settings validation.
- **Question bank:**
  - Activation validation (all 4 options, distinct, correct answer matches an option).
  - Drafts can be saved inactive.
  - A used question's scoring fields are locked, and deleting it deactivates it instead.
  - A new set is not assignable until complete.
- **Seed data integrity:**
  - 6 sets × (20 + 10) questions, 180 unique question texts and codes.
  - Difficulty split 6/10/4 and all four categories in every set.
  - Every key is valid and has an explanation; options are shuffle-safe.
- **Answer-key verification:** an independent re-solve of all 120 aptitude questions was scripted in Python. All keys matched. The review flagged four wording ambiguities and one duplicated puzzle, and all five were corrected before release.
- **Exports:** CSV, Excel and PDF for candidates, results, communication and aptitude datasets. The Complete Candidate Report PDF has 6 pages: candidate, exam, category performance, rubric, final result, strengths and improvements, all written answers with scores, and the HR-only aptitude answer sheet.

## Browser smoke tests (`tests/browser/`)

The browser tests were run against demo data:

- **Candidate:** login with access code → instructions → start → answer and mark for review → communication with the live word count → simulated tab switch (warning shown and recorded) → review dialog ("You have answered 3 of 30 questions…" with unanswered questions highlighted) → submit → confirmation. The mobile layout was also checked.
- **Staff:** HR creates a candidate through the form → assigns the exam (credentials dialog) → evaluator saves a manual score → finalises → Monitoring, Excel download, question preview, mobile dashboard. No JavaScript errors were recorded.

## Not covered by automated tests

- **Real service connections:** tests use mocks, not real Google, Microsoft, Anthropic, OpenAI or SMTP tenants. Before go-live, run *Test connection*, *Send test email* and *Test AI* from Settings.
- **Load testing:** SQLite with WAL is expected to handle a typical recruitment batch (hundreds of simultaneous candidates) on a single server. Run a load test in your environment if you expect more.
