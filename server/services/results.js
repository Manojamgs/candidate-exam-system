'use strict';
const { getDb, tx } = require('../db');
const { nowIso, round2, httpError, parseJson } = require('../lib/util');
const { nextId } = require('../lib/ids');
const settings = require('../lib/settings');
const { audit } = require('../lib/audit');
const { patchCandidate } = require('./candidates');
const { enqueueExamTree } = require('./sync/queue');

// ---------- Aptitude auto-scoring (server-side only) ----------
function scoreAptitude(examId) {
  const db = getDb();
  const qs = db.prepare(`SELECT eq.question_id, q.correct_answer, q.marks FROM exam_questions eq JOIN aptitude_questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ? AND eq.section = 'aptitude'`).all(examId);
  tx(() => {
    for (const q of qs) {
      db.prepare('INSERT OR IGNORE INTO aptitude_answers(exam_id, question_id, selected_answer) VALUES (?, ?, NULL)').run(examId, q.question_id);
      const a = db.prepare('SELECT * FROM aptitude_answers WHERE exam_id = ? AND question_id = ?').get(examId, q.question_id);
      const correct = a.selected_answer !== null && a.selected_answer === q.correct_answer;
      db.prepare('UPDATE aptitude_answers SET is_correct = ?, marks_awarded = ? WHERE id = ?').run(a.selected_answer === null ? 0 : (correct ? 1 : 0), correct ? q.marks : 0, a.id);
    }
  });
}

function scoringConfig(hasProgramming = false) {
  const base = {
    aptitude_min_pct: settings.get('scoring.aptitude_min_pct'), communication_min_pct: settings.get('scoring.communication_min_pct'),
    overall_min_pct: settings.get('scoring.overall_min_pct'),
  };
  if (!hasProgramming) return { ...base, aptitude_weight: settings.get('scoring.aptitude_weight'), communication_weight: settings.get('scoring.communication_weight') };
  return { ...base, aptitude_weight: settings.get('scoring.prg_aptitude_weight'), communication_weight: settings.get('scoring.prg_communication_weight'),
    programming_weight: settings.get('scoring.prg_programming_weight'), programming_min_pct: settings.get('scoring.programming_min_pct') };
}
// Pure function – exported for unit tests and documentation. Sections are normalised to 100 then weighted.
function computeOutcome({ aptPct, comPct, prgPct = null }, cfg) {
  const withPrg = prgPct !== null && prgPct !== undefined && cfg.programming_weight !== undefined;
  const wSum = cfg.aptitude_weight + cfg.communication_weight + (withPrg ? cfg.programming_weight : 0);
  const final = round2((aptPct * cfg.aptitude_weight + comPct * cfg.communication_weight + (withPrg ? prgPct * cfg.programming_weight : 0)) / wSum);
  const reasons = [];
  if (aptPct < cfg.aptitude_min_pct) reasons.push(`Aptitude ${aptPct}% is below the minimum ${cfg.aptitude_min_pct}%`);
  if (comPct < cfg.communication_min_pct) reasons.push(`Communication ${comPct}% is below the minimum ${cfg.communication_min_pct}%`);
  if (withPrg && prgPct < cfg.programming_min_pct) reasons.push(`Programming ${prgPct}% is below the minimum ${cfg.programming_min_pct}%`);
  if (final < cfg.overall_min_pct) reasons.push(`Overall ${final}% is below the minimum ${cfg.overall_min_pct}%`);
  return { final, status: reasons.length ? 'FAIL' : 'PASS', reasons };
}

function recomputeResult(examId, { trigger = 'system' } = {}) {
  const db = getDb();
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam || !['Submitted', 'Under Evaluation', 'Evaluated', 'Completed'].includes(exam.status)) return null;
  const existing = db.prepare('SELECT * FROM exam_results WHERE exam_id = ?').get(examId);
  if (existing && existing.finalized) return existing; // finalised results are frozen until reopened

  const apt = db.prepare(`SELECT q.category, q.marks, a.marks_awarded, a.selected_answer FROM exam_questions eq
    JOIN aptitude_questions q ON q.id = eq.question_id LEFT JOIN aptitude_answers a ON a.exam_id = eq.exam_id AND a.question_id = eq.question_id
    WHERE eq.exam_id = ? AND eq.section = 'aptitude'`).all(examId);
  const aptMax = apt.reduce((s, r) => s + r.marks, 0);
  const aptScore = apt.reduce((s, r) => s + (r.marks_awarded || 0), 0);
  const breakdown = {};
  for (const r of apt) {
    const b = breakdown[r.category] || (breakdown[r.category] = { correct: 0, total: 0, answered: 0 });
    b.total++; if (r.selected_answer) b.answered++; if (r.marks_awarded > 0) b.correct++;
  }
  for (const b of Object.values(breakdown)) b.percentage = round2(b.correct / b.total * 100);
  const aptPct = aptMax ? round2(aptScore / aptMax * 100) : 0;

  const com = db.prepare(`SELECT q.marks, ev.question_score, ev.grammar, ev.vocabulary, ev.clarity, ev.structure, ev.professional, ev.strengths, ev.improvements
    FROM exam_questions eq JOIN communication_questions q ON q.id = eq.question_id
    LEFT JOIN communication_answers a ON a.exam_id = eq.exam_id AND a.question_id = eq.question_id
    LEFT JOIN communication_evaluations ev ON ev.answer_id = a.id AND ev.is_current = 1
    WHERE eq.exam_id = ? AND eq.section = 'communication'`).all(examId);
  const comMax = com.reduce((s, r) => s + r.marks, 0);
  const evaluated = com.filter((r) => r.question_score !== null && r.question_score !== undefined);
  const complete = evaluated.length === com.length && com.length > 0;
  const comScore = round2(evaluated.reduce((s, r) => s + r.question_score, 0));
  const comPct = complete && comMax ? round2(comScore / comMax * 100) : null;
  let rubric = null; let strengths = []; let improvements = []; // eslint-disable-line prefer-const
  if (evaluated.length) {
    rubric = {};
    for (const k of ['grammar', 'vocabulary', 'clarity', 'structure', 'professional']) rubric[k] = round2(evaluated.reduce((s, r) => s + r[k], 0) / evaluated.length);
    rubric.total = round2(Object.values(rubric).reduce((a, b) => a + b, 0));
    const tally = (field) => {
      const m = new Map();
      for (const r of evaluated) for (const s of parseJson(r[field], [])) m.set(s, (m.get(s) || 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]);
    };
    strengths = tally('strengths'); improvements = tally('improvements');
  }
  // ---- Programming (optional section)
  const prg = db.prepare(`SELECT q.marks, q.topic, q.task_type, ev.question_score, ev.correctness, ev.logic, ev.code_quality, ev.efficiency, ev.edge_cases,
    ev.verdict, ev.strengths, ev.improvements FROM exam_questions eq JOIN programming_questions q ON q.id = eq.question_id
    LEFT JOIN programming_answers a ON a.exam_id = eq.exam_id AND a.question_id = eq.question_id
    LEFT JOIN programming_evaluations ev ON ev.answer_id = a.id AND ev.is_current = 1
    WHERE eq.exam_id = ? AND eq.section = 'programming'`).all(examId);
  const hasPrg = prg.length > 0;
  const prgMax = prg.reduce((m, r) => m + r.marks, 0);
  const prgEval = prg.filter((r) => r.question_score !== null && r.question_score !== undefined);
  const prgComplete = !hasPrg || prgEval.length === prg.length;
  const prgScore = round2(prgEval.reduce((m, r) => m + r.question_score, 0));
  const prgPct = hasPrg && prgComplete && prgMax ? round2(prgScore / prgMax * 100) : null;
  let prgRubric = null; const prgBreakdown = {};
  if (prgEval.length) {
    prgRubric = {};
    for (const k of ['correctness', 'logic', 'code_quality', 'efficiency', 'edge_cases']) prgRubric[k] = round2(prgEval.reduce((m, r) => m + r[k], 0) / prgEval.length);
    prgRubric.total = round2(Object.values(prgRubric).reduce((a, b) => a + b, 0));
    for (const r of prgEval) {
      const b = prgBreakdown[r.topic || 'General'] || (prgBreakdown[r.topic || 'General'] = { score: 0, max: 0, correct: 0, total: 0 });
      b.score += r.question_score; b.max += r.marks; b.total++; if (r.verdict === 'correct') b.correct++;
    }
    for (const b of Object.values(prgBreakdown)) { b.score = round2(b.score); b.percentage = round2(b.score / b.max * 100); }
    const tally = (field) => { const mm = new Map(); for (const r of prgEval) for (const x of parseJson(r[field], [])) mm.set(x, (mm.get(x) || 0) + 1); return [...mm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]); };
    strengths = [...strengths, ...tally('strengths').map((x) => `Programming: ${x}`)];
    improvements = [...improvements, ...tally('improvements').map((x) => `Programming: ${x}`)];
  }
  const allComplete = complete && prgComplete;
  const cfg = scoringConfig(hasPrg);
  let final = null; let status = 'Pending Evaluation'; let reasons = [];
  if (allComplete) ({ final, status, reasons } = computeOutcome({ aptPct, comPct, prgPct }, cfg));
  const now = nowIso();
  const row = {
    exam_id: examId, candidate_id: exam.candidate_id, aptitude_score: aptScore, aptitude_max: aptMax, aptitude_percentage: aptPct,
    aptitude_answered: apt.filter((r) => r.selected_answer).length, aptitude_breakdown: JSON.stringify(breakdown),
    communication_score: evaluated.length ? comScore : null, communication_max: comMax, communication_percentage: comPct,
    communication_evaluated: evaluated.length, communication_rubric: rubric ? JSON.stringify(rubric) : null, final_score: final,
    final_status: status, scoring_snapshot: JSON.stringify({ ...cfg, reasons, computed_at: now, trigger }),
    strengths: JSON.stringify(strengths), improvements: JSON.stringify(improvements), modified_at: now,
    programming_score: hasPrg && prgEval.length ? prgScore : null, programming_max: hasPrg ? prgMax : null, programming_percentage: prgPct,
    programming_evaluated: hasPrg ? prgEval.length : null, programming_breakdown: hasPrg ? JSON.stringify(prgBreakdown) : null,
    programming_rubric: prgRubric ? JSON.stringify(prgRubric) : null,
  };
  if (existing) {
    db.prepare(`UPDATE exam_results SET ${Object.keys(row).map((k) => `${k}=@${k}`).join(',')} WHERE id = @id`).run({ ...row, id: existing.id });
  } else {
    db.prepare(`INSERT INTO exam_results(result_code, created_at, ${Object.keys(row).join(',')}) VALUES (@result_code, @created_at, ${Object.keys(row).map((k) => '@' + k).join(',')})`)
      .run({ ...row, result_code: nextId('result'), created_at: now });
  }
  const newExamStatus = allComplete ? 'Evaluated' : 'Under Evaluation';
  if (exam.status !== 'Completed') db.prepare('UPDATE exams SET status = ?, modified_at = ? WHERE id = ?').run(newExamStatus, now, examId);
  patchCandidate(exam.candidate_id, {
    exam_status: newExamStatus, candidate_status: 'Under Evaluation', aptitude_score: aptScore, aptitude_percentage: aptPct,
    communication_score: row.communication_score, communication_percentage: comPct, total_score: final, total_percentage: final,
    programming_score: row.programming_score, programming_percentage: prgPct,
    final_status: allComplete ? status : 'Pending Evaluation',
  });
  enqueueExamTree(examId);
  const result = db.prepare('SELECT * FROM exam_results WHERE exam_id = ?').get(examId);
  if (allComplete && !settings.get('scoring.require_evaluator_finalization')) finalizeResult(examId, { system: true, comments: null });
  return result;
}

function onExamSubmitted(examId) {
  scoreAptitude(examId);
  require('./evaluation').ensureAnswerRows(examId);
  const db = getDb();
  db.prepare("UPDATE exams SET status = 'Under Evaluation' WHERE id = ? AND status = 'Submitted'").run(examId);
  recomputeResult(examId, { trigger: 'submission' });
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  audit('APTITUDE_SCORED', { examId, candidateId: exam.candidate_id, details: db.prepare('SELECT aptitude_score, aptitude_max, aptitude_percentage FROM exam_results WHERE exam_id = ?').get(examId) });
  const email = require('./email');
  email.sendExamSubmitted(examId);
  if (settings.get('email.send_completion_email')) email.sendCandidateCompletion(examId);
  if (settings.get('ai.auto_evaluate_on_submit')) {
    setImmediate(() => require('./evaluation').evaluateExam(examId).catch((e) => {
      console.error('Evaluation failed', examId, e.message);
      audit('EVALUATION_ERROR', { examId, details: { error: e.message } });
    }));
  }
}

function finalizeResult(examId, { req = null, comments = null, system = false } = {}) {
  const db = getDb();
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) throw httpError(404, 'Exam not found');
  const r = db.prepare('SELECT * FROM exam_results WHERE exam_id = ?').get(examId);
  if (!r) throw httpError(409, 'No result exists for this exam yet');
  if (r.finalized) throw httpError(409, 'This result has already been finalised');
  if (!['PASS', 'FAIL'].includes(r.final_status)) throw httpError(409, 'All communication answers must be evaluated before the result can be finalised');
  const now = nowIso();
  db.prepare(`UPDATE exam_results SET finalized = 1, finalized_by = ?, finalized_at = ?, evaluator_comments = COALESCE(?, evaluator_comments), modified_at = ? WHERE id = ?`)
    .run(req?.user?.id || null, now, comments, now, r.id);
  db.prepare("UPDATE exams SET status = 'Completed', modified_at = ? WHERE id = ?").run(now, examId);
  const fresh = db.prepare('SELECT * FROM exam_results WHERE id = ?').get(r.id);
  patchCandidate(exam.candidate_id, { candidate_status: fresh.final_status === 'PASS' ? 'Passed' : 'Failed', exam_status: 'Completed',
    final_status: fresh.final_status, evaluator_comments: fresh.evaluator_comments });
  audit('RESULT_FINALIZED', { examId, candidateId: exam.candidate_id, userId: req?.user?.id, actor: system ? 'system' : req?.user?.username, req,
    details: { final_status: fresh.final_status, final_score: fresh.final_score, auto: system } });
  enqueueExamTree(examId);
  require('./email').sendResultToHr(examId);
  return fresh;
}

function reopenResult(examId, reason, req) {
  const db = getDb();
  const r = db.prepare('SELECT * FROM exam_results WHERE exam_id = ?').get(examId);
  if (!r || !r.finalized) throw httpError(409, 'Result is not finalised');
  if (!String(reason || '').trim()) throw httpError(400, 'A reason is required to reopen a finalised result');
  db.prepare('UPDATE exam_results SET finalized = 0, finalized_by = NULL, finalized_at = NULL, modified_at = ? WHERE id = ?').run(nowIso(), r.id);
  db.prepare("UPDATE exams SET status = 'Evaluated' WHERE id = ?").run(examId);
  audit('RESULT_REOPENED', { examId, candidateId: r.candidate_id, userId: req.user.id, actor: req.user.username, req, details: { reason, previous_status: r.final_status } });
  return recomputeResult(examId, { trigger: 'reopen' });
}

function setResultComments(examId, comments, req) {
  const db = getDb();
  const r = db.prepare('SELECT * FROM exam_results WHERE exam_id = ?').get(examId);
  if (!r) throw httpError(404, 'Result not found');
  db.prepare('UPDATE exam_results SET evaluator_comments = ?, modified_at = ? WHERE id = ?').run(comments, nowIso(), r.id);
  patchCandidate(r.candidate_id, { evaluator_comments: comments });
  audit('EVALUATOR_COMMENTS_UPDATED', { examId, candidateId: r.candidate_id, userId: req.user.id, actor: req.user.username, req });
  enqueueExamTree(examId);
}

// Full detail used by result screens, evaluation page and PDF report.
function getExamDetail(examId, { includeAnswers = true } = {}) {
  const db = getDb();
  const exam = db.prepare(`SELECT e.*, s.code AS set_code, s.name AS set_name, t.name AS exam_type_name FROM exams e
    LEFT JOIN exam_sets s ON s.id = e.exam_set_id JOIN exam_types t ON t.id = e.exam_type_id WHERE e.id = ?`).get(examId);
  if (!exam) return null;
  delete exam.token_hash; delete exam.access_code_hash;
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(exam.candidate_id);
  const result = db.prepare('SELECT * FROM exam_results WHERE exam_id = ?').get(examId) || null;
  if (result) for (const k of ['aptitude_breakdown', 'communication_rubric', 'scoring_snapshot', 'strengths', 'improvements', 'programming_breakdown', 'programming_rubric']) result[k] = parseJson(result[k]);
  const out = { exam: { ...exam, timing: parseJson(exam.timing) }, candidate, result };
  if (includeAnswers) {
    out.aptitude = db.prepare(`SELECT eq.display_order, q.id AS question_id, q.code, q.category, q.topic, q.difficulty, q.question, q.table_json,
      q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.marks, q.explanation, a.selected_answer, a.is_correct, a.marks_awarded,
      a.answered_at, a.marked_for_review, a.change_count FROM exam_questions eq JOIN aptitude_questions q ON q.id = eq.question_id
      LEFT JOIN aptitude_answers a ON a.exam_id = eq.exam_id AND a.question_id = eq.question_id
      WHERE eq.exam_id = ? AND eq.section = 'aptitude' ORDER BY eq.display_order`).all(examId)
      .map((r) => ({ ...r, table: parseJson(r.table_json) }));
    out.communication = db.prepare(`SELECT eq.display_order, q.id AS question_id, q.code, q.question, q.marks, q.expected_words_min, q.expected_words_max,
      a.id AS answer_id, a.answer_text, a.word_count, a.answered_at FROM exam_questions eq JOIN communication_questions q ON q.id = eq.question_id
      LEFT JOIN communication_answers a ON a.exam_id = eq.exam_id AND a.question_id = eq.question_id
      WHERE eq.exam_id = ? AND eq.section = 'communication' ORDER BY eq.display_order`).all(examId).map((r) => {
      const evals = r.answer_id ? db.prepare(`SELECT ev.*, u.full_name AS evaluator_name FROM communication_evaluations ev LEFT JOIN users u ON u.id = ev.created_by
        WHERE ev.answer_id = ? ORDER BY ev.id DESC`).all(r.answer_id).map((e) => ({ ...e, strengths: parseJson(e.strengths, []), improvements: parseJson(e.improvements, []), raw_response: undefined })) : [];
      return { ...r, current_evaluation: evals.find((e) => e.is_current) || null, evaluation_history: evals };
    });
    out.programming = db.prepare(`SELECT eq.display_order, q.id AS question_id, q.code, q.language, l.label AS language_label, q.set_number, q.topic, q.task_type,
      q.difficulty, q.question, q.starter_code, q.reference_solution, q.evaluation_points, q.marks, a.id AS answer_id, a.answer_text, a.line_count, a.answered_at
      FROM exam_questions eq JOIN programming_questions q ON q.id = eq.question_id JOIN programming_languages l ON l.key = q.language
      LEFT JOIN programming_answers a ON a.exam_id = eq.exam_id AND a.question_id = eq.question_id
      WHERE eq.exam_id = ? AND eq.section = 'programming' ORDER BY eq.display_order`).all(examId).map((r) => {
      const evals = r.answer_id ? db.prepare(`SELECT ev.*, u.full_name AS evaluator_name FROM programming_evaluations ev LEFT JOIN users u ON u.id = ev.created_by
        WHERE ev.answer_id = ? ORDER BY ev.id DESC`).all(r.answer_id).map((e) => ({ ...e, strengths: parseJson(e.strengths, []), improvements: parseJson(e.improvements, []),
        issues: parseJson(e.issues, []), raw_response: undefined })) : [];
      return { ...r, evaluation_points: parseJson(r.evaluation_points, []), current_evaluation: evals.find((e) => e.is_current) || null, evaluation_history: evals };
    });
  }
  out.skills = require('./programming').getSkills(exam.candidate_id);
  out.reschedule_requests = db.prepare('SELECT * FROM reschedule_requests WHERE exam_id = ? OR resulting_exam_id = ? ORDER BY id DESC').all(examId, examId)
    .map((x) => ({ ...x, system_evidence: parseJson(x.system_evidence) }));
  return out;
}

module.exports = { scoreAptitude, recomputeResult, onExamSubmitted, finalizeResult, reopenResult, setResultComments, getExamDetail, computeOutcome, scoringConfig };
