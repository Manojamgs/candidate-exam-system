'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

let db;
function getDb() {
  if (db) return db;
  if (config.dbPath !== ':memory:') fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  migrate(db);
  return db;
}

// Additive, idempotent column migrations for databases created by an earlier version.
const COLUMNS = {
  exams: [['programming_language', 'TEXT'], ['programming_set', 'INTEGER'], ['available_from', 'TEXT'],
    ['counts_as_attempt', 'INTEGER NOT NULL DEFAULT 1'], ['rescheduled_from_exam_id', 'INTEGER'], ['void_reason', 'TEXT'],
    ['token_enc', 'TEXT'], ['access_code_enc', 'TEXT']], // AES-GCM encrypted copies so staff can re-send the same link
  exam_results: [['programming_score', 'REAL'], ['programming_max', 'REAL'], ['programming_percentage', 'REAL'],
    ['programming_evaluated', 'INTEGER'], ['programming_breakdown', 'TEXT'], ['programming_rubric', 'TEXT']],
  candidates: [['programming_language', 'TEXT'], ['programming_score', 'REAL'], ['programming_percentage', 'REAL']],
};
function migrate(d) {
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = new Set(d.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const [name, type] of cols) if (!have.has(name)) d.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
}
function closeDb() { if (db) { db.close(); db = null; } }
const tx = (fn) => getDb().transaction(fn)();
module.exports = { getDb, closeDb, tx };
