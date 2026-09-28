-- Candidate Aptitude & Communication Examination System
-- Primary application database (SQLite). All timestamps are ISO-8601 UTC strings.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS counters (
  name  TEXT NOT NULL,
  year  INTEGER NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (name, year)
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,            -- JSON encoded
  secret     INTEGER NOT NULL DEFAULT 0, -- 1 = value is AES-GCM encrypted, never returned to clients
  updated_at TEXT NOT NULL,
  updated_by INTEGER
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','hr','evaluator')),
  password_hash TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  last_login_at TEXT,
  created_at    TEXT NOT NULL,
  modified_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash   TEXT NOT NULL UNIQUE,
  kind         TEXT NOT NULL CHECK (kind IN ('staff','candidate')),
  user_id      INTEGER REFERENCES users(id),
  exam_id      INTEGER REFERENCES exams(id),
  ip           TEXT,
  user_agent   TEXT,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  revoked      INTEGER NOT NULL DEFAULT 0,
  revoked_reason TEXT
);
CREATE INDEX IF NOT EXISTS ix_sessions_exam ON sessions(exam_id);

-- Examination types make the platform modular (Aptitude & Communication, Technical, Salesforce, ...)
CREATE TABLE IF NOT EXISTS exam_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  config      TEXT NOT NULL,           -- JSON: { sections: [{ key, label, kind: 'mcq'|'written', questionCount }] }
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  modified_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_sets (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_type_id INTEGER NOT NULL REFERENCES exam_types(id),
  code         TEXT NOT NULL UNIQUE,   -- SET-01
  name         TEXT NOT NULL,
  description  TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  modified_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aptitude_questions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT NOT NULL UNIQUE,  -- APT-S01-01
  exam_set_id    INTEGER REFERENCES exam_sets(id),
  section        TEXT NOT NULL DEFAULT 'aptitude',
  category       TEXT NOT NULL,
  topic          TEXT,
  difficulty     TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  question       TEXT NOT NULL,
  table_json     TEXT,                  -- optional data table { headers, rows }
  option_a       TEXT NOT NULL,
  option_b       TEXT NOT NULL,
  option_c       TEXT NOT NULL,
  option_d       TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A','B','C','D')),
  marks          REAL NOT NULL DEFAULT 1,
  explanation    TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  modified_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_aptq_set ON aptitude_questions(exam_set_id, active);

CREATE TABLE IF NOT EXISTS communication_questions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  code               TEXT NOT NULL UNIQUE, -- COM-S01-01
  exam_set_id        INTEGER REFERENCES exam_sets(id),
  section            TEXT NOT NULL DEFAULT 'communication',
  category           TEXT,
  question           TEXT NOT NULL,
  expected_words_min INTEGER NOT NULL DEFAULT 100,
  expected_words_max INTEGER NOT NULL DEFAULT 200,
  marks              REAL NOT NULL DEFAULT 10,
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  modified_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_comq_set ON communication_questions(exam_set_id, active);

CREATE TABLE IF NOT EXISTS candidates (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_code            TEXT NOT NULL UNIQUE, -- CAN-2026-00001
  first_name                TEXT NOT NULL,
  last_name                 TEXT NOT NULL,
  full_name                 TEXT NOT NULL,
  email                     TEXT NOT NULL,
  mobile                    TEXT,
  alternate_mobile          TEXT,
  date_of_birth             TEXT,
  nationality               TEXT,
  current_location          TEXT,
  country                   TEXT,
  city                      TEXT,
  position_applied          TEXT,
  department                TEXT,
  experience                TEXT,
  years_of_experience       REAL,
  highest_qualification     TEXT,
  university                TEXT,
  current_company           TEXT,
  current_salary            TEXT,
  expected_salary           TEXT,
  notice_period             TEXT,
  recruitment_source        TEXT,
  recruiter_name            TEXT,
  interviewer               TEXT,
  application_date          TEXT,
  candidate_status          TEXT NOT NULL DEFAULT 'New',
  exam_status               TEXT NOT NULL DEFAULT 'Not Assigned',
  exam_assigned_date        TEXT,
  exam_start_date           TEXT,
  exam_completion_date      TEXT,
  selected_exam_set         TEXT,
  aptitude_score            REAL,
  aptitude_percentage       REAL,
  communication_score       REAL,
  communication_percentage  REAL,
  total_score               REAL,
  total_percentage          REAL,
  final_status              TEXT,
  evaluator_comments        TEXT,
  created_by                INTEGER REFERENCES users(id),
  created_at                TEXT NOT NULL,
  modified_at               TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_candidates_email ON candidates(email COLLATE NOCASE);

-- One row per exam attempt (Exam Assignment + Exam Attempt)
CREATE TABLE IF NOT EXISTS exams (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_code                TEXT NOT NULL UNIQUE,   -- EXAM-2026-00001
  attempt_code             TEXT NOT NULL UNIQUE,   -- ATT-2026-00001
  candidate_id             INTEGER NOT NULL REFERENCES candidates(id),
  exam_type_id             INTEGER NOT NULL REFERENCES exam_types(id),
  exam_set_id              INTEGER REFERENCES exam_sets(id),
  attempt_number           INTEGER NOT NULL,
  status                   TEXT NOT NULL,          -- Pending Approval | Assigned | In Progress | Submitted | Under Evaluation | Evaluated | Expired | Cancelled
  assignment_method        TEXT NOT NULL,          -- manual | automatic | random
  retake_reason            TEXT,
  retake_requested_by      INTEGER REFERENCES users(id),
  retake_approved_by       INTEGER REFERENCES users(id),
  retake_approved_at       TEXT,
  token_hash               TEXT UNIQUE,
  access_code_hash         TEXT,
  link_expires_at          TEXT,
  assigned_by              INTEGER REFERENCES users(id),
  assigned_at              TEXT NOT NULL,
  invitation_sent_at       TEXT,
  instructions_accepted_at TEXT,
  started_at               TEXT,
  deadline_at              TEXT,
  timing                   TEXT,                   -- JSON: mode, durations, section deadlines, current section
  submitted_at             TEXT,
  submission_type          TEXT,                   -- manual | auto_timer | admin
  submitted_by             TEXT,
  duration_seconds         INTEGER,
  tab_switch_count         INTEGER NOT NULL DEFAULT 0,
  suspicious_event_count   INTEGER NOT NULL DEFAULT 0,
  ip_address               TEXT,
  user_agent               TEXT,
  resume_count             INTEGER NOT NULL DEFAULT 0,
  active_session_id        INTEGER,
  last_autosave_at         TEXT,
  created_at               TEXT NOT NULL,
  modified_at              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_exams_candidate ON exams(candidate_id);
CREATE INDEX IF NOT EXISTS ix_exams_status ON exams(status);

-- Server-side randomised paper for an attempt (question order + option order)
CREATE TABLE IF NOT EXISTS exam_questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id       INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  section       TEXT NOT NULL,              -- aptitude | communication
  question_id   INTEGER NOT NULL,
  display_order INTEGER NOT NULL,
  option_order  TEXT,                       -- JSON array of original letters in display order, e.g. ["C","A","D","B"]
  UNIQUE (exam_id, section, question_id)
);

CREATE TABLE IF NOT EXISTS aptitude_answers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id           INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id       INTEGER NOT NULL REFERENCES aptitude_questions(id),
  selected_answer   TEXT,                   -- ORIGINAL option letter (A-D) after un-shuffling, NULL = unanswered
  marked_for_review INTEGER NOT NULL DEFAULT 0,
  is_correct        INTEGER,
  marks_awarded     REAL,
  first_answered_at TEXT,
  answered_at       TEXT,
  change_count      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (exam_id, question_id)
);

CREATE TABLE IF NOT EXISTS communication_answers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id           INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id       INTEGER NOT NULL REFERENCES communication_questions(id),
  answer_text       TEXT,                   -- stored exactly as submitted; never modified by evaluation
  word_count        INTEGER NOT NULL DEFAULT 0,
  marked_for_review INTEGER NOT NULL DEFAULT 0,
  first_answered_at TEXT,
  answered_at       TEXT,
  UNIQUE (exam_id, question_id)
);

-- Every evaluation is kept (AI, rule-based, manual). is_current marks the one used in scoring.
CREATE TABLE IF NOT EXISTS communication_evaluations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_code    TEXT NOT NULL UNIQUE,  -- EVAL-2026-00001
  answer_id          INTEGER NOT NULL REFERENCES communication_answers(id) ON DELETE CASCADE,
  exam_id            INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  source             TEXT NOT NULL CHECK (source IN ('ai','rule','manual')),
  provider           TEXT,                  -- anthropic | openai | rule-engine | evaluator
  model              TEXT,
  grammar            REAL NOT NULL,
  vocabulary         REAL NOT NULL,
  clarity            REAL NOT NULL,
  structure          REAL NOT NULL,
  professional       REAL NOT NULL,
  total              REAL NOT NULL,         -- 0-100 rubric total
  question_score     REAL NOT NULL,         -- scaled to question marks (default 0-10)
  feedback           TEXT,
  strengths          TEXT,                  -- JSON array
  improvements       TEXT,                  -- JSON array
  evaluator_comments TEXT,
  raw_response       TEXT,
  is_current         INTEGER NOT NULL DEFAULT 1,
  created_by         INTEGER REFERENCES users(id),
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_eval_answer ON communication_evaluations(answer_id, is_current);

CREATE TABLE IF NOT EXISTS exam_results (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  result_code              TEXT NOT NULL UNIQUE,  -- RES-2026-00001
  exam_id                  INTEGER NOT NULL UNIQUE REFERENCES exams(id) ON DELETE CASCADE,
  candidate_id             INTEGER NOT NULL REFERENCES candidates(id),
  aptitude_score           REAL,
  aptitude_max             REAL,
  aptitude_percentage      REAL,
  aptitude_answered        INTEGER,
  aptitude_breakdown       TEXT,                  -- JSON category-wise performance
  communication_score      REAL,
  communication_max        REAL,
  communication_percentage REAL,
  communication_evaluated  INTEGER,
  communication_rubric     TEXT,                  -- JSON averaged rubric (grammar ... professional) /20
  final_score              REAL,
  final_status             TEXT NOT NULL,         -- Pending Evaluation | Pending Finalization | PASS | FAIL
  scoring_snapshot         TEXT,                  -- JSON weights + thresholds used
  evaluator_comments       TEXT,
  strengths                TEXT,
  improvements             TEXT,
  finalized                INTEGER NOT NULL DEFAULT 0,
  finalized_by             INTEGER REFERENCES users(id),
  finalized_at             TEXT,
  created_at               TEXT NOT NULL,
  modified_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  log_code     TEXT NOT NULL UNIQUE,
  candidate_id INTEGER,
  exam_id      INTEGER,
  user_id      INTEGER,
  actor        TEXT,                    -- username / candidate code / system
  event        TEXT NOT NULL,
  timestamp    TEXT NOT NULL,
  ip_address   TEXT,
  browser      TEXT,
  details      TEXT                     -- JSON
);
CREATE INDEX IF NOT EXISTS ix_audit_exam ON audit_log(exam_id);
CREATE INDEX IF NOT EXISTS ix_audit_candidate ON audit_log(candidate_id);
CREATE INDEX IF NOT EXISTS ix_audit_ts ON audit_log(timestamp);

CREATE TABLE IF NOT EXISTS email_outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,             -- exam_assigned | exam_completed | completion_certificate | result_finalized
  to_address  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  body_text   TEXT,
  status      TEXT NOT NULL DEFAULT 'queued', -- queued | sent | logged | failed
  error       TEXT,
  attempts    INTEGER NOT NULL DEFAULT 0,
  candidate_id INTEGER,
  exam_id     INTEGER,
  created_at  TEXT NOT NULL,
  sent_at     TEXT
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity      TEXT NOT NULL,             -- candidates | exam_results | aptitude_answers | communication_answers | aptitude_questions | communication_questions | audit_log | exams
  entity_key  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | done | failed | skipped
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sync_status ON sync_queue(status);

-- ===================== v1.1: skills, programming section, scheduling & rescheduling =====================

-- Candidate skills (multiple per candidate). Captured by HR and/or by the candidate before the exam.
CREATE TABLE IF NOT EXISTS candidate_skills (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  skill        TEXT NOT NULL,
  category     TEXT,                    -- Programming Language | Database | Platform | Framework | Tool | Other
  level        TEXT NOT NULL CHECK (level IN ('Beginner','Intermediate','Advanced','Expert')),
  years        REAL,
  source       TEXT NOT NULL DEFAULT 'hr', -- hr | candidate
  created_at   TEXT NOT NULL,
  modified_at  TEXT NOT NULL,
  UNIQUE (candidate_id, skill)
);

-- Languages available for the programming section
CREATE TABLE IF NOT EXISTS programming_languages (
  key         TEXT PRIMARY KEY,         -- java, python, javascript, csharp, sql, apex
  label       TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  modified_at TEXT NOT NULL
);

-- Written code questions: language-specific, grouped into numbered sets per language (e.g. JAVA set 3)
CREATE TABLE IF NOT EXISTS programming_questions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  code               TEXT NOT NULL UNIQUE,  -- PRG-JAVA-S1-01
  language           TEXT NOT NULL REFERENCES programming_languages(key),
  set_number         INTEGER NOT NULL,
  topic              TEXT,
  task_type          TEXT NOT NULL CHECK (task_type IN ('write_code','fix_bug','explain_output','complete_code')),
  difficulty         TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
  question           TEXT NOT NULL,
  starter_code       TEXT,
  reference_solution TEXT NOT NULL,         -- never sent to candidates
  evaluation_points  TEXT,                  -- JSON array, never sent to candidates
  test_cases         TEXT,                  -- JSON array, never sent to candidates
  expected_minutes   INTEGER NOT NULL DEFAULT 4,
  marks              REAL NOT NULL DEFAULT 10,
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL,
  modified_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_prgq_lang_set ON programming_questions(language, set_number, active);

CREATE TABLE IF NOT EXISTS programming_answers (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id           INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id       INTEGER NOT NULL REFERENCES programming_questions(id),
  answer_text       TEXT,                   -- stored exactly as submitted; never executed by the server
  line_count        INTEGER NOT NULL DEFAULT 0,
  char_count        INTEGER NOT NULL DEFAULT 0,
  marked_for_review INTEGER NOT NULL DEFAULT 0,
  first_answered_at TEXT,
  answered_at       TEXT,
  UNIQUE (exam_id, question_id)
);

-- Rubric (100): correctness 40, logic 20, code_quality 15, efficiency 10, edge_cases 15. History kept; is_current = used for scoring.
CREATE TABLE IF NOT EXISTS programming_evaluations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_code    TEXT NOT NULL UNIQUE,
  answer_id          INTEGER NOT NULL REFERENCES programming_answers(id) ON DELETE CASCADE,
  exam_id            INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  source             TEXT NOT NULL CHECK (source IN ('ai','rule','manual')),
  provider           TEXT,
  model              TEXT,
  correctness        REAL NOT NULL,
  logic              REAL NOT NULL,
  code_quality       REAL NOT NULL,
  efficiency         REAL NOT NULL,
  edge_cases         REAL NOT NULL,
  total              REAL NOT NULL,
  question_score     REAL NOT NULL,
  verdict            TEXT,                  -- correct | partially_correct | incorrect | not_attempted
  feedback           TEXT,
  strengths          TEXT,
  improvements       TEXT,
  issues             TEXT,
  evaluator_comments TEXT,
  raw_response       TEXT,
  is_current         INTEGER NOT NULL DEFAULT 1,
  created_by         INTEGER REFERENCES users(id),
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_prgeval_answer ON programming_evaluations(answer_id, is_current);

-- Reschedule / technical-issue requests (HR requests, Admin approves)
CREATE TABLE IF NOT EXISTS reschedule_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  request_code      TEXT NOT NULL UNIQUE,   -- RSR-2026-00001
  exam_id           INTEGER NOT NULL REFERENCES exams(id),
  candidate_id      INTEGER NOT NULL REFERENCES candidates(id),
  reason_category   TEXT NOT NULL,
  description       TEXT NOT NULL,
  incident_at       TEXT,
  evidence_notes    TEXT,
  system_evidence   TEXT,                   -- JSON snapshot of connection/session/autosave diagnostics at request time
  requested_option  TEXT NOT NULL CHECK (requested_option IN ('resume_extra_time','new_attempt','new_link')),
  extra_minutes     INTEGER,
  proposed_start    TEXT,
  proposed_expiry   TEXT,
  status            TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected','Withdrawn')),
  requested_by      INTEGER REFERENCES users(id),
  requested_at      TEXT NOT NULL,
  decided_by        INTEGER REFERENCES users(id),
  decided_at        TEXT,
  decision_notes    TEXT,
  resulting_exam_id INTEGER REFERENCES exams(id),
  created_at        TEXT NOT NULL,
  modified_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_rsr_status ON reschedule_requests(status);

-- v1.2 company branding (logo image; colours live in settings)
CREATE TABLE IF NOT EXISTS brand_assets (key TEXT PRIMARY KEY, mime TEXT NOT NULL, data BLOB NOT NULL,
  file_name TEXT, bytes INTEGER, updated_at TEXT NOT NULL, updated_by INTEGER);
