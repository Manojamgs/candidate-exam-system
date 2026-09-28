# REST API

Base path: `/api`. All requests and responses use JSON. Authentication uses cookies set by the login endpoints.

- **Every non-GET request must include `X-Requested-With: cexs`** (the CSRF guard).
- Errors return `{ "error": "message", "code": "OPTIONAL_CODE" }` with a matching HTTP status: 400 validation, 401 not signed in, 403 forbidden, 404 not found, 409 state conflict, 410 expired.

## Candidate portal (`/api/candidate`)

| Method & path | Body | Description |
|---|---|---|
| GET `/link-info` | — | Whether an access code is required, plus the company name |
| POST `/login` | `{ token, access_code }` | Validates the link and code and starts the candidate session (revokes any other session for this exam). Returns 401 for a bad code, 404 for an invalid link, 410 for an expired or cancelled exam, 403 with `RESUME_BLOCKED` if resume is disabled |
| GET `/state` | — | Profile, exam info, status, timing, instructions, client configuration, progress, `skills` (required, levels, current), `programming` (language, choice mode, available languages), `available_from`, `blockers` (NOT_YET_OPEN / SKILLS_REQUIRED / LANGUAGE_REQUIRED) |
| POST `/skills` | `{ skills: [{skill, level, years}], programming_language? }` | Declare skills and choose the programming language (before the exam starts only) |
| POST `/start` | `{ agree: true }` | Accepts the instructions and starts the timer. Returns 425 `NOT_YET_OPEN` before the window opens; 409 if skills or the language are missing |
| GET `/paper` | — | Questions (no answer keys), shuffled options, saved answers and timing |
| POST `/answers` | `{ aptitude: [{id, answer:'A'-'D'|null, review}], communication: [{id, text, review}], programming: [{id, text, review}], reason }` | Autosave. Returns `{ saved, rejected, saved_at, timing }`. After submission or time-up returns 409 `LOCKED` / `TIME_UP` |
| POST `/section/next` | — | Sectional mode only: closes the current section and starts the next one's timer |
| POST `/events` | `{ type, details }` | Integrity event. `type` is one of `tab_hidden, window_blur, copy_attempt, paste_attempt, cut_attempt, right_click, fullscreen_exit, devtools_key, back_navigation, reload_attempt, offline, online` |
| POST `/submit` | `{ answers?, reason: 'manual'|'timer' }` | Final submission (idempotent for timer submits). A second manual submit returns 409 `ALREADY_SUBMITTED` |
| GET `/result` | — | Finalised result, only if Admin enabled it; correct answers only if also enabled |

## Staff API

### Auth
`POST /auth/login {username, password}` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password {current_password, new_password}`

### Dashboard & monitoring
- `GET /dashboard`: candidate, exam and score statistics, exam-set usage, category accuracy, recent activity, sync status.
- `GET /monitor`: live assigned and in-progress exams (time left, progress, tab switches, last seen) and recent integrity events.

### Candidates
| | |
|---|---|
| GET `/candidates?q=&candidate_code=&name=&email=&mobile=&position=&department=&recruiter=&exam_set=&exam_status=&candidate_status=&result=&filter=passed|failed|pending|completed|not_started|under_evaluation&date_from=&date_to=&sort=&dir=&limit=&offset=` | Search |
| POST `/candidates` | Create (first_name, last_name, email required; all Candidate Master fields accepted) |
| GET `/candidates/:id` | Record, exam history, activity |
| PUT `/candidates/:id` | Update (audit-logged with before/after values) |

### Exams
| | |
|---|---|
| GET `/exam-sets` | Sets with usage and readiness |
| POST `/candidates/:id/assign` `{method?: manual|automatic|random, set_id?, retake_reason?}` | Assign. Returns `exam_id, exam_code, exam_set, attempt, link, access_code, expires_at, warnings, pending_approval` |
| POST `/exams/:id/approve-retake` | Admin only |
| POST `/exams/:id/regenerate-link` `{resend?}` | New link and access code (the old one stops working) |
| GET `/exams/:id/link` | Current link and access code for an Assigned / In Progress exam (`available: false` for links issued before v1.2). Audit-logged |
| POST `/exams/:id/send-link` `{to?, cc?, message?, include_access_code?, regenerate?}` | Email the link. `to` defaults to the candidate; `cc` is a comma/semicolon list (max 5); `message` ≤ 2000 chars. Returns `recipients` and per-email outbox `status`. 409 `REGENERATE_REQUIRED` for a pre-v1.2 link unless `regenerate: true` |
| POST `/exams/:id/reset-session` `{extendMinutes?}` | Allows the candidate to resume once and optionally extends the time |
| POST `/exams/:id/reset` `{reason}` | Clears the answers and re-issues a fresh, reshuffled paper |
| POST `/exams/:id/force-submit` | Submits on the candidate's behalf (`submission_type = admin`) |
| POST `/exams/:id/cancel` `{reason}` | Cancels a not-yet-started exam |
| GET `/exams/:id` | Full detail: candidate, exam, result, aptitude answer sheet, communication answers with evaluation history, audit trail |

### Skills, programming & scheduling
| | |
|---|---|
| PUT `/candidates/:id/skills` `{skills:[{skill, level, years, category?}]}` | HR records skills |
| POST `/candidates/:id/assign` also accepts `{exam_type: 'APT-COMM'|'APT-COMM-PRG', programming_language?, programming_set?, available_from?, expires_at?}` | Assign with a programming section and/or a schedule window |
| GET `/exam-types` · GET `/programming/languages` · POST `/programming/languages` `{key, label, active}` | Types, languages and set readiness |
| GET/POST `/programming/questions`, PUT/DELETE `/programming/questions/:id` | Programming question bank (filters: `language, set_number, difficulty, task_type, active, q`) |
| PUT `/evaluation/programming-answers/:answerId` `{correctness≤40, logic≤20, code_quality≤15, efficiency≤10, edge_cases≤15, verdict?, comments?}` | Manual programming score (audit-logged) |

### Reschedule requests
| | |
|---|---|
| POST `/exams/:id/reschedule-requests` `{reason_category, description, requested_option: resume_extra_time|new_link|new_attempt, extra_minutes?, proposed_start?, proposed_expiry?, incident_at?, evidence_notes?}` | HR or Admin raises a request (one pending per exam; system evidence captured) |
| GET `/reschedules?status=&candidate_id=&q=` · GET `/reschedules/:id` | List or view (includes `reasons` and `options` metadata) |
| POST `/reschedules/:id/approve` `{decision_notes?, extra_minutes?, proposed_start?, proposed_expiry?, override_limit?}` | Admin only; not the requester unless self-approval is enabled. Returns the new link or access code where applicable |
| POST `/reschedules/:id/reject` `{decision_notes}` · POST `/reschedules/:id/withdraw` | Reject (notes required) or withdraw |

### Results & evaluation
| | |
|---|---|
| GET `/results?q=&exam_set=&result=&status=pending|finalized&date_from=&date_to=` | Submitted attempts |
| POST `/evaluation/exams/:id/run` `{force?, provider?}` | Run AI or rule evaluation (manual scores are preserved) |
| PUT `/evaluation/answers/:answerId` `{grammar, vocabulary, clarity, structure, professional, comments?}` | Manual score (each 0–20). Audit-logged |
| PUT `/evaluation/exams/:id/comments` `{comments}` | Overall evaluator comments |
| POST `/evaluation/exams/:id/finalize` `{comments?}` | Finalise PASS/FAIL (all answers must be evaluated) |
| POST `/evaluation/exams/:id/reopen` `{reason}` | Admin only |

### Question bank
`GET/POST /questions/aptitude`, `PUT/DELETE /questions/aptitude/:id` (filters: `exam_set, category, difficulty, active, q`) · `GET/POST /questions/communication`, `PUT/DELETE /questions/communication/:id` · `POST /exam-sets`, `PUT /exam-sets/:id` · `GET /exam-types`

Deleting a question that has exam history deactivates it instead. Editing the scoring-relevant fields of a question that has been used returns 409 `LOCKED`.

### Reports & export
- `GET /export/:dataset?format=csv|xlsx|pdf&…filters`, where the dataset is `candidates | results | communication | aptitude | programming | skills | reschedules | audit | questions | communication_questions | programming_questions`.
- `GET /reports/exam/:id.pdf[?download=1]`: the Complete Candidate Report.

### Audit, settings, integrations, users
- `GET /audit?q=&event=&date_from=&date_to=&limit=&offset=`
- `GET /settings` (Admin and HR; secrets are masked) · `PUT /settings {key: value, …}` (Admin; validated; audit-logged)
- `POST /integrations/test` · `/integrations/provision` · `/integrations/sync-now` · `/integrations/full-sync` · `/integrations/test-email {to}` · `/integrations/test-ai {provider}` (Admin)
- `GET/POST /users`, `PUT /users/:id` (Admin)

### Branding
- Public: `GET /api/brand` (company, title, subtitle, logo URL, colours) · `GET /brand/theme.css` · `GET /brand/logo`
- Admin: `PUT /branding/logo {data_url, file_name}` (SVG/PNG/JPEG/WebP, ≤ 512 KB) · `DELETE /branding/logo`. Colours and titles are ordinary settings (`branding.*`).

### Health
`GET /api/health` returns `{ ok: true, time }`.
