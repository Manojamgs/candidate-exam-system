'use strict';
// Lightweight enqueue used everywhere a record changes. The worker in sync/index.js drains it.
const { getDb } = require('../../db');
const { nowIso } = require('../../lib/util');
const settings = require('../../lib/settings');

function enqueue(entity, key) {
  if (settings.get('backend.type') === 'none') return;
  const db = getDb();
  const existing = db.prepare("SELECT id FROM sync_queue WHERE entity = ? AND entity_key = ? AND status = 'pending'").get(entity, String(key));
  if (existing) { db.prepare('UPDATE sync_queue SET updated_at = ? WHERE id = ?').run(nowIso(), existing.id); return; }
  db.prepare("INSERT INTO sync_queue(entity, entity_key, status, created_at, updated_at) VALUES (?,?,'pending',?,?)")
    .run(entity, String(key), nowIso(), nowIso());
}
function enqueueExamTree(examId) {
  const db = getDb();
  const e = db.prepare('SELECT e.exam_code, c.candidate_code FROM exams e JOIN candidates c ON c.id = e.candidate_id WHERE e.id = ?').get(examId);
  if (!e) return;
  enqueue('candidates', e.candidate_code);
  enqueue('exams', e.exam_code);
  enqueue('exam_results', e.exam_code);
  enqueue('aptitude_answers', e.exam_code);
  enqueue('communication_answers', e.exam_code);
  enqueue('programming_answers', e.exam_code);
}
module.exports = { enqueue, enqueueExamTree };
