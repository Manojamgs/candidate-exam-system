'use strict';
const { getDb } = require('../db');
const { nowIso } = require('./util');
const { encrypt, decrypt } = require('./crypto');
const config = require('../config');

// All configurable behaviour lives here. Admin edits these on the Settings page.
const DEFAULTS = {
  // Scoring & passing criteria
  'scoring.aptitude_weight': 50,
  'scoring.communication_weight': 50,
  'scoring.aptitude_min_pct': 60,
  'scoring.communication_min_pct': 60,
  'scoring.overall_min_pct': 60,
  'scoring.require_evaluator_finalization': true,
  // Weights used when the exam includes the programming section (normalised; defaults 40/30/30)
  'scoring.prg_aptitude_weight': 40,
  'scoring.prg_communication_weight': 30,
  'scoring.prg_programming_weight': 30,
  'scoring.programming_min_pct': 60,

  // Timer
  'timer.mode': 'combined',            // combined | sectional
  'timer.total_minutes': 60,
  'timer.aptitude_minutes': 30,
  'timer.communication_minutes': 30,
  'timer.programming_minutes': 45,     // added to the total (combined mode) or used as section 3 time (sectional mode)
  'timer.grace_seconds': 20,           // network latency allowance for final autosave

  // Exam behaviour
  'exam.assignment_method': 'automatic', // manual | automatic | random
  'exam.link_expiry_days': 7,
  'exam.allow_resume': true,
  'exam.randomize_questions': true,
  'exam.randomize_options': true,
  'exam.randomize_communication': true,
  'exam.autosave_seconds': 15,
  'exam.require_access_code': true,
  'exam.max_attempts': 2,
  'exam.retake_allowed': true,
  'exam.retake_requires_approval': true,
  'exam.retake_new_set': true,
  'exam.tab_switch_warning_limit': 3,
  'exam.disable_copy_paste': true,
  'exam.show_result_to_candidate': false,
  'exam.show_correct_answers': false,
  'exam.capture_ip': true,
  'exam.capture_browser': true,
  'exam.min_words_recommended': 100,
  'exam.max_words': 200,
  'exam.default_exam_type': 'APT-COMM', // APT-COMM | APT-COMM-PRG
  'exam.collect_skills': true,          // ask candidates for their skills before the exam
  'exam.min_skills': 1,
  'exam.programming_language_choice': 'candidate', // candidate (from declared skills) | hr (fixed at assignment)
  'exam.programming_new_set_on_retake': true,

  // Rescheduling after technical issues
  'reschedule.enabled': true,
  'reschedule.allow_self_approval': false,  // segregation of duties: the approver must differ from the requester
  'reschedule.max_per_candidate': 2,
  'reschedule.default_extra_minutes': 15,
  'reschedule.voided_attempt_counts': false, // a voided attempt does not count toward max attempts

  // AI evaluation
  'ai.enabled': true,
  'ai.provider': 'rule',               // anthropic | openai | rule
  'ai.anthropic_model': 'claude-sonnet-4-5',
  'ai.openai_model': 'gpt-4o-mini',
  'ai.auto_evaluate_on_submit': true,
  'ai.fallback_to_rule': true,          // communication only; programming answers fall back to manual evaluator review
  'ai.evaluate_programming': true,
  'ai.anthropic_api_key': '',          // secret
  'ai.openai_api_key': '',             // secret

  // Backend synchronisation
  'backend.type': 'none',              // none | google_sheets | sharepoint
  'backend.auto_sync': true,
  'google.sheet_id': '',
  'google.service_account_json': '',   // secret
  'google.sheet_names': {
    candidates: 'Candidates', exam_results: 'Exam Results', aptitude_answers: 'Aptitude Answers',
    communication_answers: 'Communication Answers', aptitude_questions: 'Question Bank',
    communication_questions: 'Communication Question Bank', audit_log: 'Audit Log', exams: 'Exam Attempts',
    programming_answers: 'Programming Answers', programming_questions: 'Programming Question Bank',
    candidate_skills: 'Candidate Skills', reschedule_requests: 'Reschedule Requests',
  },
  'sharepoint.site_url': '',           // https://contoso.sharepoint.com/sites/Recruitment
  'sharepoint.tenant_id': '',
  'sharepoint.client_id': '',
  'sharepoint.client_secret': '',      // secret
  'sharepoint.list_names': {
    candidates: 'Candidate Master', exam_results: 'Exam Results', aptitude_answers: 'Aptitude Responses',
    communication_answers: 'Communication Responses', aptitude_questions: 'Question Bank',
    communication_questions: 'Communication Question Bank', audit_log: 'Audit Log', exams: 'Exam Attempts',
    programming_answers: 'Programming Responses', programming_questions: 'Programming Question Bank',
    candidate_skills: 'Candidate Skills', reschedule_requests: 'Reschedule Requests',
  },

  // Email
  'email.enabled': true,
  'email.transport': 'log',            // log | smtp
  'email.from': 'Recruitment Team <recruitment@example.com>',
  'email.smtp_host': '',
  'email.smtp_port': 587,
  'email.smtp_secure': false,
  'email.smtp_user': '',
  'email.smtp_password': '',           // secret
  'email.hr_notification_address': '',
  'email.notify_recruiter': true,
  'email.send_completion_email': true,
  'email.company_name': 'Activemindsit',

  // Branding (logo is uploaded separately: Settings → Branding)
  'branding.app_title': 'Candidate Examination',
  'branding.app_subtitle': 'Aptitude & Communication',
  'branding.primary_color': '#1e3a5f',   // sidebar, candidate header, email header
  'branding.accent_color': '#2563eb',    // buttons, links, charts
  'branding.logo_plate': true,           // show the logo on a white rounded plate over dark brand colours

  // Security
  'security.staff_session_minutes': 30,
  'security.max_failed_logins': 5,
  'security.lockout_minutes': 15,
};
const SECRET_KEYS = new Set(['ai.anthropic_api_key', 'ai.openai_api_key', 'google.service_account_json', 'sharepoint.client_secret', 'email.smtp_password']);

let cache = null;
function load() {
  const rows = getDb().prepare('SELECT key, value, secret FROM settings').all();
  const map = {};
  for (const r of rows) {
    try {
      map[r.key] = r.secret ? decrypt(JSON.parse(r.value)) : JSON.parse(r.value);
    } catch { /* ignore corrupt */ }
  }
  cache = map;
}
function get(key) {
  if (!cache) load();
  if (SECRET_KEYS.has(key) && config.secretsFromEnv[key]) return config.secretsFromEnv[key];
  if (key in cache) {
    // object settings (sheet/list names) are merged over defaults so newly added entities get a name
    if (DEFAULTS[key] && typeof DEFAULTS[key] === 'object' && cache[key] && typeof cache[key] === 'object') return { ...DEFAULTS[key], ...cache[key] };
    return cache[key];
  }
  return DEFAULTS[key];
}
function all() {
  if (!cache) load();
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = get(k);
  return out;
}
// Safe for clients: secrets replaced with a presence flag.
function publicView() {
  const out = all();
  for (const k of SECRET_KEYS) {
    out[k] = { configured: !!get(k), source: config.secretsFromEnv[k] ? 'environment' : (get(k) ? 'settings' : 'none') };
  }
  return out;
}
function validate(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`Unknown setting: ${key}`);
  const def = DEFAULTS[key];
  if (typeof def === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a non-negative number`);
    if (key.endsWith('_pct') && n > 100) throw new Error(`${key} must be between 0 and 100`);
    return n;
  }
  if (typeof def === 'boolean') return value === true || value === 'true';
  if (typeof def === 'object') { if (typeof value !== 'object' || !value) throw new Error(`${key} must be an object`); return value; }
  return String(value ?? '');
}
const ENUMS = {
  'timer.mode': ['combined', 'sectional'], 'exam.assignment_method': ['manual', 'automatic', 'random'],
  'ai.provider': ['anthropic', 'openai', 'rule'], 'backend.type': ['none', 'google_sheets', 'sharepoint'],
  'email.transport': ['log', 'smtp'],
  'exam.default_exam_type': ['APT-COMM', 'APT-COMM-PRG'], 'exam.programming_language_choice': ['candidate', 'hr'],
};
function setMany(values, userId) {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO settings(key, value, secret, updated_at, updated_by) VALUES (?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, secret=excluded.secret, updated_at=excluded.updated_at, updated_by=excluded.updated_by`);
  const changed = [];
  db.transaction(() => {
    for (const [k, raw] of Object.entries(values)) {
      if (SECRET_KEYS.has(k)) {
        if (raw === undefined || raw === null || (typeof raw === 'object')) continue; // untouched masked value
        if (raw === '') { db.prepare('DELETE FROM settings WHERE key = ?').run(k); changed.push(k); continue; }
        stmt.run(k, JSON.stringify(encrypt(String(raw))), 1, nowIso(), userId || null);
        changed.push(k); continue;
      }
      const v = validate(k, raw);
      if (ENUMS[k] && !ENUMS[k].includes(v)) throw new Error(`${k} must be one of ${ENUMS[k].join(', ')}`);
      if (k.endsWith('_color') && !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${k} must be a colour like #1e3a5f`);
      if (k.startsWith('branding.app_') && v.length > 60) throw new Error(`${k} must be 60 characters or fewer`);
      stmt.run(k, JSON.stringify(v), 0, nowIso(), userId || null);
      changed.push(k);
    }
    const w1 = values['scoring.aptitude_weight'] ?? get('scoring.aptitude_weight');
    const w2 = values['scoring.communication_weight'] ?? get('scoring.communication_weight');
    if (Number(w1) + Number(w2) <= 0) throw new Error('Section weights cannot both be zero');
  })();
  cache = null;
  return changed;
}
function reset() { cache = null; }
module.exports = { get, all, publicView, setMany, reset, DEFAULTS, SECRET_KEYS };
