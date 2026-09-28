'use strict';
const { getDb } = require('../db');
// Sequential, human readable, year-scoped IDs: CAN-2026-00001, EXAM-2026-00001, ...
const PREFIX = { candidate: 'CAN', exam: 'EXAM', attempt: 'ATT', result: 'RES', evaluation: 'EVAL', log: 'LOG', reschedule: 'RSR' };
function nextId(kind) {
  const db = getDb();
  const year = new Date().getUTCFullYear();
  db.prepare('INSERT INTO counters(name, year, value) VALUES (?, ?, 0) ON CONFLICT(name, year) DO NOTHING').run(kind, year);
  db.prepare('UPDATE counters SET value = value + 1 WHERE name = ? AND year = ?').run(kind, year);
  const { value } = db.prepare('SELECT value FROM counters WHERE name = ? AND year = ?').get(kind, year);
  const width = kind === 'log' || kind === 'evaluation' ? 6 : 5;
  return `${PREFIX[kind]}-${year}-${String(value).padStart(width, '0')}`;
}
module.exports = { nextId };
