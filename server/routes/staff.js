'use strict';
// Staff API (Admin / HR / Evaluator). Mounted at /api.
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { getDb } = require('../db');
const { nowIso, addMinutes, httpError, parseJson, round2 } = require('../lib/util');
const { randomToken, hashToken } = require('../lib/crypto');
const settings = require('../lib/settings');
const { audit, actorOf } = require('../lib/audit');
const { staffAuth, requirePerm, requireRole, cookieOpts, STAFF_COOKIE, can } = require('../middleware/auth');
const candidates = require('../services/candidates');
const assignment = require('../services/assignment');
const engine = require('../services/examEngine');
const results = require('../services/results');
const evaluation = require('../services/evaluation');
const questions = require('../services/questions');
const exportsSvc = require('../services/exports');
const sync = require('../services/sync');
const email = require('../services/email');
const programming = require('../services/programming');
const reschedule = require('../services/reschedule');

const r = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------- Authentication ----------------
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' } });
r.post('/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const db = getDb();
  const u = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(String(username || ''), String(username || ''));
  const fail = (msg = 'Invalid username or password') => { audit('STAFF_LOGIN_FAILED', { actor: String(username || '').slice(0, 60), req }); throw httpError(401, msg); };
  if (!u || !u.active) fail();
  if (u.locked_until && u.locked_until > nowIso()) fail('Account temporarily locked due to repeated failed logins. Try again later.');
  if (!bcrypt.compareSync(String(password || ''), u.password_hash)) {
    const n = u.failed_logins + 1;
    const lock = n >= settings.get('security.max_failed_logins') ? addMinutes(nowIso(), settings.get('security.lockout_minutes')) : null;
    db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : n, lock, u.id);
    fail();
  }
  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?').run(nowIso(), u.id);
  const token = randomToken(32);
  const mins = settings.get('security.staff_session_minutes');
  db.prepare(`INSERT INTO sessions(token_hash, kind, user_id, ip, user_agent, created_at, last_seen_at, expires_at) VALUES (?, 'staff', ?, ?, ?, ?, ?, ?)`)
    .run(hashToken(token), u.id, req.ip, (req.get('user-agent') || '').slice(0, 300), nowIso(), nowIso(), addMinutes(nowIso(), mins));
  res.cookie(STAFF_COOKIE, token, cookieOpts(mins * 60000));
  audit('STAFF_LOGIN', { userId: u.id, actor: u.username, req });
  res.json({ user: { id: u.id, username: u.username, full_name: u.full_name, email: u.email, role: u.role } });
});
r.post('/auth/logout', staffAuth, (req, res) => {
  getDb().prepare("UPDATE sessions SET revoked = 1, revoked_reason = 'logout' WHERE id = ?").run(req.session.id);
  res.clearCookie(STAFF_COOKIE, { path: '/' });
  audit('STAFF_LOGOUT', { ...actorOf(req), req });
  res.json({ ok: true });
});
r.get('/auth/me', staffAuth, (req, res) => res.json({ user: req.user, session_minutes: settings.get('security.staff_session_minutes'),
  permissions: ['candidates', 'exams', 'questions', 'reports', 'settings', 'users', 'evaluation', 'audit.view', 'monitor'].filter((p) => can(req.user, p)) }));
r.post('/auth/change-password', staffAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  const u = getDb().prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current_password || ''), u.password_hash)) throw httpError(400, 'Current password is incorrect');
  validatePassword(new_password);
  getDb().prepare('UPDATE users SET password_hash = ?, modified_at = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), nowIso(), u.id);
  getDb().prepare("UPDATE sessions SET revoked = 1, revoked_reason = 'password_change' WHERE user_id = ? AND id <> ?").run(u.id, req.session.id);
  audit('PASSWORD_CHANGED', { ...actorOf(req), req });
  res.json({ ok: true });
});
function validatePassword(p) {
  if (!p || p.length < 10 || !/[A-Z]/.test(p) || !/[a-z]/.test(p) || !/\d/.test(p)) throw httpError(400, 'Password must be at least 10 characters and include upper-case, lower-case and a number');
}

r.use(staffAuth);

// ---------------- Dashboard ----------------
r.get('/dashboard', requirePerm('dashboard'), (req, res) => {
  const db = getDb();
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const stats = {
    total_candidates: one('SELECT COUNT(*) n FROM candidates').n,
    exams_assigned: one("SELECT COUNT(*) n FROM exams WHERE status <> 'Cancelled'").n,
    exams_awaiting_start: one("SELECT COUNT(*) n FROM exams WHERE status = 'Assigned'").n,
    exams_started: one("SELECT COUNT(*) n FROM exams WHERE started_at IS NOT NULL AND status <> 'Cancelled'").n,
    exams_in_progress: one("SELECT COUNT(*) n FROM exams WHERE status = 'In Progress'").n,
    exams_completed: one("SELECT COUNT(*) n FROM exams WHERE status IN ('Submitted','Under Evaluation','Evaluated','Completed')").n,
    passed: one("SELECT COUNT(*) n FROM exam_results WHERE final_status = 'PASS' AND finalized = 1").n,
    failed: one("SELECT COUNT(*) n FROM exam_results WHERE final_status = 'FAIL' AND finalized = 1").n,
    pending_evaluation: one("SELECT COUNT(*) n FROM exams WHERE status IN ('Submitted','Under Evaluation','Evaluated')").n,
    expired: one("SELECT COUNT(*) n FROM exams WHERE status = 'Expired'").n,
    pending_approval: one("SELECT COUNT(*) n FROM exams WHERE status = 'Pending Approval'").n,
    pending_reschedules: one("SELECT COUNT(*) n FROM reschedule_requests WHERE status = 'Pending'").n,
    programming_exams: one("SELECT COUNT(*) n FROM exams WHERE programming_language IS NOT NULL AND status <> 'Cancelled'").n,
  };
  const sc = one(`SELECT AVG(aptitude_percentage) apt, AVG(communication_percentage) com, AVG(final_score) fin, MAX(final_score) hi, MIN(final_score) lo,
    AVG(aptitude_score) apt_raw, AVG(communication_score) com_raw FROM exam_results WHERE final_score IS NOT NULL`);
  const scores = { avg_aptitude_pct: round2(sc.apt), avg_aptitude_score: round2(sc.apt_raw), avg_communication_pct: round2(sc.com),
    avg_communication_score: round2(sc.com_raw), avg_final: round2(sc.fin), highest: round2(sc.hi), lowest: round2(sc.lo) };
  const type = db.prepare("SELECT id FROM exam_types WHERE code = 'APT-COMM'").get();
  const usage = assignment.setUsage(type.id);
  const recent = db.prepare(`SELECT e.id, e.exam_code, e.status, e.submitted_at, e.started_at, c.full_name, c.candidate_code, c.position_applied, s.code set_code,
    r.final_score, r.final_status, r.finalized FROM exams e JOIN candidates c ON c.id = e.candidate_id LEFT JOIN exam_sets s ON s.id = e.exam_set_id
    LEFT JOIN exam_results r ON r.exam_id = e.id ORDER BY e.modified_at DESC LIMIT 8`).all();
  const trend = db.prepare(`SELECT substr(submitted_at,1,10) d, COUNT(*) n FROM exams WHERE submitted_at >= ? GROUP BY d ORDER BY d`)
    .all(new Date(Date.now() - 30 * 864e5).toISOString());
  const byCategory = db.prepare(`SELECT q.category, SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) correct, COUNT(*) total FROM aptitude_answers a
    JOIN aptitude_questions q ON q.id = a.question_id WHERE a.is_correct IS NOT NULL GROUP BY q.category`).all()
    .map((x) => ({ ...x, pct: round2(x.correct / x.total * 100) }));
  const byLanguage = db.prepare(`SELECT l.label language, COUNT(r.id) n, AVG(r.programming_percentage) avg_pct FROM exam_results r JOIN exams e ON e.id = r.exam_id
    JOIN programming_languages l ON l.key = e.programming_language WHERE r.programming_percentage IS NOT NULL GROUP BY l.label ORDER BY n DESC`).all()
    .map((x) => ({ ...x, avg_pct: round2(x.avg_pct) }));
  scores.avg_programming_pct = round2(one('SELECT AVG(programming_percentage) v FROM exam_results WHERE programming_percentage IS NOT NULL').v);
  res.json({ stats, scores, set_usage: usage, recent, trend, by_category: byCategory, by_language: byLanguage, sync: sync.status() });
});

// ---------------- Candidates ----------------
r.get('/candidates', requirePerm('candidates.view'), (req, res) => res.json(candidates.searchCandidates(req.query)));
r.post('/candidates', requirePerm('candidates'), (req, res) => res.status(201).json(candidates.createCandidate(req.body || {}, req)));
r.get('/candidates/:id', requirePerm('candidates.view'), (req, res) => {
  const c = candidates.getCandidate(Number(req.params.id));
  if (!c) throw httpError(404, 'Candidate not found');
  const exams = getDb().prepare(`SELECT e.id, e.exam_code, e.attempt_code, e.attempt_number, e.status, e.assignment_method, e.assigned_at, e.started_at,
    e.submitted_at, e.submission_type, e.link_expires_at, e.tab_switch_count, e.retake_reason, e.available_from, e.counts_as_attempt, e.void_reason,
    e.programming_language, e.programming_set, e.rescheduled_from_exam_id, t.code exam_type, t.name exam_type_name, s.code set_code, r.aptitude_percentage,
    r.communication_percentage, r.programming_percentage, r.final_score, r.final_status, r.finalized FROM exams e LEFT JOIN exam_sets s ON s.id = e.exam_set_id
    JOIN exam_types t ON t.id = e.exam_type_id LEFT JOIN exam_results r ON r.exam_id = e.id WHERE e.candidate_id = ? ORDER BY e.attempt_number DESC`).all(c.id)
    .map((e) => ({ ...e, reschedule_options: reschedule.allowedOptions(e),
      pending_reschedule: getDb().prepare("SELECT id, request_code FROM reschedule_requests WHERE exam_id = ? AND status = 'Pending'").get(e.id) || null }));
  const audits = getDb().prepare('SELECT * FROM audit_log WHERE candidate_id = ? ORDER BY id DESC LIMIT 100').all(c.id);
  res.json({ candidate: c, exams, audit: audits, statuses: candidates.CANDIDATE_STATUSES, skills: programming.getSkills(c.id),
    skill_levels: programming.LEVELS, skill_categories: programming.CATEGORIES, skill_suggestions: programming.SUGGESTIONS,
    reschedules: reschedule.listRequests({ candidate_id: c.id }) });
});
r.put('/candidates/:id', requirePerm('candidates'), (req, res) => res.json(candidates.updateCandidate(Number(req.params.id), req.body || {}, req)));
r.put('/candidates/:id/skills', requirePerm('candidates'), (req, res) => {
  if (!candidates.getCandidate(Number(req.params.id))) throw httpError(404, 'Candidate not found');
  res.json(programming.saveSkills(Number(req.params.id), req.body?.skills || [], { source: 'hr', req }));
});

// ---------------- Exam assignment & control ----------------
r.get('/exam-sets', requirePerm('candidates.view'), (req, res) => {
  const type = getDb().prepare("SELECT id FROM exam_types WHERE code = 'APT-COMM'").get();
  res.json(assignment.setUsage(type.id).map((s) => ({ ...s, readiness: assignment.setReadiness(s.id) })));
});
r.post('/candidates/:id/assign', requirePerm('exams'), (req, res) => {
  const b = req.body || {};
  const out = assignment.assignExam({ candidateId: Number(req.params.id), method: b.method, setId: b.set_id, retakeReason: b.retake_reason,
    examTypeCode: b.exam_type || undefined, programmingLanguage: b.programming_language || undefined, programmingSet: b.programming_set || undefined,
    availableFrom: b.available_from || null, expiresAt: b.expires_at || null }, req);
  res.status(201).json({ exam_id: out.exam.id, exam_code: out.exam.exam_code, attempt: out.exam.attempt_number, exam_set: out.set, exam_type: out.examType,
    programming: out.programming, status: out.exam.status, link: out.credentials?.link, access_code: out.credentials?.accessCode,
    expires_at: out.credentials?.expiresAt, available_from: out.credentials?.availableFrom || out.exam.available_from, warnings: out.warnings, pending_approval: out.pendingApproval });
});
r.post('/exams/:id/approve-retake', requireRole('admin'), (req, res) => {
  const out = assignment.approveRetake(Number(req.params.id), req);
  res.json({ link: out.credentials.link, access_code: out.credentials.accessCode, expires_at: out.credentials.expiresAt });
});
r.post('/exams/:id/regenerate-link', requirePerm('exams'), (req, res) => {
  const { credentials: c } = assignment.regenerateLink(Number(req.params.id), req);
  res.json({ link: c.link, access_code: c.accessCode, expires_at: c.expiresAt, available_from: c.availableFrom });
});
// View the current link/access code again (audited) and e-mail it to the candidate and/or colleagues.
r.get('/exams/:id/link', requirePerm('exams'), (req, res) => {
  const exam = engine.getExam(Number(req.params.id));
  if (!exam) throw httpError(404, 'Exam not found');
  if (!['Assigned', 'In Progress'].includes(exam.status)) throw httpError(409, `There is no active link for an exam that is ${exam.status}`, 'NO_LINK');
  const c = assignment.currentCredentials(exam.id);
  const cand = getDb().prepare('SELECT email, full_name FROM candidates WHERE id = ?').get(exam.candidate_id);
  audit('EXAM_LINK_VIEWED', { candidateId: exam.candidate_id, examId: exam.id, ...actorOf(req), req });
  res.json({ available: !!c, link: c?.link, access_code: c?.accessCode, expires_at: c?.expiresAt || exam.link_expires_at, available_from: c?.availableFrom,
    candidate_email: cand.email, candidate_name: cand.full_name, exam_code: exam.exam_code });
});
r.post('/exams/:id/send-link', requirePerm('exams'), wrap(async (req, res) => {
  const exam = engine.getExam(Number(req.params.id));
  if (!exam) throw httpError(404, 'Exam not found');
  if (!['Assigned', 'In Progress'].includes(exam.status)) throw httpError(409, `Links can only be sent for exams that are Assigned or In Progress (this one is ${exam.status})`, 'NO_LINK');
  const b = req.body || {};
  let creds = assignment.currentCredentials(exam.id); let regenerated = false;
  if (!creds) {
    if (!b.regenerate) throw httpError(409, 'This link was issued before links could be re-sent. Send with "regenerate" to issue a new link and access code (the old one stops working).', 'REGENERATE_REQUIRED');
    creds = assignment.issueCredentials(exam.id); regenerated = true;
  }
  const out = email.emailExamLink(exam.id, creds, { to: b.to, cc: b.cc, message: b.message, includeCode: b.include_access_code });
  audit('EXAM_LINK_EMAILED', { candidateId: exam.candidate_id, examId: exam.id, ...actorOf(req), req,
    details: { recipients: out.recipients, include_access_code: b.include_access_code !== false, regenerated, personal_message: !!b.message } });
  const status = out.ids ? await email.outboxStatus(out.ids) : [];
  res.json({ recipients: out.recipients, regenerated, emails: status, link: regenerated ? creds.link : undefined, access_code: regenerated ? creds.accessCode : undefined });
}));
r.post('/exams/:id/cancel', requirePerm('exams'), (req, res) => { assignment.cancelExam(Number(req.params.id), req.body.reason, req); res.json({ ok: true }); });
r.post('/exams/:id/reset-session', requirePerm('exams'), (req, res) => { engine.adminResetSession(Number(req.params.id), req.body || {}, req); res.json({ ok: true }); });
r.post('/exams/:id/reset', requirePerm('exams'), (req, res) => {
  const { credentials: c } = engine.adminResetExam(Number(req.params.id), req.body.reason, req);
  res.json({ link: c.link, access_code: c.accessCode, expires_at: c.expiresAt });
});
r.post('/exams/:id/force-submit', requirePerm('exams'), (req, res) => res.json(pubExam(engine.adminForceSubmit(Number(req.params.id), req))));
const pubExam = (e) => { const o = { ...e }; delete o.token_hash; delete o.access_code_hash; return o; };

// ---------------- Monitoring ----------------
r.get('/monitor', requirePerm('monitor'), (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT e.id, e.exam_code, e.status, e.started_at, e.deadline_at, e.last_autosave_at, e.tab_switch_count, e.suspicious_event_count,
    e.resume_count, e.ip_address, e.link_expires_at, e.assigned_at, e.timing, c.id candidate_id, c.full_name, c.candidate_code, c.position_applied, s.code set_code,
    (SELECT COUNT(*) FROM aptitude_answers a WHERE a.exam_id = e.id AND a.selected_answer IS NOT NULL) apt_answered,
    (SELECT COUNT(*) FROM communication_answers a WHERE a.exam_id = e.id AND a.word_count > 0) com_answered,
    (SELECT COUNT(*) FROM programming_answers a WHERE a.exam_id = e.id AND trim(COALESCE(a.answer_text,'')) <> '') prg_answered,
    (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id AND q.section = 'programming') prg_total, e.programming_language, e.available_from,
    (SELECT MAX(last_seen_at) FROM sessions ss WHERE ss.exam_id = e.id AND ss.kind = 'candidate' AND ss.revoked = 0) last_seen_at
    FROM exams e JOIN candidates c ON c.id = e.candidate_id LEFT JOIN exam_sets s ON s.id = e.exam_set_id
    WHERE e.status IN ('Assigned','In Progress','Pending Approval','Expired') ORDER BY CASE e.status WHEN 'In Progress' THEN 0 ELSE 1 END, e.started_at DESC, e.assigned_at DESC`).all()
    .map((x) => ({ ...x, timing: undefined, current_section: parseJson(x.timing, {})?.current_section || null,
      remaining_seconds: x.deadline_at ? Math.max(0, Math.floor((new Date(x.deadline_at) - Date.now()) / 1000)) : null }));
  const events = db.prepare(`SELECT l.*, c.candidate_code, c.full_name, e.exam_code FROM audit_log l LEFT JOIN candidates c ON c.id = l.candidate_id
    LEFT JOIN exams e ON e.id = l.exam_id WHERE l.event LIKE 'SUSPICIOUS_%' OR l.event IN ('EXAM_STARTED','EXAM_SUBMITTED','EXAM_RESUMED','CANDIDATE_LOGIN','EXAM_RESUME_BLOCKED')
    ORDER BY l.id DESC LIMIT 40`).all();
  res.json({ exams: rows, events, server_time: nowIso() });
});

// ---------------- Results ----------------
r.get('/results', requirePerm('results.view'), (req, res) => {
  const db = getDb();
  const w = ["e.status IN ('Submitted','Under Evaluation','Evaluated','Completed')"]; const p = {};
  if (req.query.q) { w.push('(c.full_name LIKE @q OR c.candidate_code LIKE @q OR e.exam_code LIKE @q OR c.email LIKE @q)'); p.q = `%${req.query.q}%`; }
  if (req.query.exam_set) { w.push('s.code = @set'); p.set = req.query.exam_set; }
  if (req.query.status === 'pending') w.push("r.finalized = 0");
  if (req.query.status === 'finalized') w.push('r.finalized = 1');
  if (req.query.result) { w.push('r.final_status = @res'); p.res = req.query.result; }
  if (req.query.date_from) { w.push('substr(e.submitted_at,1,10) >= @df'); p.df = req.query.date_from; }
  if (req.query.date_to) { w.push('substr(e.submitted_at,1,10) <= @dt'); p.dt = req.query.date_to; }
  const rows = db.prepare(`SELECT e.id exam_id, e.exam_code, e.attempt_number, e.status exam_status, e.submitted_at, e.submission_type, e.duration_seconds,
    e.tab_switch_count, c.id candidate_id, c.candidate_code, c.full_name, c.position_applied, c.department, s.code set_code, r.aptitude_score, r.aptitude_max,
    r.aptitude_percentage, r.communication_score, r.communication_max, r.communication_percentage, r.communication_evaluated, r.final_score, r.final_status, r.finalized,
    r.programming_score, r.programming_max, r.programming_percentage, r.programming_evaluated, e.programming_language, e.programming_set
    FROM exams e JOIN candidates c ON c.id = e.candidate_id LEFT JOIN exam_sets s ON s.id = e.exam_set_id LEFT JOIN exam_results r ON r.exam_id = e.id
    WHERE ${w.join(' AND ')} ORDER BY e.submitted_at DESC LIMIT 1000`).all(p);
  res.json({ rows });
});
r.get('/exams/:id', requirePerm('results.view'), (req, res) => {
  const d = results.getExamDetail(Number(req.params.id));
  if (!d) throw httpError(404, 'Exam not found');
  d.audit = getDb().prepare('SELECT * FROM audit_log WHERE exam_id = ? ORDER BY id').all(d.exam.id);
  d.progress = engine.progressSummary(d.exam.id);
  res.json(d);
});

// ---------------- Evaluation ----------------
r.post('/evaluation/exams/:id/run', requirePerm('evaluation'), wrap(async (req, res) => {
  const exam = engine.getExam(Number(req.params.id));
  if (!exam) throw httpError(404, 'Exam not found');
  if (!['Under Evaluation', 'Evaluated', 'Submitted'].includes(exam.status)) throw httpError(409, `Exam is ${exam.status}`);
  const out = await evaluation.evaluateExam(exam.id, { force: !!req.body.force, provider: req.body.provider || null, userId: req.user.id });
  audit('EVALUATION_TRIGGERED', { examId: exam.id, candidateId: exam.candidate_id, ...actorOf(req), req, details: { force: !!req.body.force, provider: req.body.provider } });
  res.json(out);
}));
r.put('/evaluation/answers/:answerId', requirePerm('evaluation'), (req, res) => res.json(evaluation.manualEvaluate(Number(req.params.answerId), req.body || {}, req)));
r.put('/evaluation/programming-answers/:answerId', requirePerm('evaluation'), (req, res) => res.json(evaluation.manualEvaluateCode(Number(req.params.answerId), req.body || {}, req)));
r.put('/evaluation/exams/:id/comments', requirePerm('evaluation'), (req, res) => { results.setResultComments(Number(req.params.id), String(req.body.comments || ''), req); res.json({ ok: true }); });
r.post('/evaluation/exams/:id/finalize', requirePerm('evaluation'), (req, res) => res.json(results.finalizeResult(Number(req.params.id), { req, comments: req.body.comments ?? null })));
r.post('/evaluation/exams/:id/reopen', requireRole('admin'), (req, res) => res.json(results.reopenResult(Number(req.params.id), req.body.reason, req)));

// ---------------- Question bank ----------------
r.get('/questions/aptitude', requirePerm('questions'), (req, res) => res.json(questions.listAptitude(req.query)));
r.post('/questions/aptitude', requirePerm('questions'), (req, res) => res.status(201).json(questions.saveAptitude(null, req.body || {}, req)));
r.put('/questions/aptitude/:id', requirePerm('questions'), (req, res) => res.json(questions.saveAptitude(Number(req.params.id), req.body || {}, req)));
r.delete('/questions/aptitude/:id', requirePerm('questions'), (req, res) => res.json(questions.deleteAptitude(Number(req.params.id), req)));
r.get('/questions/communication', requirePerm('questions'), (req, res) => res.json(questions.listCommunication(req.query)));
r.post('/questions/communication', requirePerm('questions'), (req, res) => res.status(201).json(questions.saveCommunication(null, req.body || {}, req)));
r.put('/questions/communication/:id', requirePerm('questions'), (req, res) => res.json(questions.saveCommunication(Number(req.params.id), req.body || {}, req)));
r.delete('/questions/communication/:id', requirePerm('questions'), (req, res) => res.json(questions.deleteCommunication(Number(req.params.id), req)));
r.post('/exam-sets', requirePerm('questions'), (req, res) => res.status(201).json(questions.createSet(req.body || {}, req)));
r.put('/exam-sets/:id', requirePerm('questions'), (req, res) => res.json(questions.updateSet(Number(req.params.id), req.body || {}, req)));
r.get('/exam-types', requirePerm('candidates.view'), (req, res) => res.json(getDb().prepare('SELECT * FROM exam_types WHERE active = 1').all().map((t) => ({ ...t, config: parseJson(t.config) }))));

// ---------------- Programming (languages & question bank) ----------------
r.get('/programming/languages', requirePerm('candidates.view'), (req, res) => res.json(programming.listLanguages()));
r.post('/programming/languages', requirePerm('questions'), (req, res) => res.status(201).json(programming.saveLanguage(req.body || {}, req)));
r.get('/programming/questions', requirePerm('questions'), (req, res) => res.json(programming.listQuestions(req.query)));
r.post('/programming/questions', requirePerm('questions'), (req, res) => res.status(201).json(programming.saveQuestion(null, req.body || {}, req)));
r.put('/programming/questions/:id', requirePerm('questions'), (req, res) => res.json(programming.saveQuestion(Number(req.params.id), req.body || {}, req)));
r.delete('/programming/questions/:id', requirePerm('questions'), (req, res) => res.json(programming.deleteQuestion(Number(req.params.id), req)));

// ---------------- Reschedule requests (HR requests, Admin approves) ----------------
r.get('/reschedules', requirePerm('exams'), (req, res) => res.json({ rows: reschedule.listRequests(req.query), reasons: reschedule.REASONS, options: reschedule.OPTIONS }));
r.get('/reschedules/:id', requirePerm('exams'), (req, res) => { const x = reschedule.getRequest(Number(req.params.id)); if (!x) throw httpError(404, 'Request not found'); res.json(x); });
r.post('/exams/:id/reschedule-requests', requirePerm('exams'), (req, res) => res.status(201).json(reschedule.createRequest(Number(req.params.id), req.body || {}, req)));
r.post('/reschedules/:id/approve', requireRole('admin'), (req, res) => {
  const out = reschedule.decide(Number(req.params.id), 'approve', req.body || {}, req);
  const c = out.outcome.credentials;
  res.json({ request: out.request, outcome: { ...out.outcome, credentials: undefined, link: c?.link, access_code: c?.accessCode, expires_at: c?.expiresAt, available_from: c?.availableFrom } });
});
r.post('/reschedules/:id/reject', requireRole('admin'), (req, res) => res.json(reschedule.decide(Number(req.params.id), 'reject', req.body || {}, req)));
r.post('/reschedules/:id/withdraw', requirePerm('exams'), (req, res) => res.json(reschedule.withdraw(Number(req.params.id), req)));

// ---------------- Reports & export ----------------
r.get('/export/:dataset', requirePerm('reports'), wrap(async (req, res) => {
  const ds = exportsSvc.dataset(req.params.dataset, req.query);
  const fmt = (req.query.format || 'csv').toLowerCase();
  const base = `${req.params.dataset}-${new Date().toISOString().slice(0, 10)}`;
  audit('DATA_EXPORTED', { ...actorOf(req), req, details: { dataset: req.params.dataset, format: fmt, rows: ds.rows.length, filters: req.query } });
  if (fmt === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
    return res.send(Buffer.from(await exportsSvc.toXlsx(ds)));
  }
  if (fmt === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
    return res.send(await exportsSvc.toPdfTable(ds));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
  res.send(exportsSvc.toCsv(ds));
}));
r.get('/reports/exam/:id.pdf', requirePerm('results.view'), wrap(async (req, res) => {
  const buf = await exportsSvc.candidateReport(Number(req.params.id));
  const e = engine.getExam(Number(req.params.id));
  audit('REPORT_GENERATED', { examId: e.id, candidateId: e.candidate_id, ...actorOf(req), req });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="report-${e.exam_code}.pdf"`);
  res.send(buf);
}));

// ---------------- Audit log ----------------
r.get('/audit', requirePerm('audit.view'), (req, res) => {
  const w = []; const p = {};
  if (req.query.q) { w.push('(l.event LIKE @q OR l.details LIKE @q OR l.actor LIKE @q OR c.candidate_code LIKE @q OR e.exam_code LIKE @q)'); p.q = `%${req.query.q}%`; }
  if (req.query.event) { w.push('l.event = @ev'); p.ev = req.query.event; }
  if (req.query.date_from) { w.push('substr(l.timestamp,1,10) >= @df'); p.df = req.query.date_from; }
  if (req.query.date_to) { w.push('substr(l.timestamp,1,10) <= @dt'); p.dt = req.query.date_to; }
  const limit = Math.min(Number(req.query.limit) || 100, 1000); const offset = Number(req.query.offset) || 0;
  const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) n FROM audit_log l LEFT JOIN candidates c ON c.id = l.candidate_id LEFT JOIN exams e ON e.id = l.exam_id ${where}`).get(p).n;
  const rows = db.prepare(`SELECT l.*, c.candidate_code, c.full_name, e.exam_code FROM audit_log l LEFT JOIN candidates c ON c.id = l.candidate_id
    LEFT JOIN exams e ON e.id = l.exam_id ${where} ORDER BY l.id DESC LIMIT ${limit} OFFSET ${offset}`).all(p);
  const events = db.prepare('SELECT DISTINCT event FROM audit_log ORDER BY event').all().map((x) => x.event);
  res.json({ total, rows, events });
});

// ---------------- Settings & integrations (Admin only) ----------------
r.get('/settings', requireRole('admin', 'hr'), (req, res) => res.json({ settings: settings.publicView(), sync: sync.status(),
  outbox: getDb().prepare('SELECT id, kind, to_address, subject, status, error, created_at, sent_at FROM email_outbox ORDER BY id DESC LIMIT 25').all() }));
r.put('/branding/logo', requireRole('admin'), (req, res) => {
  const info = require('../services/branding').saveLogo({ dataUrl: req.body?.data_url, fileName: req.body?.file_name }, req.user.id);
  audit('BRANDING_LOGO_UPDATED', { ...actorOf(req), req, details: { file_name: info.file_name, mime: info.mime, bytes: info.bytes } });
  res.json(require('../services/branding').publicInfo());
});
r.delete('/branding/logo', requireRole('admin'), (req, res) => {
  require('../services/branding').deleteLogo();
  audit('BRANDING_LOGO_REMOVED', { ...actorOf(req), req });
  res.json(require('../services/branding').publicInfo());
});
r.put('/settings', requireRole('admin'), (req, res) => {
  try {
    const changed = settings.setMany(req.body || {}, req.user.id);
    audit('SETTINGS_UPDATED', { ...actorOf(req), req, details: { keys: changed } });
    res.json({ settings: settings.publicView(), changed });
  } catch (e) { throw httpError(400, e.message, 'VALIDATION'); }
});
r.post('/integrations/test', requireRole('admin'), wrap(async (req, res) => {
  try { res.json(await sync.testConnection()); } catch (e) { throw httpError(400, e.message); }
}));
r.post('/integrations/provision', requireRole('admin'), wrap(async (req, res) => {
  try { const out = await sync.provision(); audit('BACKEND_PROVISIONED', { ...actorOf(req), req, details: { created: out } }); res.json({ created: out }); } catch (e) { throw httpError(400, e.message); }
}));
r.post('/integrations/full-sync', requireRole('admin'), wrap(async (req, res) => {
  if (settings.get('backend.type') === 'none') throw httpError(400, 'Select a backend type first');
  const n = sync.enqueueAll();
  audit('FULL_SYNC_STARTED', { ...actorOf(req), req, details: { queued: n } });
  const out = await sync.processQueue({ limit: 100000 });
  res.json({ queued: n, ...out, status: sync.status() });
}));
r.post('/integrations/sync-now', requireRole('admin'), wrap(async (req, res) => res.json({ ...(await sync.processQueue()), status: sync.status() })));
r.post('/integrations/test-email', requireRole('admin'), wrap(async (req, res) => res.json(await email.sendTest(req.body.to || req.user.email))));
r.post('/integrations/test-ai', requireRole('admin'), wrap(async (req, res) => {
  const provider = req.body.provider || settings.get('ai.provider');
  const sample = 'In my previous role as a customer service executive, I handled a difficult situation when a client received a delayed shipment. First, I listened carefully and apologised for the inconvenience. Then I contacted our logistics team, identified the cause of the delay and arranged express delivery at no extra cost. I kept the client informed throughout the process. As a result, the client continued working with us and later gave positive feedback. This experience taught me that calm, transparent communication builds trust.';
  const q = 'Describe a difficult situation you faced at work and how you handled it.';
  const t0 = Date.now();
  try {
    const out = provider === 'rule' ? require('../services/evaluation/rule').evaluateRule(q, sample)
      : await require('../services/evaluation/ai').evaluateAi(provider, q, sample, { wc: 92, minWords: 100, maxWords: 200 });
    res.json({ provider, ms: Date.now() - t0, result: { ...out, raw: undefined } });
  } catch (e) { throw httpError(400, `AI test failed: ${e.message}`); }
}));

// ---------------- Users (Admin only) ----------------
r.get('/users', requireRole('admin'), (req, res) => res.json(getDb().prepare('SELECT id, username, email, full_name, role, active, last_login_at, created_at FROM users ORDER BY id').all()));
r.post('/users', requireRole('admin'), (req, res) => {
  const { username, email: em, full_name, role, password } = req.body || {};
  if (!username || !em || !full_name) throw httpError(400, 'Username, email and full name are required');
  if (!['admin', 'hr', 'evaluator'].includes(role)) throw httpError(400, 'Role must be admin, hr or evaluator');
  validatePassword(password);
  try {
    const info = getDb().prepare(`INSERT INTO users(username, email, full_name, role, password_hash, active, created_at, modified_at) VALUES (?,?,?,?,?,1,?,?)`)
      .run(username.trim(), em.trim().toLowerCase(), full_name.trim(), role, bcrypt.hashSync(password, 10), nowIso(), nowIso());
    audit('USER_CREATED', { ...actorOf(req), req, details: { username, role } });
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { if (/UNIQUE/.test(e.message)) throw httpError(409, 'Username or email already exists'); throw e; }
});
r.put('/users/:id', requireRole('admin'), (req, res) => {
  const id = Number(req.params.id);
  const u = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) throw httpError(404, 'User not found');
  const f = {};
  if (req.body.full_name) f.full_name = req.body.full_name;
  if (req.body.role) { if (!['admin', 'hr', 'evaluator'].includes(req.body.role)) throw httpError(400, 'Invalid role'); f.role = req.body.role; }
  if (req.body.active !== undefined) f.active = req.body.active ? 1 : 0;
  if (id === req.user.id && (f.active === 0 || (f.role && f.role !== 'admin'))) throw httpError(400, 'You cannot deactivate or demote your own account');
  if (req.body.password) { validatePassword(req.body.password); f.password_hash = bcrypt.hashSync(req.body.password, 10); }
  f.modified_at = nowIso();
  getDb().prepare(`UPDATE users SET ${Object.keys(f).map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...f, id });
  if (f.active === 0 || f.password_hash) getDb().prepare("UPDATE sessions SET revoked = 1, revoked_reason = 'user_updated' WHERE user_id = ?").run(id);
  audit('USER_UPDATED', { ...actorOf(req), req, details: { user: u.username, fields: Object.keys(f).filter((k) => k !== 'password_hash' && k !== 'modified_at'), password_reset: !!f.password_hash } });
  res.json({ ok: true });
});

module.exports = r;
