'use strict';
// Question bank management (aptitude MCQ + communication) and exam-set management.
const { getDb } = require('../db');
const { nowIso, httpError, parseJson } = require('../lib/util');
const { audit, actorOf } = require('../lib/audit');
const { enqueue } = require('./sync/queue');

const CATEGORIES = ['Quantitative Aptitude', 'Logical Reasoning', 'Numerical Reasoning', 'Data Interpretation'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

function listAptitude(q = {}) {
  const w = []; const p = {};
  if (q.exam_set) { w.push('s.code = @set'); p.set = q.exam_set; }
  if (q.category) { w.push('q.category = @cat'); p.cat = q.category; }
  if (q.difficulty) { w.push('q.difficulty = @dif'); p.dif = q.difficulty; }
  if (q.active === '1' || q.active === '0') { w.push('q.active = @act'); p.act = Number(q.active); }
  if (q.q) { w.push('(q.question LIKE @q OR q.code LIKE @q OR q.topic LIKE @q)'); p.q = `%${q.q}%`; }
  const rows = getDb().prepare(`SELECT q.*, s.code set_code, (SELECT COUNT(*) FROM exam_questions eq WHERE eq.question_id = q.id AND eq.section = 'aptitude') times_used
    FROM aptitude_questions q LEFT JOIN exam_sets s ON s.id = q.exam_set_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY s.code, q.code`).all(p)
    .map((r) => ({ ...r, table: parseJson(r.table_json) }));
  return { rows, categories: CATEGORIES, difficulties: DIFFICULTIES };
}

// Validation performed before a question may be active.
function validateAptitude(d) {
  const errs = [];
  if (!String(d.question || '').trim()) errs.push('Question text is required');
  const opts = ['option_a', 'option_b', 'option_c', 'option_d'].map((k) => String(d[k] || '').trim());
  if (opts.some((o) => !o)) errs.push('All four options (A–D) are required');
  if (new Set(opts.map((o) => o.toLowerCase())).size !== 4 && opts.every(Boolean)) errs.push('Options must be distinct');
  if (!['A', 'B', 'C', 'D'].includes(d.correct_answer)) errs.push('Correct answer must be one of A, B, C or D');
  else if (!opts['ABCD'.indexOf(d.correct_answer)]) errs.push('Correct answer must match one of the options');
  if (!d.category) errs.push('Category is required');
  if (!DIFFICULTIES.includes(d.difficulty)) errs.push('Difficulty must be Easy, Medium or Hard');
  if (!(Number(d.marks) > 0)) errs.push('Marks must be greater than zero');
  if (d.table && (!Array.isArray(d.table.headers) || !Array.isArray(d.table.rows))) errs.push('Table must have headers and rows');
  return errs;
}
function nextCode(prefix, setCode, table) {
  const s = setCode ? `S${setCode.replace(/\D/g, '').padStart(2, '0')}` : 'GEN';
  const rows = getDb().prepare(`SELECT code FROM ${table} WHERE code LIKE ?`).all(`${prefix}-${s}-%`);
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.code.split('-').pop(), 10) || 0), 0);
  return `${prefix}-${s}-${String(max + 1).padStart(2, '0')}`;
}
function lockedByUse(section, id) {
  // A question already presented in a submitted exam must not be edited in a way that changes scoring history.
  return getDb().prepare(`SELECT COUNT(*) n FROM exam_questions eq JOIN exams e ON e.id = eq.exam_id WHERE eq.section = ? AND eq.question_id = ?
    AND e.status IN ('In Progress','Submitted','Under Evaluation','Evaluated','Completed')`).get(section, id).n > 0;
}

function saveAptitude(id, body, req) {
  const db = getDb();
  const before = id ? db.prepare('SELECT * FROM aptitude_questions WHERE id = ?').get(id) : null;
  if (id && !before) throw httpError(404, 'Question not found');
  const d = { ...(before || {}), ...body };
  d.correct_answer = String(d.correct_answer || '').toUpperCase();
  if (body.table !== undefined) d.table_json = body.table ? JSON.stringify(body.table) : null;
  d.table = parseJson(d.table_json);
  const active = body.active === undefined ? (before ? before.active : 1) : (body.active ? 1 : 0);
  const errs = validateAptitude(d);
  if (errs.length && active) throw httpError(400, `Cannot activate question: ${errs.join('; ')}`, 'VALIDATION');
  if (!String(d.question || '').trim()) throw httpError(400, 'Question text is required', 'VALIDATION');
  const set = d.exam_set_id ? db.prepare('SELECT * FROM exam_sets WHERE id = ?').get(d.exam_set_id) : null;
  if (d.exam_set_id && !set) throw httpError(400, 'Exam set not found');
  if (before && lockedByUse('aptitude', id) && (before.correct_answer !== d.correct_answer || ['option_a', 'option_b', 'option_c', 'option_d', 'question'].some((k) => before[k] !== d[k]) || Number(before.marks) !== Number(d.marks)))
    throw httpError(409, 'This question has been used in an exam attempt. Its text, options, answer and marks are locked to preserve result auditability — deactivate it and create a new version instead.', 'LOCKED');
  const now = nowIso();
  const row = { exam_set_id: d.exam_set_id || null, category: d.category, topic: d.topic || null, difficulty: d.difficulty, question: String(d.question).trim(),
    table_json: d.table_json || null, option_a: d.option_a, option_b: d.option_b, option_c: d.option_c, option_d: d.option_d,
    correct_answer: d.correct_answer || 'A', marks: Number(d.marks) || 1, explanation: d.explanation || null, active, modified_at: now };
  if (before) {
    db.prepare(`UPDATE aptitude_questions SET ${Object.keys(row).map((k) => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...row, id });
    audit('QUESTION_UPDATED', { ...actorOf(req), req, details: { code: before.code, section: 'aptitude', changes: Object.keys(row).filter((k) => k !== 'modified_at' && String(before[k]) !== String(row[k])) } });
  } else {
    row.code = body.code || nextCode('APT', set?.code, 'aptitude_questions'); row.created_at = now;
    id = db.prepare(`INSERT INTO aptitude_questions(${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map((k) => '@' + k).join(',')})`).run(row).lastInsertRowid;
    audit('QUESTION_CREATED', { ...actorOf(req), req, details: { code: row.code, section: 'aptitude' } });
  }
  const saved = db.prepare('SELECT * FROM aptitude_questions WHERE id = ?').get(id);
  enqueue('aptitude_questions', saved.code);
  return { ...saved, validation_warnings: errs };
}
function deleteAptitude(id, req) {
  const db = getDb();
  const q = db.prepare('SELECT * FROM aptitude_questions WHERE id = ?').get(id);
  if (!q) throw httpError(404, 'Question not found');
  const used = db.prepare("SELECT COUNT(*) n FROM exam_questions WHERE section = 'aptitude' AND question_id = ?").get(id).n;
  if (used) {
    db.prepare('UPDATE aptitude_questions SET active = 0, modified_at = ? WHERE id = ?').run(nowIso(), id);
    audit('QUESTION_DEACTIVATED', { ...actorOf(req), req, details: { code: q.code, reason: 'delete requested but question has exam history' } });
    enqueue('aptitude_questions', q.code);
    return { deactivated: true, message: 'Question has exam history, so it was deactivated instead of deleted.' };
  }
  db.prepare('DELETE FROM aptitude_questions WHERE id = ?').run(id);
  audit('QUESTION_DELETED', { ...actorOf(req), req, details: { code: q.code, section: 'aptitude' } });
  return { deleted: true };
}

function listCommunication(q = {}) {
  const w = []; const p = {};
  if (q.exam_set) { w.push('s.code = @set'); p.set = q.exam_set; }
  if (q.active === '1' || q.active === '0') { w.push('q.active = @act'); p.act = Number(q.active); }
  if (q.q) { w.push('(q.question LIKE @q OR q.code LIKE @q OR q.category LIKE @q)'); p.q = `%${q.q}%`; }
  return { rows: getDb().prepare(`SELECT q.*, s.code set_code, (SELECT COUNT(*) FROM exam_questions eq WHERE eq.question_id = q.id AND eq.section = 'communication') times_used
    FROM communication_questions q LEFT JOIN exam_sets s ON s.id = q.exam_set_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY s.code, q.code`).all(p) };
}
function saveCommunication(id, body, req) {
  const db = getDb();
  const before = id ? db.prepare('SELECT * FROM communication_questions WHERE id = ?').get(id) : null;
  if (id && !before) throw httpError(404, 'Question not found');
  const d = { ...(before || {}), ...body };
  if (!String(d.question || '').trim()) throw httpError(400, 'Question text is required', 'VALIDATION');
  const min = Number(d.expected_words_min ?? 100); const max = Number(d.expected_words_max ?? 200);
  if (!(min > 0 && max >= min)) throw httpError(400, 'Expected word count range is invalid', 'VALIDATION');
  if (!(Number(d.marks ?? 10) > 0)) throw httpError(400, 'Marks must be greater than zero', 'VALIDATION');
  if (before && lockedByUse('communication', id) && (before.question !== d.question || Number(before.marks) !== Number(d.marks)))
    throw httpError(409, 'This question has been used in an exam attempt; its text and marks are locked. Deactivate it and create a new version instead.', 'LOCKED');
  const set = d.exam_set_id ? db.prepare('SELECT * FROM exam_sets WHERE id = ?').get(d.exam_set_id) : null;
  const now = nowIso();
  const row = { exam_set_id: d.exam_set_id || null, category: d.category || null, question: String(d.question).trim(), expected_words_min: min, expected_words_max: max,
    marks: Number(d.marks ?? 10), active: body.active === undefined ? (before ? before.active : 1) : (body.active ? 1 : 0), modified_at: now };
  if (before) {
    db.prepare(`UPDATE communication_questions SET ${Object.keys(row).map((k) => `${k}=@${k}`).join(',')} WHERE id=@id`).run({ ...row, id });
    audit('QUESTION_UPDATED', { ...actorOf(req), req, details: { code: before.code, section: 'communication' } });
  } else {
    row.code = body.code || nextCode('COM', set?.code, 'communication_questions'); row.created_at = now;
    id = db.prepare(`INSERT INTO communication_questions(${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map((k) => '@' + k).join(',')})`).run(row).lastInsertRowid;
    audit('QUESTION_CREATED', { ...actorOf(req), req, details: { code: row.code, section: 'communication' } });
  }
  const saved = db.prepare('SELECT * FROM communication_questions WHERE id = ?').get(id);
  enqueue('communication_questions', saved.code);
  return saved;
}
function deleteCommunication(id, req) {
  const db = getDb();
  const q = db.prepare('SELECT * FROM communication_questions WHERE id = ?').get(id);
  if (!q) throw httpError(404, 'Question not found');
  const used = db.prepare("SELECT COUNT(*) n FROM exam_questions WHERE section = 'communication' AND question_id = ?").get(id).n;
  if (used) {
    db.prepare('UPDATE communication_questions SET active = 0, modified_at = ? WHERE id = ?').run(nowIso(), id);
    audit('QUESTION_DEACTIVATED', { ...actorOf(req), req, details: { code: q.code } });
    enqueue('communication_questions', q.code);
    return { deactivated: true, message: 'Question has exam history, so it was deactivated instead of deleted.' };
  }
  db.prepare('DELETE FROM communication_questions WHERE id = ?').run(id);
  audit('QUESTION_DELETED', { ...actorOf(req), req, details: { code: q.code, section: 'communication' } });
  return { deleted: true };
}

function createSet(body, req) {
  const db = getDb();
  const type = body.exam_type_id ? db.prepare('SELECT * FROM exam_types WHERE id = ?').get(body.exam_type_id) : db.prepare("SELECT * FROM exam_types WHERE code = 'APT-COMM'").get();
  let code = String(body.code || '').trim().toUpperCase();
  if (!code) {
    const n = db.prepare('SELECT code FROM exam_sets').all().reduce((m, r) => Math.max(m, parseInt(r.code.replace(/\D/g, ''), 10) || 0), 0);
    code = `SET-${String(n + 1).padStart(2, '0')}`;
  }
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) throw httpError(400, 'Set code must be 3–20 characters (A–Z, 0–9, -)');
  if (db.prepare('SELECT 1 FROM exam_sets WHERE code = ?').get(code)) throw httpError(409, 'An exam set with this code already exists');
  const id = db.prepare('INSERT INTO exam_sets(exam_type_id, code, name, description, active, created_at, modified_at) VALUES (?,?,?,?,?,?,?)')
    .run(type.id, code, body.name || `Exam Set ${code.replace('SET-', '')}`, body.description || null, body.active === false ? 0 : 1, nowIso(), nowIso()).lastInsertRowid;
  audit('EXAM_SET_CREATED', { ...actorOf(req), req, details: { code } });
  return db.prepare('SELECT * FROM exam_sets WHERE id = ?').get(id);
}
function updateSet(id, body, req) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM exam_sets WHERE id = ?').get(id);
  if (!s) throw httpError(404, 'Exam set not found');
  db.prepare('UPDATE exam_sets SET name = ?, description = ?, active = ?, modified_at = ? WHERE id = ?')
    .run(body.name ?? s.name, body.description ?? s.description, body.active === undefined ? s.active : (body.active ? 1 : 0), nowIso(), id);
  audit('EXAM_SET_UPDATED', { ...actorOf(req), req, details: { code: s.code, active: body.active } });
  return db.prepare('SELECT * FROM exam_sets WHERE id = ?').get(id);
}
module.exports = { listAptitude, saveAptitude, deleteAptitude, listCommunication, saveCommunication, deleteCommunication, createSet, updateSet, validateAptitude, CATEGORIES };
