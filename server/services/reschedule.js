'use strict';
// Technical-issue rescheduling: HR raises a request with a reason and system-captured evidence; an Admin approves or rejects.
// Approval options: resume with extra time (in-progress exam), a fresh link / new window (not started), or a new attempt on a different set
// (the interrupted attempt is voided and does not count toward the attempt limit). Every step is audit-logged and nothing is deleted.
const { getDb, tx } = require('../db');
const { nowIso, httpError, parseJson, addMinutes } = require('../lib/util');
const { nextId } = require('../lib/ids');
const settings = require('../lib/settings');
const { audit, actorOf } = require('../lib/audit');
const { patchCandidate } = require('./candidates');
const { enqueue, enqueueExamTree } = require('./sync/queue');

const REASONS = {
  internet_outage: 'Internet / network outage',
  power_failure: 'Power failure',
  device_failure: 'Computer or device failure',
  browser_issue: 'Browser or operating-system error',
  platform_issue: 'Examination platform issue',
  medical_emergency: 'Medical or personal emergency',
  other: 'Other',
};
const OPTIONS = {
  resume_extra_time: 'Resume the same attempt with extra time',
  new_link: 'Issue a new link / new exam window (exam not started)',
  new_attempt: 'Void this attempt and schedule a new attempt on a different set',
};

// System-captured diagnostics attached to the request so the approver sees objective evidence, not only the narrative.
function collectEvidence(exam) {
  const db = getDb();
  const events = db.prepare(`SELECT event, timestamp, ip_address FROM audit_log WHERE exam_id = ? AND event IN
    ('SUSPICIOUS_CONNECTION_LOST','CONNECTION_RESTORED','SUSPICIOUS_CONNECTION_RESTORED','EXAM_RESUMED','CANDIDATE_LOGIN','EXAM_RESUME_BLOCKED','EXAM_STARTED','EXAM_SUBMITTED','EXAM_SESSION_RESET','SECTION_COMPLETED')
    ORDER BY id`).all(exam.id);
  const ips = [...new Set(db.prepare("SELECT DISTINCT ip FROM sessions WHERE exam_id = ? AND kind = 'candidate' AND ip IS NOT NULL").all(exam.id).map((r) => r.ip))];
  const answered = require('./examEngine').progressSummary(exam.id);
  const allowedSec = exam.started_at && exam.deadline_at ? Math.round((new Date(exam.deadline_at) - new Date(exam.started_at)) / 1000) : null;
  return {
    captured_at: nowIso(), exam_status: exam.status, started_at: exam.started_at, deadline_at: exam.deadline_at, submitted_at: exam.submitted_at,
    submission_type: exam.submission_type, time_used_seconds: exam.duration_seconds, time_allowed_seconds: allowedSec, last_autosave_at: exam.last_autosave_at,
    resume_count: exam.resume_count, tab_switch_count: exam.tab_switch_count, connection_lost_events: events.filter((e) => e.event === 'SUSPICIOUS_CONNECTION_LOST').length,
    logins: events.filter((e) => e.event === 'CANDIDATE_LOGIN').length, distinct_ips: ips.length, answered,
    timeline: events.slice(-40).map((e) => ({ event: e.event.replace('SUSPICIOUS_', ''), at: e.timestamp })),
    prior_reschedules: db.prepare("SELECT COUNT(*) n FROM reschedule_requests WHERE candidate_id = ? AND status = 'Approved'").get(exam.candidate_id).n,
  };
}

function allowedOptions(exam) {
  if (exam.status === 'In Progress') return ['resume_extra_time', 'new_attempt'];
  if (['Assigned', 'Expired'].includes(exam.status) && !exam.started_at) return ['new_link'];
  if (['Expired'].includes(exam.status) && exam.started_at) return ['new_attempt'];
  if (['Submitted', 'Under Evaluation', 'Evaluated', 'Completed'].includes(exam.status)) return ['new_attempt'];
  return [];
}

function createRequest(examId, body, req) {
  if (!settings.get('reschedule.enabled')) throw httpError(409, 'Rescheduling is disabled in Settings', 'DISABLED');
  const db = getDb();
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) throw httpError(404, 'Exam not found');
  const opts = allowedOptions(exam);
  if (!opts.length) throw httpError(409, `An exam that is ${exam.status} cannot be rescheduled`, 'NOT_ALLOWED');
  if (db.prepare("SELECT 1 FROM reschedule_requests WHERE exam_id = ? AND status = 'Pending'").get(examId)) throw httpError(409, 'A reschedule request for this exam is already pending', 'DUPLICATE');
  const errs = [];
  if (!REASONS[body.reason_category]) errs.push('a reason category');
  const desc = String(body.description || '').trim();
  if (desc.length < 20) errs.push('a description of what happened (at least 20 characters)');
  if (!OPTIONS[body.requested_option]) errs.push('a requested option');
  else if (!opts.includes(body.requested_option)) errs.push(`an option valid for an exam that is ${exam.status} (${opts.join(', ')})`);
  let extra = null;
  if (body.requested_option === 'resume_extra_time') {
    extra = Number(body.extra_minutes ?? settings.get('reschedule.default_extra_minutes'));
    if (!(extra >= 0 && extra <= 180)) errs.push('extra minutes between 0 and 180');
  }
  let start = null; let expiry = null;
  if (body.requested_option !== 'resume_extra_time') {
    try { ({ availableFrom: start, expiresAt: expiry } = require('./assignment').validateWindow(body.proposed_start || null, body.proposed_expiry || null)); } catch (e) { errs.push(e.message); }
  }
  if (body.incident_at && Number.isNaN(new Date(body.incident_at).getTime())) errs.push('a valid incident date/time');
  if (errs.length) throw httpError(400, `Please provide ${errs.join('; ')}`, 'VALIDATION');
  const approved = db.prepare("SELECT COUNT(*) n FROM reschedule_requests WHERE candidate_id = ? AND status = 'Approved'").get(exam.candidate_id).n;
  const max = settings.get('reschedule.max_per_candidate');
  const warnings = approved >= max ? [`Candidate already has ${approved} approved reschedule(s) (limit ${max}); approval will require an override.`] : [];
  const now = nowIso();
  const code = nextId('reschedule');
  const id = db.prepare(`INSERT INTO reschedule_requests(request_code, exam_id, candidate_id, reason_category, description, incident_at, evidence_notes, system_evidence,
    requested_option, extra_minutes, proposed_start, proposed_expiry, status, requested_by, requested_at, created_at, modified_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'Pending',?,?,?,?)`).run(code, examId, exam.candidate_id, body.reason_category, desc,
    body.incident_at ? new Date(body.incident_at).toISOString() : null, String(body.evidence_notes || '').slice(0, 4000) || null,
    JSON.stringify(collectEvidence(exam)), body.requested_option, extra, start, expiry, req.user.id, now, now, now).lastInsertRowid;
  audit('RESCHEDULE_REQUESTED', { candidateId: exam.candidate_id, examId, ...actorOf(req), req,
    details: { request: code, reason: body.reason_category, option: body.requested_option, extra_minutes: extra, proposed_start: start, warnings } });
  enqueue('reschedule_requests', code);
  require('./email').sendRescheduleRequested(id);
  return { ...getRequest(id), warnings };
}

function getRequest(id) {
  const r = getDb().prepare(`SELECT r.*, c.candidate_code, c.full_name, c.email, e.exam_code, e.status exam_status, e.attempt_number, s.code set_code,
    u1.full_name requested_by_name, u2.full_name decided_by_name, ne.exam_code resulting_exam_code
    FROM reschedule_requests r JOIN candidates c ON c.id = r.candidate_id JOIN exams e ON e.id = r.exam_id LEFT JOIN exam_sets s ON s.id = e.exam_set_id
    LEFT JOIN users u1 ON u1.id = r.requested_by LEFT JOIN users u2 ON u2.id = r.decided_by LEFT JOIN exams ne ON ne.id = r.resulting_exam_id WHERE r.id = ?`).get(id);
  if (!r) return null;
  return { ...r, system_evidence: parseJson(r.system_evidence), reason_label: REASONS[r.reason_category], option_label: OPTIONS[r.requested_option] };
}
function listRequests(q = {}) {
  const w = []; const p = {};
  if (q.status) { w.push('r.status = @status'); p.status = q.status; }
  if (q.candidate_id) { w.push('r.candidate_id = @cid'); p.cid = Number(q.candidate_id); }
  if (q.q) { w.push('(c.full_name LIKE @q OR c.candidate_code LIKE @q OR e.exam_code LIKE @q OR r.request_code LIKE @q)'); p.q = `%${q.q}%`; }
  return getDb().prepare(`SELECT r.id FROM reschedule_requests r JOIN candidates c ON c.id = r.candidate_id JOIN exams e ON e.id = r.exam_id
    ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY CASE r.status WHEN 'Pending' THEN 0 ELSE 1 END, r.id DESC LIMIT 500`).all(p).map((x) => getRequest(x.id));
}

function decide(id, decision, body, req) {
  const db = getDb();
  const r = db.prepare('SELECT * FROM reschedule_requests WHERE id = ?').get(id);
  if (!r) throw httpError(404, 'Request not found');
  if (r.status !== 'Pending') throw httpError(409, `This request is already ${r.status}`, 'ALREADY_DECIDED');
  if (req.user.role !== 'admin') throw httpError(403, 'Only an Admin can approve or reject reschedule requests', 'FORBIDDEN');
  if (r.requested_by === req.user.id && !settings.get('reschedule.allow_self_approval'))
    throw httpError(403, 'Segregation of duties: a different Admin must decide on a request you raised (or enable self-approval in Settings)', 'SELF_APPROVAL');
  const notes = String(body.decision_notes || '').trim();
  const now = nowIso();
  if (decision === 'reject') {
    if (notes.length < 5) throw httpError(400, 'A reason is required to reject the request', 'VALIDATION');
    db.prepare("UPDATE reschedule_requests SET status = 'Rejected', decided_by = ?, decided_at = ?, decision_notes = ?, modified_at = ? WHERE id = ?").run(req.user.id, now, notes, now, id);
    audit('RESCHEDULE_REJECTED', { candidateId: r.candidate_id, examId: r.exam_id, ...actorOf(req), req, details: { request: r.request_code, notes } });
    enqueue('reschedule_requests', r.request_code);
    require('./email').sendRescheduleDecision(id, null);
    return { request: getRequest(id) };
  }
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(r.exam_id);
  const opts = allowedOptions(exam);
  if (!opts.includes(r.requested_option)) throw httpError(409, `The exam is now ${exam.status}; the requested option is no longer possible. Reject this request and raise a new one.`, 'STALE');
  const approvedCount = db.prepare("SELECT COUNT(*) n FROM reschedule_requests WHERE candidate_id = ? AND status = 'Approved'").get(r.candidate_id).n;
  if (approvedCount >= settings.get('reschedule.max_per_candidate') && !body.override_limit)
    throw httpError(409, `Candidate already has ${approvedCount} approved reschedule(s). Confirm the override to approve another.`, 'LIMIT');
  const extra = body.extra_minutes !== undefined ? Number(body.extra_minutes) : r.extra_minutes;
  let outcome = {};
  const engine = require('./examEngine');
  const assignment = require('./assignment');
  if (r.requested_option === 'resume_extra_time') {
    engine.adminResetSession(exam.id, { extendMinutes: extra || 0 }, req);
    outcome = { resumed: true, extra_minutes: extra || 0 };
  } else if (r.requested_option === 'new_link') {
    const creds = assignment.issueCredentials(exam.id, { availableFrom: body.proposed_start !== undefined ? body.proposed_start || null : r.proposed_start, expiresAt: body.proposed_expiry || r.proposed_expiry });
    db.prepare("UPDATE exams SET status = 'Assigned', modified_at = ? WHERE id = ?").run(now, exam.id);
    patchCandidate(exam.candidate_id, { exam_status: 'Assigned', candidate_status: 'Exam Assigned' });
    require('./email').sendExamAssigned(db.prepare('SELECT * FROM exams WHERE id = ?').get(exam.id), creds);
    outcome = { credentials: creds };
  } else {
    // Void the interrupted attempt (kept for audit) and create a fresh, uncounted attempt on a different set.
    tx(() => {
      if (exam.status === 'In Progress') {
        db.prepare("UPDATE sessions SET revoked = 1, revoked_reason = 'rescheduled' WHERE exam_id = ? AND kind = 'candidate'").run(exam.id);
      }
      db.prepare(`UPDATE exams SET status = 'Voided', counts_as_attempt = ?, void_reason = ?, token_hash = NULL, token_enc = NULL, access_code_enc = NULL, modified_at = ? WHERE id = ?`)
        .run(settings.get('reschedule.voided_attempt_counts') ? 1 : 0, `Rescheduled via ${r.request_code}: ${REASONS[r.reason_category]}`, now, exam.id);
      db.prepare("UPDATE exam_results SET final_status = 'Voided', modified_at = ? WHERE exam_id = ?").run(now, exam.id);
    });
    audit('EXAM_VOIDED', { candidateId: exam.candidate_id, examId: exam.id, ...actorOf(req), req, details: { request: r.request_code, reason: r.reason_category } });
    const typeCode = db.prepare('SELECT code FROM exam_types WHERE id = ?').get(exam.exam_type_id).code;
    const out = assignment.assignExam({ candidateId: exam.candidate_id, examTypeCode: typeCode, programmingLanguage: exam.programming_language || undefined,
      availableFrom: body.proposed_start !== undefined ? body.proposed_start || null : r.proposed_start, expiresAt: body.proposed_expiry || r.proposed_expiry,
      reschedule: { request_code: r.request_code, reason: REASONS[r.reason_category], fromExamId: exam.id } }, req);
    outcome = { new_exam_id: out.exam.id, new_exam_code: out.exam.exam_code, exam_set: out.set, programming: out.programming, credentials: out.credentials };
    db.prepare('UPDATE reschedule_requests SET resulting_exam_id = ? WHERE id = ?').run(out.exam.id, id);
    enqueueExamTree(exam.id);
  }
  db.prepare("UPDATE reschedule_requests SET status = 'Approved', decided_by = ?, decided_at = ?, decision_notes = ?, extra_minutes = COALESCE(?, extra_minutes), modified_at = ? WHERE id = ?")
    .run(req.user.id, nowIso(), notes || null, extra ?? null, nowIso(), id);
  audit('RESCHEDULE_APPROVED', { candidateId: r.candidate_id, examId: r.exam_id, ...actorOf(req), req,
    details: { request: r.request_code, option: r.requested_option, outcome: { ...outcome, credentials: undefined }, notes, override_limit: !!body.override_limit } });
  enqueue('reschedule_requests', r.request_code);
  require('./email').sendRescheduleDecision(id, outcome);
  return { request: getRequest(id), outcome };
}

function withdraw(id, req) {
  const db = getDb();
  const r = db.prepare('SELECT * FROM reschedule_requests WHERE id = ?').get(id);
  if (!r) throw httpError(404, 'Request not found');
  if (r.status !== 'Pending') throw httpError(409, `This request is already ${r.status}`);
  if (r.requested_by !== req.user.id && req.user.role !== 'admin') throw httpError(403, 'Only the requester or an Admin can withdraw a request');
  db.prepare("UPDATE reschedule_requests SET status = 'Withdrawn', decided_by = ?, decided_at = ?, modified_at = ? WHERE id = ?").run(req.user.id, nowIso(), nowIso(), id);
  audit('RESCHEDULE_WITHDRAWN', { candidateId: r.candidate_id, examId: r.exam_id, ...actorOf(req), req, details: { request: r.request_code } });
  enqueue('reschedule_requests', r.request_code);
  return getRequest(id);
}
void addMinutes;
module.exports = { createRequest, listRequests, getRequest, decide, withdraw, allowedOptions, collectEvidence, REASONS, OPTIONS };
