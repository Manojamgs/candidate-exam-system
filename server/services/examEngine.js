'use strict';
// Candidate-facing examination engine: login, instructions, timer, paper, autosave, events, submission.
const { getDb, tx } = require('../db');
const { nowIso, addMinutes, addSeconds, httpError, parseJson, wordCount } = require('../lib/util');
const { randomToken, hashToken, safeEqual } = require('../lib/crypto');
const settings = require('../lib/settings');
const { audit } = require('../lib/audit');
const { patchCandidate } = require('./candidates');
const { enqueueExamTree } = require('./sync/queue');

const LETTERS = ['A', 'B', 'C', 'D'];
const SUBMITTED = ['Submitted', 'Under Evaluation', 'Evaluated', 'Completed'];
const getExam = (id) => getDb().prepare('SELECT * FROM exams WHERE id = ?').get(id);

function candidateLogin({ token, accessCode }, req) {
  const db = getDb();
  if (!token) throw httpError(400, 'Exam link is missing or invalid');
  const exam = db.prepare('SELECT * FROM exams WHERE token_hash = ?').get(hashToken(token));
  if (!exam) throw httpError(404, 'This exam link is invalid or has been replaced. Please contact the recruitment team.', 'INVALID_LINK');
  const cand = db.prepare('SELECT * FROM candidates WHERE id = ?').get(exam.candidate_id);
  const ctx = { candidateId: cand.id, examId: exam.id, actor: cand.candidate_code, req };
  if (settings.get('exam.require_access_code')) {
    if (!accessCode || !safeEqual(hashToken(String(accessCode).trim().toUpperCase()), exam.access_code_hash || '')) {
      audit('CANDIDATE_LOGIN_FAILED', { ...ctx, details: { reason: 'bad_access_code' } });
      throw httpError(401, 'The access code is incorrect.', 'BAD_CODE');
    }
  }
  if (exam.status === 'Cancelled') throw httpError(410, 'This examination has been cancelled.', 'CANCELLED');
  if (exam.status === 'Voided') throw httpError(410, 'This attempt was replaced by a rescheduled examination. Please use the new link sent to you.', 'VOIDED');
  if (SUBMITTED.includes(exam.status)) {
    // Allow read-only access to confirmation / result page.
    return createCandidateSession(exam, req, { readOnly: true });
  }
  if (exam.status === 'Assigned' && exam.link_expires_at && exam.link_expires_at < nowIso()) {
    db.prepare("UPDATE exams SET status = 'Expired', modified_at = ? WHERE id = ?").run(nowIso(), exam.id);
    patchCandidate(cand.id, { exam_status: 'Expired' });
    audit('EXAM_LINK_EXPIRED', ctx);
    throw httpError(410, 'This exam link has expired. Please contact the recruitment team.', 'EXPIRED');
  }
  if (exam.status === 'Expired') throw httpError(410, 'This exam link has expired. Please contact the recruitment team.', 'EXPIRED');
  if (exam.status === 'Pending Approval') throw httpError(409, 'This exam is awaiting approval.');
  if (exam.status === 'In Progress') {
    const timing = parseJson(exam.timing, {});
    const hadSession = db.prepare("SELECT COUNT(*) n FROM sessions WHERE exam_id = ? AND kind = 'candidate'").get(exam.id).n > 0;
    if (hadSession && !settings.get('exam.allow_resume') && !timing.resume_override) {
      audit('EXAM_RESUME_BLOCKED', ctx);
      throw httpError(403, 'Resuming an interrupted exam is not permitted. Please contact the recruitment team.', 'RESUME_BLOCKED');
    }
    if (timing.resume_override) { timing.resume_override = false; db.prepare('UPDATE exams SET timing = ? WHERE id = ?').run(JSON.stringify(timing), exam.id); }
    db.prepare('UPDATE exams SET resume_count = resume_count + 1 WHERE id = ?').run(exam.id);
    audit('EXAM_RESUMED', ctx);
  }
  return createCandidateSession(exam, req, { readOnly: false });
}

function createCandidateSession(exam, req, { readOnly }) {
  const db = getDb();
  const token = randomToken(32);
  const now = nowIso();
  // Single active session: revoke any other session for this exam.
  db.prepare("UPDATE sessions SET revoked = 1, revoked_reason = 'superseded' WHERE exam_id = ? AND kind = 'candidate' AND revoked = 0").run(exam.id);
  const expires = exam.deadline_at ? addMinutes(exam.deadline_at, 30) : addMinutes(now, 24 * 60);
  const info = db.prepare(`INSERT INTO sessions(token_hash, kind, exam_id, ip, user_agent, created_at, last_seen_at, expires_at)
    VALUES (?, 'candidate', ?, ?, ?, ?, ?, ?)`).run(hashToken(token), exam.id, req.ip, (req.get('user-agent') || '').slice(0, 300), now, now, expires);
  if (!readOnly) db.prepare('UPDATE exams SET active_session_id = ? WHERE id = ?').run(info.lastInsertRowid, exam.id);
  audit('CANDIDATE_LOGIN', { candidateId: exam.candidate_id, examId: exam.id, actor: 'candidate', req, details: { readOnly } });
  return { token, maxAgeMs: new Date(expires).getTime() - Date.now() };
}

// ---------- Timing ----------
// Section order comes from the exam type (aptitude → communication → programming). Timing JSON is stored on the exam:
// { mode, order: [...], minutes: {section: n}, total_minutes, current_section, sections: { key: { started_at, deadline_at, locked_at } } }
function examSections(exam) {
  const t = getDb().prepare('SELECT config FROM exam_types WHERE id = ?').get(exam.exam_type_id);
  return parseJson(t?.config, { sections: [] }).sections;
}
function hasProgramming(exam) { return examSections(exam).some((x) => x.kind === 'code'); }
function timingConfig(exam) {
  const order = examSections(exam).map((x) => x.key);
  const minutes = {};
  for (const k of order) minutes[k] = Number(settings.get(`timer.${k}_minutes`)) || 30;
  const prg = order.includes('programming');
  return { mode: settings.get('timer.mode'), order, minutes,
    total_minutes: Number(settings.get('timer.total_minutes')) + (prg ? Number(settings.get('timer.programming_minutes')) : 0) };
}
// Backwards compatible reader for timing objects created by v1.0 (two fixed sections).
function readTiming(exam) {
  const t = parseJson(exam.timing, {});
  if (!t.order && t.sections) {
    t.order = Object.keys(t.sections);
    t.minutes = Object.fromEntries(t.order.map((k) => [k, t[`${k}_minutes`]]));
  }
  return t;
}
function sectionOpen(t, key) { return t.mode !== 'sectional' || t.current_section === key; }
// Applies time-based transitions (section lock, auto-submit). Returns the fresh exam row.
function tick(examId) {
  let exam = getExam(examId);
  if (exam.status !== 'In Progress') return exam;
  const now = nowIso();
  for (let guard = 0; guard < 5; guard++) {
    const t = readTiming(exam);
    if (t.mode !== 'sectional') break;
    const cur = t.sections?.[t.current_section];
    const idx = t.order.indexOf(t.current_section);
    if (!cur || cur.deadline_at > now || idx >= t.order.length - 1) break;
    moveToNextSection(exam, cur.deadline_at, 'timer');
    exam = getExam(examId);
  }
  const grace = settings.get('timer.grace_seconds');
  if (exam.status === 'In Progress' && addSeconds(exam.deadline_at, grace) <= now) {
    submitExam(examId, { type: 'auto_timer', by: 'system' });
    exam = getExam(examId);
  }
  return exam;
}
function moveToNextSection(exam, atIso, reason) {
  const t = readTiming(exam);
  if (t.mode !== 'sectional') return false;
  const idx = t.order.indexOf(t.current_section);
  if (idx < 0 || idx >= t.order.length - 1) return false;
  const from = t.current_section; const to = t.order[idx + 1];
  t.sections[from].locked_at = atIso;
  t.current_section = to;
  t.sections[to] = { started_at: atIso, deadline_at: addMinutes(atIso, t.minutes[to]), locked_at: null };
  const later = t.order.slice(idx + 2).reduce((m, k) => m + (t.minutes[k] || 0), 0);
  const deadline = addMinutes(t.sections[to].deadline_at, later);
  getDb().prepare('UPDATE exams SET timing = ?, deadline_at = ?, modified_at = ? WHERE id = ?').run(JSON.stringify(t), deadline, nowIso(), exam.id);
  audit('SECTION_COMPLETED', { candidateId: exam.candidate_id, examId: exam.id, actor: reason === 'timer' ? 'system' : 'candidate', details: { section: from, next: to, reason } });
  return true;
}
// v1.0 name kept for compatibility
const moveToCommunication = (exam, atIso, reason) => moveToNextSection(exam, atIso, reason);
function remaining(exam) {
  const t = readTiming(exam);
  const now = Date.now();
  const out = { mode: t.mode, server_time: new Date(now).toISOString(), deadline_at: exam.deadline_at,
    remaining_seconds: exam.deadline_at ? Math.max(0, Math.floor((new Date(exam.deadline_at).getTime() - now) / 1000)) : null,
    current_section: t.current_section || null, section_order: t.order || [], section_deadline_at: null, section_remaining_seconds: null, locked_sections: [] };
  if (t.mode === 'sectional' && t.current_section) {
    const s = t.sections[t.current_section];
    out.section_deadline_at = s.deadline_at;
    out.section_remaining_seconds = Math.max(0, Math.floor((new Date(s.deadline_at).getTime() - now) / 1000));
    out.locked_sections = t.order.filter((k) => t.sections[k]?.locked_at);
    out.aptitude_locked = out.locked_sections.includes('aptitude');
    out.has_next_section = t.order.indexOf(t.current_section) < t.order.length - 1;
  }
  return out;
}

function startBlockers(exam) {
  const db = getDb();
  const blockers = [];
  if (exam.available_from && exam.available_from > nowIso()) blockers.push({ code: 'NOT_YET_OPEN', message: `This examination opens on ${new Date(exam.available_from).toUTCString().replace('GMT', 'UTC')}.` });
  if (settings.get('exam.collect_skills')) {
    const n = db.prepare('SELECT COUNT(*) n FROM candidate_skills WHERE candidate_id = ?').get(exam.candidate_id).n;
    if (n < Math.max(hasProgramming(exam) ? 1 : 0, settings.get('exam.min_skills'))) blockers.push({ code: 'SKILLS_REQUIRED', message: 'Please add your skills before starting.' });
  }
  if (hasProgramming(exam) && !exam.programming_language) blockers.push({ code: 'LANGUAGE_REQUIRED', message: 'Please choose your programming language before starting.' });
  return blockers;
}
function acceptAndStart(exam, req) {
  const db = getDb();
  if (exam.status === 'In Progress') return tick(exam.id);
  if (exam.status !== 'Assigned') throw httpError(409, `This exam cannot be started (${exam.status}).`);
  const blockers = startBlockers(exam);
  if (blockers.length) throw httpError(blockers[0].code === 'NOT_YET_OPEN' ? 425 : 409, blockers[0].message, blockers[0].code);
  const now = nowIso();
  const cfg = timingConfig(exam);
  const t = { mode: cfg.mode, order: cfg.order, minutes: cfg.minutes, total_minutes: cfg.total_minutes, current_section: cfg.order[0], sections: {} };
  for (const k of cfg.order) t[`${k}_minutes`] = cfg.minutes[k]; // readable copies
  let deadline;
  if (cfg.mode === 'sectional') {
    t.sections[cfg.order[0]] = { started_at: now, deadline_at: addMinutes(now, cfg.minutes[cfg.order[0]]), locked_at: null };
    deadline = addMinutes(now, cfg.order.reduce((m, k) => m + cfg.minutes[k], 0));
  } else {
    deadline = addMinutes(now, cfg.total_minutes);
  }
  const ip = settings.get('exam.capture_ip') ? req.ip : null;
  const ua = settings.get('exam.capture_browser') ? (req.get('user-agent') || '').slice(0, 300) : null;
  const upd = db.prepare(`UPDATE exams SET status = 'In Progress', instructions_accepted_at = ?, started_at = ?, deadline_at = ?, timing = ?,
    ip_address = ?, user_agent = ?, modified_at = ? WHERE id = ? AND status = 'Assigned'`).run(now, now, deadline, JSON.stringify(t), ip, ua, now, exam.id);
  if (!upd.changes) return tick(exam.id); // raced with another request
  patchCandidate(exam.candidate_id, { candidate_status: 'Exam Started', exam_status: 'In Progress', exam_start_date: now });
  audit('INSTRUCTIONS_ACCEPTED', { candidateId: exam.candidate_id, examId: exam.id, actor: 'candidate', req });
  audit('EXAM_STARTED', { candidateId: exam.candidate_id, examId: exam.id, actor: 'candidate', req, details: { deadline, mode: cfg.mode, sections: cfg.order, programming_language: exam.programming_language } });
  enqueueExamTree(exam.id);
  return getExam(exam.id);
}

// ---------- Paper (never includes correct answers) ----------
function getPaper(exam) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY section, display_order').all(exam.id);
  const apt = []; const com = []; const prg = [];
  for (const r of rows) {
    if (r.section === 'aptitude') {
      const q = db.prepare('SELECT id, category, question, table_json, option_a, option_b, option_c, option_d FROM aptitude_questions WHERE id = ?').get(r.question_id);
      const order = parseJson(r.option_order, LETTERS);
      const a = db.prepare('SELECT selected_answer, marked_for_review FROM aptitude_answers WHERE exam_id = ? AND question_id = ?').get(exam.id, q.id);
      const selDisplay = a && a.selected_answer ? LETTERS[order.indexOf(a.selected_answer)] : null;
      apt.push({ id: r.id, number: r.display_order, category: q.category, question: q.question, table: parseJson(q.table_json),
        options: order.map((orig, i) => ({ key: LETTERS[i], text: q['option_' + orig.toLowerCase()] })),
        answer: selDisplay, review: !!(a && a.marked_for_review) });
    } else if (r.section === 'programming') {
      const q = db.prepare(`SELECT q.id, q.topic, q.task_type, q.difficulty, q.question, q.starter_code, q.expected_minutes, q.marks, q.language, l.label
        FROM programming_questions q JOIN programming_languages l ON l.key = q.language WHERE q.id = ?`).get(r.question_id);
      const a = db.prepare('SELECT answer_text, marked_for_review FROM programming_answers WHERE exam_id = ? AND question_id = ?').get(exam.id, q.id);
      prg.push({ id: r.id, number: r.display_order, topic: q.topic, task_type: q.task_type, question: q.question, starter_code: q.starter_code,
        language: q.language, language_label: q.label, expected_minutes: q.expected_minutes, marks: q.marks,
        answer: a ? a.answer_text || '' : '', review: !!(a && a.marked_for_review) });
    } else {
      const q = db.prepare('SELECT id, question, expected_words_min, expected_words_max, marks FROM communication_questions WHERE id = ?').get(r.question_id);
      const a = db.prepare('SELECT answer_text, word_count, marked_for_review FROM communication_answers WHERE exam_id = ? AND question_id = ?').get(exam.id, q.id);
      com.push({ id: r.id, number: r.display_order, question: q.question, min_words: q.expected_words_min, max_words: q.expected_words_max,
        answer: a ? a.answer_text || '' : '', word_count: a ? a.word_count : 0, review: !!(a && a.marked_for_review) });
    }
  }
  return prg.length ? { aptitude: apt, communication: com, programming: prg } : { aptitude: apt, communication: com };
}

// ---------- Autosave ----------
function saveAnswers(exam, body, req) {
  const db = getDb();
  exam = tick(exam.id);
  if (SUBMITTED.includes(exam.status)) throw httpError(409, 'This examination has already been submitted and is locked.', 'LOCKED');
  if (exam.status !== 'In Progress') throw httpError(409, 'The examination is not in progress.', 'NOT_IN_PROGRESS');
  const now = nowIso();
  const grace = settings.get('timer.grace_seconds');
  if (addSeconds(exam.deadline_at, grace) < now) throw httpError(409, 'Time is up.', 'TIME_UP');
  const t = readTiming(exam);
  const eqs = db.prepare('SELECT * FROM exam_questions WHERE exam_id = ?').all(exam.id);
  const byId = new Map(eqs.map((e) => [e.id, e]));
  let saved = 0; const rejected = [];
  tx(() => {
    for (const a of body.aptitude || []) {
      const eq = byId.get(Number(a.id));
      if (!eq || eq.section !== 'aptitude') { rejected.push(a.id); continue; }
      if (!sectionOpen(t, 'aptitude')) { rejected.push(a.id); continue; }
      let orig = null;
      if (a.answer !== null && a.answer !== undefined && a.answer !== '') {
        const idx = LETTERS.indexOf(String(a.answer).toUpperCase());
        if (idx < 0) { rejected.push(a.id); continue; }
        orig = parseJson(eq.option_order, LETTERS)[idx];
      }
      const prev = db.prepare('SELECT * FROM aptitude_answers WHERE exam_id = ? AND question_id = ?').get(exam.id, eq.question_id);
      const review = a.review ? 1 : 0;
      if (!prev) {
        db.prepare(`INSERT INTO aptitude_answers(exam_id, question_id, selected_answer, marked_for_review, first_answered_at, answered_at, change_count)
          VALUES (?,?,?,?,?,?,0)`).run(exam.id, eq.question_id, orig, review, orig ? now : null, orig ? now : null);
      } else if (prev.selected_answer !== orig || prev.marked_for_review !== review) {
        db.prepare(`UPDATE aptitude_answers SET selected_answer = ?, marked_for_review = ?, answered_at = ?, first_answered_at = COALESCE(first_answered_at, ?),
          change_count = change_count + ? WHERE id = ?`).run(orig, review, now, orig ? now : null, prev.selected_answer !== orig ? 1 : 0, prev.id);
      }
      saved++;
    }
    for (const c of body.communication || []) {
      const eq = byId.get(Number(c.id));
      if (!eq || eq.section !== 'communication') { rejected.push(c.id); continue; }
      if (!sectionOpen(t, 'communication')) { rejected.push(c.id); continue; }
      const text = typeof c.text === 'string' ? c.text.slice(0, 20000) : '';
      const wc = wordCount(text);
      const review = c.review ? 1 : 0;
      const prev = db.prepare('SELECT * FROM communication_answers WHERE exam_id = ? AND question_id = ?').get(exam.id, eq.question_id);
      if (!prev) {
        db.prepare(`INSERT INTO communication_answers(exam_id, question_id, answer_text, word_count, marked_for_review, first_answered_at, answered_at)
          VALUES (?,?,?,?,?,?,?)`).run(exam.id, eq.question_id, text, wc, review, text ? now : null, text ? now : null);
      } else if (prev.answer_text !== text || prev.marked_for_review !== review) {
        db.prepare(`UPDATE communication_answers SET answer_text = ?, word_count = ?, marked_for_review = ?, answered_at = ?,
          first_answered_at = COALESCE(first_answered_at, ?) WHERE id = ?`).run(text, wc, review, now, text ? now : null, prev.id);
      }
      saved++;
    }
    for (const c of body.programming || []) {
      const eq = byId.get(Number(c.id));
      if (!eq || eq.section !== 'programming') { rejected.push(c.id); continue; }
      if (!sectionOpen(t, 'programming')) { rejected.push(c.id); continue; }
      const text = typeof c.text === 'string' ? c.text.replace(/\r\n/g, '\n').slice(0, 20000) : '';
      const lines = text.trim() ? text.trim().split('\n').length : 0;
      const review = c.review ? 1 : 0;
      const prev = db.prepare('SELECT * FROM programming_answers WHERE exam_id = ? AND question_id = ?').get(exam.id, eq.question_id);
      if (!prev) {
        db.prepare(`INSERT INTO programming_answers(exam_id, question_id, answer_text, line_count, char_count, marked_for_review, first_answered_at, answered_at)
          VALUES (?,?,?,?,?,?,?,?)`).run(exam.id, eq.question_id, text, lines, text.length, review, text.trim() ? now : null, text.trim() ? now : null);
      } else if (prev.answer_text !== text || prev.marked_for_review !== review) {
        db.prepare(`UPDATE programming_answers SET answer_text = ?, line_count = ?, char_count = ?, marked_for_review = ?, answered_at = ?,
          first_answered_at = COALESCE(first_answered_at, ?) WHERE id = ?`).run(text, lines, text.length, review, now, text.trim() ? now : null, prev.id);
      }
      saved++;
    }
    db.prepare('UPDATE exams SET last_autosave_at = ? WHERE id = ?').run(now, exam.id);
  });
  // Periodic autosaves are not individually audit-logged (too noisy); last_autosave_at is tracked on the exam.
  return { saved, rejected, saved_at: now, timing: remaining(getExam(exam.id)) };
}

// ---------- Integrity events ----------
const EVENT_TYPES = { tab_hidden: 'TAB_SWITCH', window_blur: 'WINDOW_BLUR', copy_attempt: 'COPY_ATTEMPT', paste_attempt: 'PASTE_ATTEMPT',
  cut_attempt: 'CUT_ATTEMPT', right_click: 'RIGHT_CLICK', fullscreen_exit: 'FULLSCREEN_EXIT', devtools_key: 'DEVTOOLS_SHORTCUT',
  back_navigation: 'BACK_NAVIGATION', reload_attempt: 'RELOAD_ATTEMPT', offline: 'CONNECTION_LOST', online: 'CONNECTION_RESTORED' };
function recordEvent(exam, { type, details }, req) {
  const ev = EVENT_TYPES[type];
  if (!ev) throw httpError(400, 'Unknown event type');
  if (exam.status !== 'In Progress') return { tab_switch_count: exam.tab_switch_count };
  const db = getDb();
  if (type === 'tab_hidden') db.prepare('UPDATE exams SET tab_switch_count = tab_switch_count + 1 WHERE id = ?').run(exam.id);
  if (!['online'].includes(type)) db.prepare('UPDATE exams SET suspicious_event_count = suspicious_event_count + 1 WHERE id = ?').run(exam.id);
  audit('SUSPICIOUS_' + ev, { candidateId: exam.candidate_id, examId: exam.id, actor: 'candidate', req,
    details: typeof details === 'object' && details ? JSON.parse(JSON.stringify(details).slice(0, 1000)) : null });
  const e = getExam(exam.id);
  return { tab_switch_count: e.tab_switch_count, warning_limit: settings.get('exam.tab_switch_warning_limit') };
}

// ---------- Submission ----------
// Idempotent & race-safe: only the first caller transitions the exam; later calls get LOCKED.
function submitExam(examId, { type = 'manual', by = 'candidate', req = null } = {}) {
  const db = getDb();
  const now = nowIso();
  const exam = getExam(examId);
  if (SUBMITTED.includes(exam.status)) throw httpError(409, 'This examination has already been submitted.', 'ALREADY_SUBMITTED');
  if (exam.status !== 'In Progress') throw httpError(409, `The examination cannot be submitted (${exam.status}).`);
  const endTime = type === 'auto_timer' && exam.deadline_at < now ? exam.deadline_at : now;
  const dur = Math.round((new Date(endTime) - new Date(exam.started_at)) / 1000);
  const changed = db.prepare(`UPDATE exams SET status = 'Submitted', submitted_at = ?, submission_type = ?, submitted_by = ?, duration_seconds = ?,
    modified_at = ? WHERE id = ? AND status = 'In Progress'`).run(endTime, type, by, dur, now, examId).changes;
  if (!changed) throw httpError(409, 'This examination has already been submitted.', 'ALREADY_SUBMITTED');
  db.prepare("UPDATE sessions SET expires_at = ? WHERE exam_id = ? AND kind = 'candidate' AND revoked = 0").run(addMinutes(now, 30), examId);
  patchCandidate(exam.candidate_id, { candidate_status: 'Exam Completed', exam_status: 'Submitted', exam_completion_date: endTime });
  audit('EXAM_SUBMITTED', { candidateId: exam.candidate_id, examId, actor: by === 'candidate' ? 'candidate' : by, req,
    details: { submission_type: type, duration_seconds: dur, tab_switch_count: exam.tab_switch_count } });
  // Aptitude is scored synchronously; communication evaluation runs in the background.
  const { onExamSubmitted } = require('./results');
  onExamSubmitted(examId);
  return getExam(examId);
}

function progressSummary(examId) {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) n FROM exam_questions WHERE exam_id = ?').get(examId).n;
  const apt = db.prepare("SELECT COUNT(*) n FROM aptitude_answers WHERE exam_id = ? AND selected_answer IS NOT NULL").get(examId).n;
  const com = db.prepare("SELECT COUNT(*) n FROM communication_answers WHERE exam_id = ? AND word_count > 0").get(examId).n;
  const prg = db.prepare("SELECT COUNT(*) n FROM programming_answers WHERE exam_id = ? AND trim(COALESCE(answer_text,'')) <> ''").get(examId).n;
  return { total, answered: apt + com + prg, aptitude_answered: apt, communication_answered: com, programming_answered: prg };
}

// Background sweeper: auto-submit exams whose timer expired while the browser was closed, and expire stale links.
function sweep() {
  const db = getDb();
  const now = nowIso();
  const grace = settings.get('timer.grace_seconds');
  for (const e of db.prepare("SELECT id, deadline_at FROM exams WHERE status = 'In Progress'").all()) {
    try { tick(e.id); } catch (err) { console.error('sweep tick', e.id, err.message); }
  }
  for (const e of db.prepare("SELECT id, candidate_id FROM exams WHERE status = 'Assigned' AND link_expires_at < ?").all(now)) {
    db.prepare("UPDATE exams SET status = 'Expired', modified_at = ? WHERE id = ?").run(now, e.id);
    patchCandidate(e.candidate_id, { exam_status: 'Expired' });
    audit('EXAM_LINK_EXPIRED', { candidateId: e.candidate_id, examId: e.id });
  }
  void grace;
}

// ---------- Admin controls ----------
function adminResetSession(examId, { extendMinutes = 0 } = {}, req) {
  const db = getDb();
  const exam = getExam(examId);
  if (!exam) throw httpError(404, 'Exam not found');
  if (exam.status !== 'In Progress') throw httpError(409, 'Only an in-progress exam session can be reset');
  const t = parseJson(exam.timing, {});
  t.resume_override = true;
  let deadline = exam.deadline_at;
  const ext = Number(extendMinutes) || 0;
  if (ext > 0) {
    const base = deadline < nowIso() ? nowIso() : deadline;
    deadline = addMinutes(base, ext);
    if (t.mode === 'sectional') { const s = t.sections[t.current_section]; s.deadline_at = addMinutes(s.deadline_at < nowIso() ? nowIso() : s.deadline_at, ext); }
  }
  db.prepare('UPDATE exams SET timing = ?, deadline_at = ?, modified_at = ? WHERE id = ?').run(JSON.stringify(t), deadline, nowIso(), examId);
  db.prepare("UPDATE sessions SET revoked = 1, revoked_reason = 'admin_reset' WHERE exam_id = ? AND kind = 'candidate' AND revoked = 0").run(examId);
  audit('EXAM_SESSION_RESET', { candidateId: exam.candidate_id, examId, userId: req.user.id, actor: req.user.username, req, details: { extend_minutes: ext } });
}
function adminResetExam(examId, reason, req) {
  const db = getDb();
  const exam = getExam(examId);
  if (!exam) throw httpError(404, 'Exam not found');
  if (!['In Progress', 'Expired', 'Assigned'].includes(exam.status)) throw httpError(409, `An exam that is ${exam.status} cannot be reset`);
  if (!String(reason || '').trim()) throw httpError(400, 'A reason is required to reset an exam');
  tx(() => {
    db.prepare('DELETE FROM aptitude_answers WHERE exam_id = ?').run(examId);
    db.prepare('DELETE FROM communication_answers WHERE exam_id = ?').run(examId);
    db.prepare('DELETE FROM programming_answers WHERE exam_id = ?').run(examId);
    db.prepare(`UPDATE exams SET status = 'Assigned', started_at = NULL, deadline_at = NULL, timing = NULL, instructions_accepted_at = NULL,
      tab_switch_count = 0, suspicious_event_count = 0, resume_count = 0, active_session_id = NULL, modified_at = ? WHERE id = ?`).run(nowIso(), examId);
    db.prepare("UPDATE sessions SET revoked = 1, revoked_reason = 'admin_reset' WHERE exam_id = ? AND kind = 'candidate'").run(examId);
    require('./assignment').buildPaper(examId, exam.exam_set_id, exam.exam_type_id);
    if (exam.programming_language) require('./programming').assignProgramming(examId, exam.programming_language, { req, by: 'reset' });
  });
  const creds = require('./assignment').issueCredentials(examId);
  patchCandidate(exam.candidate_id, { candidate_status: 'Exam Assigned', exam_status: 'Assigned', exam_start_date: null });
  audit('EXAM_RESET', { candidateId: exam.candidate_id, examId, userId: req.user.id, actor: req.user.username, req, details: { reason } });
  require('./email').sendExamAssigned(getExam(examId), creds);
  enqueueExamTree(examId);
  return { credentials: creds };
}
function adminForceSubmit(examId, req) {
  const e = submitExam(examId, { type: 'admin', by: req.user.username, req });
  return e;
}

module.exports = { candidateLogin, acceptAndStart, getPaper, saveAnswers, recordEvent, submitExam, tick, remaining, moveToCommunication, moveToNextSection,
  startBlockers, hasProgramming, examSections, readTiming,
  progressSummary, sweep, adminResetSession, adminResetExam, adminForceSubmit, getExam, SUBMITTED };
