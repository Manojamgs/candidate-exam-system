'use strict';
const { getDb, tx } = require('../../db');
const { nowIso, round2, httpError, clamp } = require('../../lib/util');
const { nextId } = require('../../lib/ids');
const settings = require('../../lib/settings');
const { audit } = require('../../lib/audit');
const { evaluateRule } = require('./rule');
const { evaluateAi, evaluateCodeAi, CODE_MAX } = require('./ai');
const { parseJson } = require('../../lib/util');

const inflight = new Set();

function ensureAnswerRows(examId) {
  // Unanswered communication questions still get an answer row (empty) so they can be scored 0 and reported.
  const db = getDb();
  const qs = db.prepare("SELECT question_id FROM exam_questions WHERE exam_id = ? AND section = 'communication'").all(examId);
  const ins = db.prepare("INSERT OR IGNORE INTO communication_answers(exam_id, question_id, answer_text, word_count) VALUES (?, ?, '', 0)");
  for (const q of qs) ins.run(examId, q.question_id);
  const pq = db.prepare("SELECT question_id FROM exam_questions WHERE exam_id = ? AND section = 'programming'").all(examId);
  const insP = db.prepare("INSERT OR IGNORE INTO programming_answers(exam_id, question_id, answer_text, line_count, char_count) VALUES (?, ?, '', 0, 0)");
  for (const q of pq) insP.run(examId, q.question_id);
}

// ---------------- Programming ----------------
function storeCodeEvaluation(answer, question, ev, { source, provider, model, userId = null, comments = null, raw = null }) {
  const db = getDb();
  const qScore = round2((ev.total / 100) * (question.marks || 10));
  let id;
  tx(() => {
    db.prepare('UPDATE programming_evaluations SET is_current = 0 WHERE answer_id = ?').run(answer.id);
    id = db.prepare(`INSERT INTO programming_evaluations(evaluation_code, answer_id, exam_id, source, provider, model, correctness, logic, code_quality,
      efficiency, edge_cases, total, question_score, verdict, feedback, strengths, improvements, issues, evaluator_comments, raw_response, is_current, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`).run(nextId('evaluation'), answer.id, answer.exam_id, source, provider, model || null,
      ev.correctness, ev.logic, ev.code_quality, ev.efficiency, ev.edge_cases, ev.total, qScore, ev.verdict || null, ev.feedback || null,
      JSON.stringify(ev.strengths || []), JSON.stringify(ev.improvements || []), JSON.stringify(ev.issues || []), comments,
      raw ? String(raw).slice(0, 20000) : null, userId, nowIso()).lastInsertRowid;
  });
  return id;
}
const NOT_ATTEMPTED = { correctness: 0, logic: 0, code_quality: 0, efficiency: 0, edge_cases: 0, total: 0, verdict: 'not_attempted',
  feedback: 'No answer was submitted for this question.', strengths: [], improvements: ['Attempt every question – partial solutions earn partial credit'], issues: [] };
// Code is never executed. Blank answers score 0 automatically; everything else needs AI or an evaluator (no heuristic fallback for code).
async function evaluateCodeAnswer(answer, question, { provider }) {
  if (!String(answer.answer_text || '').trim()) return { id: storeCodeEvaluation(answer, question, NOT_ATTEMPTED, { source: 'rule', provider: 'rule-engine' }) };
  if (!settings.get('ai.enabled') || !settings.get('ai.evaluate_programming') || provider === 'rule') return { pendingManual: true };
  const lang = getDb().prepare('SELECT label FROM programming_languages WHERE key = ?').get(question.language)?.label || question.language;
  try {
    const ev = await evaluateCodeAi(provider, { ...question, evaluation_points: parseJson(question.evaluation_points, []), test_cases: parseJson(question.test_cases, []) },
      answer.answer_text, lang);
    return { id: storeCodeEvaluation(answer, question, ev, { source: 'ai', provider, model: ev.model, raw: ev.raw }) };
  } catch (e) {
    audit('AI_EVALUATION_FAILED', { examId: answer.exam_id, details: { section: 'programming', answer_id: answer.id, provider, error: e.message.slice(0, 300) } });
    return { pendingManual: true, error: e.message };
  }
}

function storeEvaluation(answer, question, ev, { source, provider, model, userId = null, comments = null, raw = null }) {
  const db = getDb();
  const marks = question.marks || 10;
  const qScore = round2((ev.total / 100) * marks);
  let id;
  tx(() => {
    db.prepare('UPDATE communication_evaluations SET is_current = 0 WHERE answer_id = ?').run(answer.id);
    id = db.prepare(`INSERT INTO communication_evaluations(evaluation_code, answer_id, exam_id, source, provider, model, grammar, vocabulary, clarity,
      structure, professional, total, question_score, feedback, strengths, improvements, evaluator_comments, raw_response, is_current, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`).run(nextId('evaluation'), answer.id, answer.exam_id, source, provider, model || null,
      ev.grammar, ev.vocabulary, ev.clarity, ev.structure, ev.professional_communication, ev.total, qScore, ev.feedback || null,
      JSON.stringify(ev.strengths || []), JSON.stringify(ev.improvements || []), comments, raw ? String(raw).slice(0, 20000) : null, userId, nowIso()).lastInsertRowid;
  });
  return id;
}

async function evaluateAnswer(answer, question, { provider, fallback }) {
  const opts = { wc: answer.word_count, minWords: question.expected_words_min, maxWords: question.expected_words_max };
  if (!answer.word_count) {
    return storeEvaluation(answer, question, evaluateRule(question.question, '', opts), { source: 'rule', provider: 'rule-engine' });
  }
  if (settings.get('ai.enabled') && provider !== 'rule') {
    try {
      const ev = await evaluateAi(provider, question.question, answer.answer_text, opts);
      return storeEvaluation(answer, question, ev, { source: 'ai', provider, model: ev.model, raw: ev.raw });
    } catch (e) {
      audit('AI_EVALUATION_FAILED', { examId: answer.exam_id, details: { answer_id: answer.id, provider, error: e.message.slice(0, 300) } });
      if (!fallback) throw e;
    }
  }
  return storeEvaluation(answer, question, evaluateRule(question.question, answer.answer_text, opts), { source: 'rule', provider: 'rule-engine' });
}

// Evaluates every communication answer of an exam that has no current AI/rule/manual evaluation (or all, if force).
async function evaluateExam(examId, { force = false, provider = null, userId = null } = {}) {
  if (inflight.has(examId)) return { skipped: true };
  inflight.add(examId);
  try {
    const db = getDb();
    ensureAnswerRows(examId);
    const p = provider || settings.get('ai.provider');
    const fallback = settings.get('ai.fallback_to_rule');
    const answers = db.prepare(`SELECT a.* FROM communication_answers a WHERE a.exam_id = ?`).all(examId);
    let done = 0;
    for (const a of answers) {
      const cur = db.prepare('SELECT source FROM communication_evaluations WHERE answer_id = ? AND is_current = 1').get(a.id);
      if (cur && !force) continue;
      if (cur && cur.source === 'manual' && force) continue; // never silently replace an evaluator's manual score
      const q = db.prepare('SELECT * FROM communication_questions WHERE id = ?').get(a.question_id);
      await evaluateAnswer(a, q, { provider: p, fallback });
      done++;
    }
    const candidateId = db.prepare('SELECT candidate_id FROM exams WHERE id = ?').get(examId).candidate_id;
    audit('COMMUNICATION_EVALUATED', { examId, userId, candidateId, details: { provider: p, evaluated: done, force } });
    // Programming answers (AI only; failures / no AI leave the answer for manual review)
    const pAnswers = db.prepare('SELECT * FROM programming_answers WHERE exam_id = ?').all(examId);
    let pDone = 0; let pManual = 0;
    for (const a of pAnswers) {
      const cur = db.prepare('SELECT source FROM programming_evaluations WHERE answer_id = ? AND is_current = 1').get(a.id);
      if (cur && !force) continue;
      if (cur && cur.source === 'manual' && force) continue;
      const q = db.prepare('SELECT * FROM programming_questions WHERE id = ?').get(a.question_id);
      const r = await evaluateCodeAnswer(a, q, { provider: p });
      if (r.pendingManual) pManual++; else pDone++;
    }
    if (pAnswers.length) audit('PROGRAMMING_EVALUATED', { examId, userId, candidateId, details: { provider: p, evaluated: pDone, pending_manual_review: pManual, force } });
    done += pDone;
    require('../results').recomputeResult(examId, { trigger: 'evaluation' });
    return { evaluated: done, pending_manual_review: pManual };
  } finally { inflight.delete(examId); }
}

function manualEvaluateCode(answerId, body, req) {
  const db = getDb();
  const a = db.prepare('SELECT * FROM programming_answers WHERE id = ?').get(answerId);
  if (!a) throw httpError(404, 'Answer not found');
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(a.exam_id);
  if (!['Submitted', 'Under Evaluation', 'Evaluated'].includes(exam.status)) throw httpError(409, `Scores cannot be changed while the exam is ${exam.status}. Reopen the result first.`);
  const q = db.prepare('SELECT * FROM programming_questions WHERE id = ?').get(a.question_id);
  const before = db.prepare('SELECT * FROM programming_evaluations WHERE answer_id = ? AND is_current = 1').get(answerId);
  const ev = {};
  for (const [k, max] of Object.entries(CODE_MAX)) {
    const n = Number(body[k]);
    if (!Number.isFinite(n) || n < 0 || n > max) throw httpError(400, `${k.replace('_', ' ')} must be between 0 and ${max}`, 'VALIDATION');
    ev[k] = n;
  }
  ev.total = round2(Object.keys(CODE_MAX).reduce((m, k) => m + ev[k], 0));
  ev.verdict = ['correct', 'partially_correct', 'incorrect', 'not_attempted'].includes(body.verdict) ? body.verdict
    : (ev.total >= 85 ? 'correct' : ev.total >= 40 ? 'partially_correct' : 'incorrect');
  ev.feedback = body.feedback ?? before?.feedback ?? null;
  ev.strengths = parseJson(before?.strengths, []); ev.improvements = parseJson(before?.improvements, []); ev.issues = parseJson(before?.issues, []);
  const id = storeCodeEvaluation(a, q, ev, { source: 'manual', provider: 'evaluator', userId: req.user.id, comments: body.comments || null });
  audit('PROGRAMMING_SCORE_ADJUSTED', { examId: a.exam_id, candidateId: exam.candidate_id, userId: req.user.id, actor: req.user.username, req,
    details: { answer_id: answerId, question: q.code, before: before ? { source: before.source, total: before.total, question_score: before.question_score } : null,
      after: { total: ev.total, question_score: round2(ev.total / 100 * q.marks), verdict: ev.verdict }, comments: body.comments || null } });
  require('../results').recomputeResult(a.exam_id, { trigger: 'manual_adjustment' });
  return db.prepare('SELECT * FROM programming_evaluations WHERE id = ?').get(id);
}

function manualEvaluate(answerId, body, req) {
  const db = getDb();
  const a = db.prepare('SELECT * FROM communication_answers WHERE id = ?').get(answerId);
  if (!a) throw httpError(404, 'Answer not found');
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(a.exam_id);
  if (!['Submitted', 'Under Evaluation', 'Evaluated'].includes(exam.status)) throw httpError(409, `Scores cannot be changed while the exam is ${exam.status}. Reopen the result first.`);
  const q = db.prepare('SELECT * FROM communication_questions WHERE id = ?').get(a.question_id);
  const before = db.prepare('SELECT * FROM communication_evaluations WHERE answer_id = ? AND is_current = 1').get(answerId);
  const ev = {};
  for (const [k, src] of [['grammar', 'grammar'], ['vocabulary', 'vocabulary'], ['clarity', 'clarity'], ['structure', 'structure'], ['professional_communication', 'professional']]) {
    const v = body[src] ?? body[k];
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 20) throw httpError(400, `${src} must be between 0 and 20`, 'VALIDATION');
    ev[k] = clamp(n, 0, 20);
  }
  ev.total = round2(ev.grammar + ev.vocabulary + ev.clarity + ev.structure + ev.professional_communication);
  ev.feedback = body.feedback ?? before?.feedback ?? null;
  ev.strengths = Array.isArray(body.strengths) ? body.strengths : JSON.parse(before?.strengths || '[]');
  ev.improvements = Array.isArray(body.improvements) ? body.improvements : JSON.parse(before?.improvements || '[]');
  const id = storeEvaluation(a, q, ev, { source: 'manual', provider: 'evaluator', userId: req.user.id, comments: body.comments || null });
  audit('COMMUNICATION_SCORE_ADJUSTED', { examId: a.exam_id, candidateId: exam.candidate_id, userId: req.user.id, actor: req.user.username, req,
    details: { answer_id: answerId, question: q.code, before: before ? { source: before.source, total: before.total, question_score: before.question_score } : null,
      after: { total: ev.total, question_score: round2(ev.total / 100 * q.marks) }, comments: body.comments || null } });
  require('../results').recomputeResult(a.exam_id, { trigger: 'manual_adjustment' });
  return db.prepare('SELECT * FROM communication_evaluations WHERE id = ?').get(id);
}

module.exports = { evaluateExam, manualEvaluate, manualEvaluateCode, evaluateAnswer, evaluateCodeAnswer, ensureAnswerRows };
