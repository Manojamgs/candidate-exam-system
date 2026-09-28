'use strict';
const { getDb } = require('../db');
const { nowIso, httpError } = require('../lib/util');
const { nextId } = require('../lib/ids');
const { audit, actorOf } = require('../lib/audit');
const { enqueue } = require('./sync/queue');

const CANDIDATE_STATUSES = ['New', 'Shortlisted', 'Exam Assigned', 'Exam Started', 'Exam Completed', 'Under Evaluation',
  'Passed', 'Failed', 'Selected', 'Rejected', 'On Hold'];
const EDITABLE = ['first_name', 'last_name', 'email', 'mobile', 'alternate_mobile', 'date_of_birth', 'nationality',
  'current_location', 'country', 'city', 'position_applied', 'department', 'experience', 'years_of_experience',
  'highest_qualification', 'university', 'current_company', 'current_salary', 'expected_salary', 'notice_period',
  'recruitment_source', 'recruiter_name', 'interviewer', 'application_date', 'candidate_status', 'evaluator_comments'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function validate(data, isCreate) {
  const errs = [];
  if (isCreate || 'first_name' in data) if (!String(data.first_name || '').trim()) errs.push('First name is required');
  if (isCreate || 'last_name' in data) if (!String(data.last_name || '').trim()) errs.push('Last name is required');
  if (isCreate || 'email' in data) if (!EMAIL_RE.test(String(data.email || '').trim())) errs.push('A valid email is required');
  if (data.mobile && !/^[+\d][\d\s\-()]{6,19}$/.test(data.mobile)) errs.push('Mobile number format is invalid');
  if (data.alternate_mobile && !/^[+\d][\d\s\-()]{6,19}$/.test(data.alternate_mobile)) errs.push('Alternate mobile format is invalid');
  if (data.years_of_experience !== undefined && data.years_of_experience !== '' && data.years_of_experience !== null
    && !(Number(data.years_of_experience) >= 0 && Number(data.years_of_experience) <= 60)) errs.push('Years of experience must be 0–60');
  if (data.candidate_status && !CANDIDATE_STATUSES.includes(data.candidate_status)) errs.push('Invalid candidate status');
  for (const d of ['date_of_birth', 'application_date']) if (data[d] && !/^\d{4}-\d{2}-\d{2}$/.test(data[d])) errs.push(`${d} must be YYYY-MM-DD`);
  if (errs.length) throw httpError(400, errs.join('; '), 'VALIDATION');
}
function clean(data) {
  const o = {};
  for (const k of EDITABLE) if (k in data) {
    let v = data[k];
    if (typeof v === 'string') v = v.trim();
    if (v === '') v = null;
    if (k === 'years_of_experience' && v !== null) v = Number(v);
    if (k === 'email' && v) v = v.toLowerCase();
    o[k] = v;
  }
  return o;
}

function createCandidate(data, req) {
  validate(data, true);
  const db = getDb();
  const c = clean(data);
  if (db.prepare('SELECT 1 FROM candidates WHERE email = ? COLLATE NOCASE').get(c.email)) throw httpError(409, 'A candidate with this email already exists', 'DUPLICATE');
  const code = nextId('candidate');
  const now = nowIso();
  const row = { ...c, candidate_code: code, full_name: `${c.first_name} ${c.last_name}`, candidate_status: c.candidate_status || 'New',
    exam_status: 'Not Assigned', application_date: c.application_date || now.slice(0, 10), created_by: req?.user?.id || null, created_at: now, modified_at: now };
  const cols = Object.keys(row);
  const info = db.prepare(`INSERT INTO candidates(${cols.join(',')}) VALUES (${cols.map((k) => '@' + k).join(',')})`).run(row);
  audit('CANDIDATE_CREATED', { candidateId: info.lastInsertRowid, ...actorOf(req), req, details: { candidate_code: code } });
  enqueue('candidates', code);
  return getCandidate(info.lastInsertRowid);
}
function updateCandidate(id, data, req) {
  const db = getDb();
  const before = getCandidate(id);
  if (!before) throw httpError(404, 'Candidate not found');
  validate(data, false);
  const c = clean(data);
  if (c.email && c.email !== before.email && db.prepare('SELECT 1 FROM candidates WHERE email = ? COLLATE NOCASE AND id <> ?').get(c.email, id))
    throw httpError(409, 'A candidate with this email already exists', 'DUPLICATE');
  if (!Object.keys(c).length) return before;
  const fn = c.first_name ?? before.first_name; const ln = c.last_name ?? before.last_name;
  c.full_name = `${fn} ${ln}`; c.modified_at = nowIso();
  db.prepare(`UPDATE candidates SET ${Object.keys(c).map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...c, id });
  const changes = {};
  for (const k of Object.keys(c)) if (k !== 'modified_at' && before[k] !== c[k]) changes[k] = { from: before[k], to: c[k] };
  audit('CANDIDATE_UPDATED', { candidateId: id, ...actorOf(req), req, details: changes });
  enqueue('candidates', before.candidate_code);
  return getCandidate(id);
}
const getCandidate = (id) => getDb().prepare('SELECT * FROM candidates WHERE id = ?').get(id);
const getCandidateByCode = (code) => getDb().prepare('SELECT * FROM candidates WHERE candidate_code = ?').get(code);

// Updates the denormalised summary fields on the candidate master record (mirrors the latest attempt).
function patchCandidate(id, fields) {
  fields.modified_at = nowIso();
  getDb().prepare(`UPDATE candidates SET ${Object.keys(fields).map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...fields, id });
  const c = getCandidate(id);
  enqueue('candidates', c.candidate_code);
  return c;
}

function searchCandidates(q = {}) {
  const where = []; const p = {};
  if (q.q) { where.push(`(c.candidate_code LIKE @q OR c.full_name LIKE @q OR c.email LIKE @q OR c.mobile LIKE @q)`); p.q = `%${q.q}%`; }
  for (const [param, col] of [['candidate_code', 'c.candidate_code'], ['email', 'c.email'], ['mobile', 'c.mobile']])
    if (q[param]) { where.push(`${col} LIKE @${param}`); p[param] = `%${q[param]}%`; }
  if (q.name) { where.push('c.full_name LIKE @name'); p.name = `%${q.name}%`; }
  for (const [param, col] of [['position', 'c.position_applied'], ['department', 'c.department'], ['recruiter', 'c.recruiter_name']])
    if (q[param]) { where.push(`${col} LIKE @${param}`); p[param] = `%${q[param]}%`; }
  if (q.exam_set) { where.push('c.selected_exam_set = @exam_set'); p.exam_set = q.exam_set; }
  if (q.exam_status) { where.push('c.exam_status = @exam_status'); p.exam_status = q.exam_status; }
  if (q.candidate_status) { where.push('c.candidate_status = @candidate_status'); p.candidate_status = q.candidate_status; }
  if (q.result) { where.push('c.final_status = @result'); p.result = q.result; }
  if (q.date_from) { where.push('c.application_date >= @date_from'); p.date_from = q.date_from; }
  if (q.date_to) { where.push('c.application_date <= @date_to'); p.date_to = q.date_to; }
  const f = q.filter;
  if (f === 'passed') where.push("c.final_status = 'PASS'");
  if (f === 'failed') where.push("c.final_status = 'FAIL'");
  if (f === 'pending') where.push("c.exam_status IN ('Assigned','In Progress','Pending Approval')");
  if (f === 'completed') where.push("c.exam_status IN ('Completed','Evaluated','Under Evaluation','Submitted')");
  if (f === 'not_started') where.push("c.exam_status IN ('Not Assigned','Assigned','Pending Approval')");
  if (f === 'under_evaluation') where.push("c.exam_status IN ('Under Evaluation','Evaluated','Submitted')");
  const sortable = { created_at: 'c.created_at', name: 'c.full_name', code: 'c.candidate_code', score: 'c.total_percentage', status: 'c.candidate_status', application_date: 'c.application_date' };
  const sort = sortable[q.sort] || 'c.created_at';
  const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(parseInt(q.limit || '50', 10) || 50, 1000);
  const offset = Math.max(parseInt(q.offset || '0', 10) || 0, 0);
  const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const db = getDb();
  const total = db.prepare(`SELECT COUNT(*) n FROM candidates c ${sqlWhere}`).get(p).n;
  const rows = db.prepare(`SELECT c.* FROM candidates c ${sqlWhere} ORDER BY ${sort} ${dir}, c.id DESC LIMIT ${limit} OFFSET ${offset}`).all(p);
  return { total, rows, limit, offset };
}
module.exports = { createCandidate, updateCandidate, getCandidate, getCandidateByCode, patchCandidate, searchCandidates, CANDIDATE_STATUSES, EDITABLE };
