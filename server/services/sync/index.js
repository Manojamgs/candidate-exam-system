'use strict';
// Sync worker: drains sync_queue and pushes records to the configured external backend.
const { getDb } = require('../../db');
const { nowIso } = require('../../lib/util');
const settings = require('../../lib/settings');
const { ENTITIES, ENTITY_ORDER } = require('./mappings');
const { enqueue } = require('./queue');
const google = require('./googleSheets');
const sharepoint = require('./sharepoint');

const MAX_ATTEMPTS = 8;
function adapter() {
  const t = settings.get('backend.type');
  return t === 'google_sheets' ? google : t === 'sharepoint' ? sharepoint : null;
}

let running = false;
async function processQueue({ limit = 200 } = {}) {
  if (running) return { skipped: true };
  const a = adapter();
  if (!a) return { skipped: true, reason: 'no backend configured' };
  running = true;
  const db = getDb();
  const stats = { done: 0, failed: 0 };
  try {
    const items = db.prepare(`SELECT * FROM sync_queue WHERE status = 'pending' OR (status = 'failed' AND attempts < ${MAX_ATTEMPTS})
      ORDER BY id LIMIT ?`).all(limit);
    const byEntity = new Map();
    for (const it of items) { if (!byEntity.has(it.entity)) byEntity.set(it.entity, []); byEntity.get(it.entity).push(it); }
    for (const entity of ENTITY_ORDER) {
      const group = byEntity.get(entity);
      if (!group) continue;
      const def = ENTITIES[entity];
      const rows = []; const ids = [];
      for (const it of group) { rows.push(...def.rows(it.entity_key)); ids.push(it.id); }
      try {
        await a.upsertRows(entity, def.headers, rows);
        db.prepare(`UPDATE sync_queue SET status = 'done', attempts = attempts + 1, last_error = NULL, updated_at = ? WHERE id IN (${ids.join(',')})`).run(nowIso());
        stats.done += ids.length;
      } catch (e) {
        db.prepare(`UPDATE sync_queue SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id IN (${ids.join(',')})`)
          .run(e.message.slice(0, 500), nowIso());
        stats.failed += ids.length;
        stats.error = e.message;
      }
    }
  } finally { running = false; }
  return stats;
}

function enqueueAll() {
  let n = 0;
  for (const entity of ENTITY_ORDER) for (const k of ENTITIES[entity].all()) { enqueue(entity, k); n++; }
  return n;
}
function status() {
  const db = getDb();
  const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) n FROM sync_queue GROUP BY status').all().map((r) => [r.status, r.n]));
  const lastError = db.prepare("SELECT entity, entity_key, last_error, updated_at FROM sync_queue WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 1").get();
  const lastDone = db.prepare("SELECT MAX(updated_at) t FROM sync_queue WHERE status = 'done'").get().t;
  return { backend: settings.get('backend.type'), counts, last_error: lastError || null, last_success_at: lastDone };
}
async function testConnection() { const a = adapter(); if (!a) throw new Error('Select a backend type first'); a.resetCache(); return a.testConnection(); }
async function provision() { const a = adapter(); if (!a) throw new Error('Select a backend type first'); return a.provision(ENTITIES); }
function purgeDone(days = 7) {
  getDb().prepare("DELETE FROM sync_queue WHERE status = 'done' AND updated_at < ?").run(new Date(Date.now() - days * 864e5).toISOString());
}
module.exports = { processQueue, enqueueAll, status, testConnection, provision, purgeDone };
