'use strict';
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getDb } = require('./index');
const { nowIso } = require('../lib/util');
const config = require('../config');

const APT_COMM_CONFIG = {
  sections: [
    { key: 'aptitude', label: 'Section 1 – Aptitude', kind: 'mcq', questionCount: 20 },
    { key: 'communication', label: 'Section 2 – Communication', kind: 'written', questionCount: 10 },
  ],
};

function ensureExamType() {
  const db = getDb();
  let t = db.prepare("SELECT * FROM exam_types WHERE code = 'APT-COMM'").get();
  if (!t) {
    db.prepare('INSERT INTO exam_types(code, name, description, config, active, created_at, modified_at) VALUES (?,?,?,?,1,?,?)')
      .run('APT-COMM', 'Aptitude & Communication Examination', 'General recruitment aptitude (MCQ) and written communication assessment.',
        JSON.stringify(APT_COMM_CONFIG), nowIso(), nowIso());
    t = db.prepare("SELECT * FROM exam_types WHERE code = 'APT-COMM'").get();
  }
  return t;
}

const APT_COMM_PRG_CONFIG = {
  set_type_code: 'APT-COMM', // aptitude & communication questions come from the shared SET-01..SET-NN sets
  sections: [
    { key: 'aptitude', label: 'Section 1 – Aptitude', kind: 'mcq', questionCount: 20 },
    { key: 'communication', label: 'Section 2 – Communication', kind: 'written', questionCount: 10 },
    { key: 'programming', label: 'Section 3 – Programming', kind: 'code', questionCount: 10 },
  ],
};
function ensureProgrammingExamType() {
  const db = getDb();
  let t = db.prepare("SELECT * FROM exam_types WHERE code = 'APT-COMM-PRG'").get();
  if (!t) {
    db.prepare('INSERT INTO exam_types(code, name, description, config, active, created_at, modified_at) VALUES (?,?,?,?,1,?,?)')
      .run('APT-COMM-PRG', 'Aptitude, Communication & Programming Examination',
        'Aptitude (MCQ), written communication and a language-specific programming-basics section (10 written code questions, AI-evaluated).',
        JSON.stringify(APT_COMM_PRG_CONFIG), nowIso(), nowIso());
    t = db.prepare("SELECT * FROM exam_types WHERE code = 'APT-COMM-PRG'").get();
  }
  return t;
}

// Loads seed/programming/<language>.json (idempotent: existing codes are left untouched).
function seedProgrammingBank({ dir = path.join(__dirname, '..', '..', 'seed', 'programming') } = {}) {
  const db = getDb();
  if (!fs.existsSync(dir)) return { languages: 0, questions: 0 };
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const order = ['java', 'python', 'javascript', 'csharp', 'sql', 'apex'];
  let n = 0;
  const insLang = db.prepare(`INSERT INTO programming_languages(key, label, active, sort_order, created_at, modified_at) VALUES (?,?,1,?,?,?)
    ON CONFLICT(key) DO NOTHING`);
  const insQ = db.prepare(`INSERT INTO programming_questions(code, language, set_number, topic, task_type, difficulty, question, starter_code,
    reference_solution, evaluation_points, test_cases, expected_minutes, marks, active, created_at, modified_at)
    VALUES (@code,@language,@set,@topic,@task_type,@difficulty,@question,@starter,@ref,@points,@tests,@minutes,@marks,1,@now,@now)
    ON CONFLICT(code) DO NOTHING`);
  db.transaction(() => {
    for (const f of files) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const idx = order.indexOf(d.language);
      insLang.run(d.language, d.label, idx < 0 ? 99 : idx, nowIso(), nowIso());
      for (const s of d.sets) for (const q of s.questions) {
        n += insQ.run({ code: q.code, language: d.language, set: s.set_number, topic: q.topic || null, task_type: q.task_type, difficulty: q.difficulty,
          question: q.question, starter: q.starter_code || null, ref: q.reference_solution, points: JSON.stringify(q.evaluation_points || []),
          tests: JSON.stringify(q.test_cases || []), minutes: q.expected_minutes || 4, marks: q.marks ?? 10, now: nowIso() }).changes;
      }
    }
  })();
  return { languages: files.length, questions: n };
}

function ensureAdmin() {
  const db = getDb();
  const n = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (n > 0) return false;
  const a = config.initialAdmin;
  db.prepare(`INSERT INTO users(username, email, full_name, role, password_hash, active, created_at, modified_at)
    VALUES (?,?,?,?,?,1,?,?)`).run(a.username, a.email, a.fullName, 'admin', bcrypt.hashSync(a.password, 10), nowIso(), nowIso());
  return true;
}

// Loads seed/questions/set-*.json. Idempotent: existing question codes are left untouched.
function seedQuestionBank({ dir = path.join(__dirname, '..', '..', 'seed', 'questions') } = {}) {
  const db = getDb();
  const type = ensureExamType();
  const files = fs.readdirSync(dir).filter((f) => /^set-\d+\.json$/.test(f)).sort();
  let apt = 0, com = 0;
  const insSet = db.prepare(`INSERT INTO exam_sets(exam_type_id, code, name, description, active, created_at, modified_at)
    VALUES (?,?,?,?,1,?,?) ON CONFLICT(code) DO NOTHING`);
  const insApt = db.prepare(`INSERT INTO aptitude_questions(code, exam_set_id, category, topic, difficulty, question, table_json,
    option_a, option_b, option_c, option_d, correct_answer, marks, explanation, active, created_at, modified_at)
    VALUES (@code,@set,@category,@topic,@difficulty,@question,@table,@a,@b,@c,@d,@correct,@marks,@explanation,1,@now,@now)
    ON CONFLICT(code) DO NOTHING`);
  const insCom = db.prepare(`INSERT INTO communication_questions(code, exam_set_id, category, question, expected_words_min,
    expected_words_max, marks, active, created_at, modified_at) VALUES (@code,@set,@category,@question,@min,@max,@marks,1,@now,@now)
    ON CONFLICT(code) DO NOTHING`);
  db.transaction(() => {
    for (const f of files) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      insSet.run(type.id, d.set_code, d.name || d.set_code, `Initial seed set ${d.set_code}`, nowIso(), nowIso());
      const setId = db.prepare('SELECT id FROM exam_sets WHERE code = ?').get(d.set_code).id;
      for (const q of d.aptitude) {
        apt += insApt.run({ code: q.code, set: setId, category: q.category, topic: q.topic || null, difficulty: q.difficulty,
          question: q.question, table: q.table ? JSON.stringify(q.table) : null, a: q.options.A, b: q.options.B, c: q.options.C,
          d: q.options.D, correct: q.correct, marks: q.marks ?? 1, explanation: q.explanation || null, now: nowIso() }).changes;
      }
      for (const q of d.communication) {
        com += insCom.run({ code: q.code, set: setId, category: q.category || null, question: q.question,
          min: q.expected_words_min ?? 100, max: q.expected_words_max ?? 200, marks: q.marks ?? 10, now: nowIso() }).changes;
      }
    }
  })();
  return { sets: files.length, aptitude: apt, communication: com };
}

function ensureBaseData() {
  ensureExamType();
  ensureProgrammingExamType();
  const createdAdmin = ensureAdmin();
  const hasQuestions = getDb().prepare('SELECT COUNT(*) c FROM aptitude_questions').get().c > 0;
  const seeded = hasQuestions ? null : seedQuestionBank();
  const hasPrg = getDb().prepare('SELECT COUNT(*) c FROM programming_questions').get().c > 0;
  const seededProgramming = hasPrg ? null : seedProgrammingBank();
  return { createdAdmin, seeded, seededProgramming };
}
module.exports = { ensureBaseData, seedQuestionBank, seedProgrammingBank, ensureExamType, ensureProgrammingExamType, APT_COMM_CONFIG, APT_COMM_PRG_CONFIG };
