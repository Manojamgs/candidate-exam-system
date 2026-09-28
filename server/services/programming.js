'use strict';
// Programming section: candidate skills, supported languages, language-specific set selection and paper building.
const { getDb, tx } = require('../db');
const { nowIso, httpError, shuffle, parseJson } = require('../lib/util');
const settings = require('../lib/settings');
const { audit, actorOf } = require('../lib/audit');
const { enqueue } = require('./sync/queue');

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const CATEGORIES = ['Programming Language', 'Database', 'Platform', 'Framework', 'Tool', 'Other'];
// Common aliases so a declared skill like "C Sharp" or "Salesforce" maps to a test language.
const ALIASES = {
  java: ['java'], python: ['python', 'python3'], javascript: ['javascript', 'js', 'node', 'node.js', 'nodejs', 'typescript'],
  csharp: ['c#', 'csharp', 'c sharp', '.net', 'dotnet'], sql: ['sql', 'mysql', 'postgresql', 'postgres', 'sql server', 't-sql', 'oracle sql', 'sqlite', 'pl/sql'],
  apex: ['apex', 'salesforce apex', 'salesforce', 'salesforce development'],
};
const SUGGESTIONS = ['Java', 'Python', 'JavaScript', 'TypeScript', 'C#', '.NET', 'SQL', 'Salesforce Apex', 'Salesforce Admin', 'Lightning Web Components',
  'Node.js', 'React', 'Angular', 'HTML/CSS', 'PHP', 'Go', 'Kotlin', 'Swift', 'C++', 'Power BI', 'Excel', 'Git', 'Docker', 'AWS', 'Azure'];

// ---------- languages ----------
function listLanguages({ activeOnly = false } = {}) {
  const db = getDb();
  return db.prepare(`SELECT l.*, (SELECT COUNT(*) FROM programming_questions q WHERE q.language = l.key AND q.active = 1) AS active_questions
    FROM programming_languages l ${activeOnly ? 'WHERE l.active = 1' : ''} ORDER BY l.sort_order, l.label`).all()
    .map((l) => ({ ...l, sets: languageSets(l.key) }));
}
function languageSets(language) {
  const db = getDb();
  const rows = db.prepare(`SELECT set_number, COUNT(*) n, SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) active_n FROM programming_questions
    WHERE language = ? GROUP BY set_number ORDER BY set_number`).all(language);
  const need = programmingQuestionCount();
  return rows.map((r) => {
    const u = db.prepare(`SELECT COUNT(*) used, MAX(assigned_at) last_used_at FROM exams WHERE programming_language = ? AND programming_set = ?
      AND status NOT IN ('Cancelled')`).get(language, r.set_number);
    return { set_number: r.set_number, questions: r.n, active: r.active_n, ready: r.active_n >= need, used: u.used, last_used_at: u.last_used_at };
  });
}
function programmingQuestionCount() {
  const t = getDb().prepare("SELECT config FROM exam_types WHERE code = 'APT-COMM-PRG'").get();
  const sec = parseJson(t?.config, { sections: [] }).sections.find((s) => s.kind === 'code');
  return sec ? sec.questionCount : 10;
}
function saveLanguage(body, req) {
  const db = getDb();
  const key = String(body.key || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{2,20}$/.test(key)) throw httpError(400, 'Language key must be 2–20 lowercase letters, digits or _');
  const label = String(body.label || '').trim();
  if (!label) throw httpError(400, 'Label is required');
  const exists = db.prepare('SELECT * FROM programming_languages WHERE key = ?').get(key);
  if (exists) db.prepare('UPDATE programming_languages SET label = ?, active = ?, modified_at = ? WHERE key = ?').run(label, body.active === false ? 0 : 1, nowIso(), key);
  else db.prepare('INSERT INTO programming_languages(key, label, active, sort_order, created_at, modified_at) VALUES (?,?,?,99,?,?)').run(key, label, body.active === false ? 0 : 1, nowIso(), nowIso());
  audit(exists ? 'PROGRAMMING_LANGUAGE_UPDATED' : 'PROGRAMMING_LANGUAGE_CREATED', { ...actorOf(req), req, details: { key, label, active: body.active !== false } });
  return db.prepare('SELECT * FROM programming_languages WHERE key = ?').get(key);
}
function readyLanguages() { return listLanguages({ activeOnly: true }).filter((l) => l.sets.some((s) => s.ready)); }
function matchLanguage(skill) {
  const s = String(skill || '').trim().toLowerCase();
  for (const [key, list] of Object.entries(ALIASES)) if (list.includes(s)) return key;
  const l = getDb().prepare('SELECT key FROM programming_languages WHERE lower(label) = ? OR key = ?').get(s, s);
  return l ? l.key : null;
}

// ---------- skills ----------
function getSkills(candidateId) {
  return getDb().prepare('SELECT * FROM candidate_skills WHERE candidate_id = ? ORDER BY id').all(candidateId)
    .map((s) => ({ ...s, test_language: matchLanguage(s.skill) }));
}
function saveSkills(candidateId, skills, { source = 'hr', req = null } = {}) {
  if (!Array.isArray(skills)) throw httpError(400, 'skills must be a list', 'VALIDATION');
  if (skills.length > 25) throw httpError(400, 'A maximum of 25 skills can be recorded', 'VALIDATION');
  const clean = []; const seen = new Set();
  for (const s of skills) {
    const skill = String(s.skill || '').trim().replace(/\s+/g, ' ');
    if (!skill) continue;
    if (skill.length > 60) throw httpError(400, `Skill name too long: ${skill.slice(0, 20)}…`, 'VALIDATION');
    const k = skill.toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    const level = LEVELS.includes(s.level) ? s.level : null;
    if (!level) throw httpError(400, `Select a proficiency level for ${skill}`, 'VALIDATION');
    let years = s.years === '' || s.years === null || s.years === undefined ? null : Number(s.years);
    if (years !== null && !(years >= 0 && years <= 50)) throw httpError(400, `Years of experience for ${skill} must be 0–50`, 'VALIDATION');
    const category = CATEGORIES.includes(s.category) ? s.category : (matchLanguage(skill) ? 'Programming Language' : 'Other');
    clean.push({ skill, level, years, category });
  }
  const db = getDb();
  const before = getSkills(candidateId).map((s) => `${s.skill} (${s.level})`);
  tx(() => {
    db.prepare('DELETE FROM candidate_skills WHERE candidate_id = ?').run(candidateId);
    const ins = db.prepare(`INSERT INTO candidate_skills(candidate_id, skill, category, level, years, source, created_at, modified_at) VALUES (?,?,?,?,?,?,?,?)`);
    for (const s of clean) ins.run(candidateId, s.skill, s.category, s.level, s.years, source, nowIso(), nowIso());
  });
  const cand = db.prepare('SELECT candidate_code FROM candidates WHERE id = ?').get(candidateId);
  audit('CANDIDATE_SKILLS_UPDATED', { candidateId, ...(req ? actorOf(req) : { actor: source }), req, details: { source, before, after: clean.map((s) => `${s.skill} (${s.level})`) } });
  enqueue('candidates', cand.candidate_code); enqueue('candidate_skills', cand.candidate_code);
  return getSkills(candidateId);
}

// ---------- set selection & paper ----------
function choosePrgSet(candidateId, language, { manualSet = null, excludeExamId = null } = {}) {
  const db = getDb();
  const sets = languageSets(language).filter((s) => s.ready);
  if (!sets.length) throw httpError(409, `No complete programming sets are available for ${language}`, 'NO_PRG_SETS');
  if (manualSet) {
    const s = sets.find((x) => x.set_number === Number(manualSet));
    if (!s) throw httpError(400, 'Select a complete programming set');
    return s.set_number;
  }
  const used = new Set(db.prepare(`SELECT programming_set FROM exams WHERE candidate_id = ? AND programming_language = ? AND status <> 'Cancelled'
    AND id <> COALESCE(?, -1) AND programming_set IS NOT NULL`).all(candidateId, language, excludeExamId).map((r) => r.programming_set));
  let pool = sets.filter((s) => !used.has(s.set_number));
  if (!pool.length) pool = sets;
  pool.sort((a, b) => (a.last_used_at || '').localeCompare(b.last_used_at || '') || a.used - b.used || a.set_number - b.set_number);
  return pool[0].set_number;
}
function assignProgramming(examId, language, { manualSet = null, req = null, by = 'hr' } = {}) {
  const db = getDb();
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) throw httpError(404, 'Exam not found');
  if (!examHasProgramming(exam)) throw httpError(400, 'This exam does not include a programming section');
  if (!['Assigned', 'Pending Approval'].includes(exam.status)) throw httpError(409, 'The programming language can only be set before the exam starts', 'LOCKED');
  const lang = db.prepare('SELECT * FROM programming_languages WHERE key = ? AND active = 1').get(String(language || ''));
  if (!lang) throw httpError(400, 'Select a supported programming language', 'VALIDATION');
  const setNo = choosePrgSet(exam.candidate_id, lang.key, { manualSet, excludeExamId: examId });
  const need = programmingQuestionCount();
  tx(() => {
    db.prepare("DELETE FROM exam_questions WHERE exam_id = ? AND section = 'programming'").run(examId);
    let qs = db.prepare('SELECT id FROM programming_questions WHERE language = ? AND set_number = ? AND active = 1 ORDER BY code').all(lang.key, setNo);
    if (qs.length > need) qs = shuffle(qs).slice(0, need).sort((a, b) => a.id - b.id);
    if (settings.get('exam.randomize_questions')) qs = shuffle(qs);
    const ins = db.prepare("INSERT INTO exam_questions(exam_id, section, question_id, display_order, option_order) VALUES (?, 'programming', ?, ?, NULL)");
    qs.forEach((q, i) => ins.run(examId, q.id, i + 1));
    db.prepare('UPDATE exams SET programming_language = ?, programming_set = ?, modified_at = ? WHERE id = ?').run(lang.key, setNo, nowIso(), examId);
    db.prepare('UPDATE candidates SET programming_language = ?, modified_at = ? WHERE id = ?').run(lang.label, nowIso(), exam.candidate_id);
  });
  audit('PROGRAMMING_LANGUAGE_SELECTED', { candidateId: exam.candidate_id, examId, ...(req?.user ? actorOf(req) : { actor: by }), req,
    details: { language: lang.key, set: setNo, selected_by: by } });
  return { language: lang.key, label: lang.label, set: setNo };
}
function examHasProgramming(exam) {
  const t = getDb().prepare('SELECT config FROM exam_types WHERE id = ?').get(exam.exam_type_id);
  return parseJson(t?.config, { sections: [] }).sections.some((s) => s.kind === 'code');
}
function prgSetLabel(exam) { return exam.programming_language ? `${exam.programming_language.toUpperCase()}-SET-${exam.programming_set}` : null; }

// ---------- question bank ----------
function listQuestions(q = {}) {
  const w = []; const p = {};
  if (q.language) { w.push('q.language = @lang'); p.lang = q.language; }
  if (q.set_number) { w.push('q.set_number = @set'); p.set = Number(q.set_number); }
  if (q.difficulty) { w.push('q.difficulty = @dif'); p.dif = q.difficulty; }
  if (q.task_type) { w.push('q.task_type = @tt'); p.tt = q.task_type; }
  if (q.active === '1' || q.active === '0') { w.push('q.active = @act'); p.act = Number(q.active); }
  if (q.q) { w.push('(q.question LIKE @q OR q.code LIKE @q OR q.topic LIKE @q)'); p.q = `%${q.q}%`; }
  const rows = getDb().prepare(`SELECT q.*, l.label language_label, (SELECT COUNT(*) FROM exam_questions eq WHERE eq.section = 'programming' AND eq.question_id = q.id) times_used
    FROM programming_questions q JOIN programming_languages l ON l.key = q.language ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
    ORDER BY l.sort_order, q.set_number, q.code`).all(p)
    .map((r) => ({ ...r, evaluation_points: parseJson(r.evaluation_points, []), test_cases: parseJson(r.test_cases, []) }));
  return { rows, languages: listLanguages() };
}
function lockedByUse(id) {
  return getDb().prepare(`SELECT COUNT(*) n FROM exam_questions eq JOIN exams e ON e.id = eq.exam_id WHERE eq.section = 'programming' AND eq.question_id = ?
    AND e.status IN ('In Progress','Submitted','Under Evaluation','Evaluated','Completed','Voided')`).get(id).n > 0;
}
const TASK_TYPES = ['write_code', 'fix_bug', 'explain_output', 'complete_code'];
function saveQuestion(id, body, req) {
  const db = getDb();
  const before = id ? db.prepare('SELECT * FROM programming_questions WHERE id = ?').get(id) : null;
  if (id && !before) throw httpError(404, 'Question not found');
  const d = { ...(before || {}), ...body };
  const points = Array.isArray(body.evaluation_points) ? body.evaluation_points.map(String).filter((x) => x.trim()) : parseJson(before?.evaluation_points, []);
  const tests = Array.isArray(body.test_cases) ? body.test_cases : parseJson(before?.test_cases, []);
  const active = body.active === undefined ? (before ? before.active : 1) : (body.active ? 1 : 0);
  const errs = [];
  if (!String(d.question || '').trim()) errs.push('question text');
  if (!String(d.reference_solution || '').trim()) errs.push('reference solution');
  if (points.length < 2) errs.push('at least 2 evaluation points');
  if (!TASK_TYPES.includes(d.task_type)) errs.push('a valid task type');
  if (['fix_bug', 'explain_output', 'complete_code'].includes(d.task_type) && !String(d.starter_code || '').trim()) errs.push('starter code for this task type');
  if (!['Easy', 'Medium', 'Hard'].includes(d.difficulty)) errs.push('difficulty');
  if (!db.prepare('SELECT 1 FROM programming_languages WHERE key = ?').get(d.language)) errs.push('a valid language');
  if (!(Number(d.set_number) >= 1)) errs.push('set number');
  if (!(Number(d.marks ?? 10) > 0)) errs.push('marks > 0');
  if (errs.length && (active || !String(d.question || '').trim() || !db.prepare('SELECT 1 FROM programming_languages WHERE key = ?').get(d.language)))
    throw httpError(400, `${active ? 'Cannot activate question' : 'Cannot save question'}: ${errs.join(', ')} required`, 'VALIDATION');
  if (before && lockedByUse(id) && ['question', 'starter_code', 'reference_solution', 'marks', 'language', 'task_type'].some((k) => String(before[k] ?? '') !== String(d[k] ?? '')))
    throw httpError(409, 'This question has been used in an exam attempt. Its content and marks are locked to keep results auditable — deactivate it and create a new version instead.', 'LOCKED');
  const now = nowIso();
  const row = { language: d.language, set_number: Number(d.set_number), topic: d.topic || null, task_type: d.task_type || 'write_code', difficulty: d.difficulty || 'Medium',
    question: String(d.question).trim(), starter_code: d.starter_code || null, reference_solution: d.reference_solution || '', evaluation_points: JSON.stringify(points),
    test_cases: JSON.stringify(tests), expected_minutes: Number(d.expected_minutes) || 4, marks: Number(d.marks ?? 10), active, modified_at: now };
  if (before) {
    db.prepare(`UPDATE programming_questions SET ${Object.keys(row).map((k) => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...row, id });
    audit('PROGRAMMING_QUESTION_UPDATED', { ...actorOf(req), req, details: { code: before.code } });
  } else {
    const prefix = `PRG-${row.language.toUpperCase()}-S${row.set_number}-`;
    const max = db.prepare('SELECT code FROM programming_questions WHERE code LIKE ?').all(prefix + '%').reduce((m, r) => Math.max(m, parseInt(r.code.split('-').pop(), 10) || 0), 0);
    row.code = body.code || `${prefix}${String(max + 1).padStart(2, '0')}`; row.created_at = now;
    id = db.prepare(`INSERT INTO programming_questions(${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map((k) => '@' + k).join(',')})`).run(row).lastInsertRowid;
    audit('PROGRAMMING_QUESTION_CREATED', { ...actorOf(req), req, details: { code: row.code } });
  }
  const saved = db.prepare('SELECT * FROM programming_questions WHERE id = ?').get(id);
  enqueue('programming_questions', saved.code);
  return { ...saved, evaluation_points: parseJson(saved.evaluation_points, []), test_cases: parseJson(saved.test_cases, []), validation_warnings: errs };
}
function deleteQuestion(id, req) {
  const db = getDb();
  const q = db.prepare('SELECT * FROM programming_questions WHERE id = ?').get(id);
  if (!q) throw httpError(404, 'Question not found');
  const used = db.prepare("SELECT COUNT(*) n FROM exam_questions WHERE section = 'programming' AND question_id = ?").get(id).n;
  if (used) {
    db.prepare('UPDATE programming_questions SET active = 0, modified_at = ? WHERE id = ?').run(nowIso(), id);
    audit('PROGRAMMING_QUESTION_DEACTIVATED', { ...actorOf(req), req, details: { code: q.code } });
    enqueue('programming_questions', q.code);
    return { deactivated: true, message: 'Question has exam history, so it was deactivated instead of deleted.' };
  }
  db.prepare('DELETE FROM programming_questions WHERE id = ?').run(id);
  audit('PROGRAMMING_QUESTION_DELETED', { ...actorOf(req), req, details: { code: q.code } });
  return { deleted: true };
}

module.exports = { listLanguages, languageSets, readyLanguages, saveLanguage, matchLanguage, getSkills, saveSkills, choosePrgSet, assignProgramming,
  examHasProgramming, prgSetLabel, listQuestions, saveQuestion, deleteQuestion, programmingQuestionCount, LEVELS, CATEGORIES, SUGGESTIONS, TASK_TYPES };
