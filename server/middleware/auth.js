'use strict';
const { getDb } = require('../db');
const { hashToken } = require('../lib/crypto');
const { nowIso, addMinutes, httpError } = require('../lib/util');
const settings = require('../lib/settings');
const config = require('../config');

const STAFF_COOKIE = 'cexs_staff';
const CAND_COOKIE = 'cexs_cand';

function cookieOpts(maxAgeMs) {
  return { httpOnly: true, sameSite: 'strict', secure: config.secureCookies, path: '/', maxAge: maxAgeMs };
}

// Role permissions. 'admin' = Admin/HR full access, 'hr' = Admin/HR without system settings & user admin.
const PERMISSIONS = {
  admin: ['*'],
  hr: ['candidates', 'exams', 'results.view', 'questions', 'reports', 'dashboard', 'audit.view', 'evaluation', 'monitor'],
  evaluator: ['results.view', 'evaluation', 'dashboard', 'candidates.view'],
};
function can(user, perm) {
  const p = PERMISSIONS[user.role] || [];
  return p.includes('*') || p.includes(perm) || (perm.endsWith('.view') && p.includes(perm.split('.')[0]));
}

function loadSession(token, kind) {
  if (!token) return null;
  const db = getDb();
  const s = db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND kind = ?').get(hashToken(token), kind);
  if (!s || s.revoked) return s && s.revoked ? { revoked: true, reason: s.revoked_reason } : null;
  if (s.expires_at < nowIso()) return null;
  return s;
}

function staffAuth(req, res, next) {
  const s = loadSession(req.cookies[STAFF_COOKIE], 'staff');
  if (!s || s.revoked) return next(httpError(401, 'Authentication required', 'AUTH_REQUIRED'));
  const user = getDb().prepare('SELECT id, username, email, full_name, role, active FROM users WHERE id = ?').get(s.user_id);
  if (!user || !user.active) return next(httpError(401, 'Account disabled', 'AUTH_REQUIRED'));
  // sliding idle timeout
  const idle = settings.get('security.staff_session_minutes');
  const exp = addMinutes(nowIso(), idle);
  getDb().prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?').run(nowIso(), exp, s.id);
  res.cookie(STAFF_COOKIE, req.cookies[STAFF_COOKIE], cookieOpts(idle * 60000));
  req.user = user; req.session = s;
  next();
}
const requirePerm = (perm) => (req, res, next) => (req.user && can(req.user, perm) ? next() : next(httpError(403, 'You do not have permission for this action', 'FORBIDDEN')));
const requireRole = (...roles) => (req, res, next) => (req.user && roles.includes(req.user.role) ? next() : next(httpError(403, 'You do not have permission for this action', 'FORBIDDEN')));

function candidateAuth(req, res, next) {
  const s = loadSession(req.cookies[CAND_COOKIE], 'candidate');
  if (!s) return next(httpError(401, 'Your exam session has ended. Please open your exam link again.', 'CAND_AUTH_REQUIRED'));
  if (s.revoked) return next(httpError(409, s.reason === 'superseded'
    ? 'This exam was opened in another browser window or device. Only one active session is allowed.'
    : 'Your exam session is no longer active.', 'SESSION_REVOKED'));
  const db = getDb();
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(s.exam_id);
  if (!exam) return next(httpError(401, 'Exam not found', 'CAND_AUTH_REQUIRED'));
  const cand = db.prepare('SELECT id, candidate_code, full_name, first_name, last_name, email, position_applied FROM candidates WHERE id = ?').get(exam.candidate_id);
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(nowIso(), s.id);
  req.candidateSession = { ...s, candidate_code: cand.candidate_code };
  req.exam = exam; req.candidate = cand;
  next();
}

// CSRF defence: SameSite=strict cookies + mandatory custom header on state-changing requests.
function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'cexs') return next(httpError(403, 'Missing request header', 'CSRF'));
  next();
}
module.exports = { staffAuth, candidateAuth, requirePerm, requireRole, csrfGuard, can, cookieOpts, STAFF_COOKIE, CAND_COOKIE, PERMISSIONS };
