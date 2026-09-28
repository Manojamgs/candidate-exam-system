'use strict';
const { getDb } = require('../db');
const { nowIso } = require('./util');
const { nextId } = require('./ids');

let syncHook = null;
function setSyncHook(fn) { syncHook = fn; }

function audit(event, { candidateId = null, examId = null, userId = null, actor = 'system', req = null, details = null } = {}) {
  const code = nextId('log');
  const ip = req ? (req.ip || null) : null;
  const ua = req ? (req.get && req.get('user-agent')) || null : null;
  getDb().prepare(`INSERT INTO audit_log(log_code, candidate_id, exam_id, user_id, actor, event, timestamp, ip_address, browser, details)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(code, candidateId, examId, userId, actor, event, nowIso(), ip, ua ? ua.slice(0, 300) : null,
    details ? JSON.stringify(details) : null);
  if (syncHook) syncHook('audit_log', code);
  return code;
}
function actorOf(req) {
  if (req?.user) return { userId: req.user.id, actor: req.user.username };
  if (req?.candidateSession) return { actor: req.candidateSession.candidate_code };
  return { actor: 'system' };
}
module.exports = { audit, actorOf, setSyncHook };
