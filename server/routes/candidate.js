'use strict';
// Candidate portal API. Mounted at /api/candidate. Never returns correct answers or scoring keys.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getDb } = require('../db');
const { httpError, parseJson } = require('../lib/util');
const settings = require('../lib/settings');
const { candidateAuth, cookieOpts, CAND_COOKIE } = require('../middleware/auth');
const engine = require('../services/examEngine');
const programming = require('../services/programming');

const r = express.Router();
const INSTRUCTIONS = [
  'Read every question carefully.',
  'Answer all aptitude questions.',
  'Select only one answer for each aptitude question.',
  'Write complete paragraphs for communication questions.',
  'Do not refresh or close the browser during the examination.',
  'Do not use browser back navigation.',
  'Once submitted, the examination cannot be changed.',
  'The examination is timed.',
  'The system will automatically submit the exam when the timer expires.',
  'Do not share examination questions with other candidates.',
];

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' } });

r.get('/link-info', loginLimiter, (req, res) => {
  // Lets the login screen show whether an access code is needed, without revealing anything about the exam.
  res.json({ require_access_code: settings.get('exam.require_access_code'), company: settings.get('email.company_name') });
});
r.post('/login', loginLimiter, (req, res) => {
  const { token, access_code } = req.body || {};
  const s = engine.candidateLogin({ token, accessCode: access_code }, req);
  res.cookie(CAND_COOKIE, s.token, cookieOpts(Math.max(60000, s.maxAgeMs)));
  res.json({ ok: true });
});

r.use(candidateAuth);

function state(req) {
  const exam = engine.tick(req.exam.id);
  const set = getDb().prepare('SELECT code FROM exam_sets WHERE id = ?').get(exam.exam_set_id);
  const type = getDb().prepare('SELECT name, config FROM exam_types WHERE id = ?').get(exam.exam_type_id);
  const t = parseJson(exam.timing, {});
  const submitted = engine.SUBMITTED.includes(exam.status);
  return {
    candidate: { name: req.candidate.full_name, first_name: req.candidate.first_name, candidate_id: req.candidate.candidate_code,
      email: req.candidate.email, position: req.candidate.position_applied },
    exam: { exam_id: exam.exam_code, exam_set: set?.code, attempt: exam.attempt_number, status: submitted ? 'Submitted' : exam.status, title: type.name,
      sections: parseJson(type.config, {}).sections, started_at: exam.started_at, submitted_at: exam.submitted_at, submission_type: exam.submission_type },
    timing: exam.status === 'In Progress' ? engine.remaining(exam) : null,
    duration: t.mode ? t : { mode: settings.get('timer.mode'),
      total_minutes: settings.get('timer.total_minutes') + (engine.hasProgramming(exam) ? settings.get('timer.programming_minutes') : 0),
      aptitude_minutes: settings.get('timer.aptitude_minutes'), communication_minutes: settings.get('timer.communication_minutes'),
      programming_minutes: engine.hasProgramming(exam) ? settings.get('timer.programming_minutes') : null },
    available_from: exam.available_from,
    skills: settings.get('exam.collect_skills') || engine.hasProgramming(exam) ? {
      required: settings.get('exam.collect_skills') || engine.hasProgramming(exam),
      min: Math.max(engine.hasProgramming(exam) ? 1 : 0, settings.get('exam.min_skills')),
      levels: programming.LEVELS, categories: programming.CATEGORIES, suggestions: programming.SUGGESTIONS,
      current: programming.getSkills(exam.candidate_id).map((x) => ({ skill: x.skill, level: x.level, years: x.years, category: x.category, test_language: x.test_language })),
    } : null,
    programming: engine.hasProgramming(exam) ? {
      language: exam.programming_language,
      language_label: exam.programming_language ? getDb().prepare('SELECT label FROM programming_languages WHERE key = ?').get(exam.programming_language)?.label : null,
      choice: settings.get('exam.programming_language_choice'),
      languages: programming.readyLanguages().map((l) => ({ key: l.key, label: l.label })),
    } : null,
    blockers: exam.status === 'Assigned' ? engine.startBlockers(exam) : [],
    instructions: INSTRUCTIONS,
    config: { autosave_seconds: settings.get('exam.autosave_seconds'), disable_copy_paste: settings.get('exam.disable_copy_paste'),
      tab_switch_warning_limit: settings.get('exam.tab_switch_warning_limit'), min_words: settings.get('exam.min_words_recommended'),
      max_words: settings.get('exam.max_words'), show_result: settings.get('exam.show_result_to_candidate') },
    tab_switch_count: exam.tab_switch_count,
    progress: exam.status === 'In Progress' || submitted ? engine.progressSummary(exam.id) : null,
  };
}
r.get('/state', (req, res) => res.json(state(req)));
// Candidate declares skills (multiple) and, if the exam has a programming section, chooses the test language from them.
r.post('/skills', (req, res) => {
  const exam = engine.getExam(req.exam.id);
  if (exam.status !== 'Assigned') throw httpError(409, 'Skills can only be changed before the examination starts.', 'LOCKED');
  const skills = programming.saveSkills(exam.candidate_id, req.body?.skills || [], { source: 'candidate', req });
  const min = Math.max(engine.hasProgramming(exam) ? 1 : 0, settings.get('exam.min_skills'));
  if (skills.length < min) throw httpError(400, `Please add at least ${min} skill${min === 1 ? '' : 's'}.`, 'VALIDATION');
  if (engine.hasProgramming(exam)) {
    if (settings.get('exam.programming_language_choice') === 'hr' && exam.programming_language) {
      // language fixed by HR – ignore candidate choice
    } else {
      const lang = String(req.body?.programming_language || '');
      if (!lang) throw httpError(400, 'Choose the programming language for your test.', 'VALIDATION');
      if (lang !== exam.programming_language) programming.assignProgramming(exam.id, lang, { req, by: 'candidate' });
    }
  }
  res.json(state(req));
});
r.post('/start', (req, res) => {
  if (!req.body || req.body.agree !== true) throw httpError(400, 'You must agree to the instructions to start the examination');
  engine.acceptAndStart(req.exam, req);
  res.json(state(req));
});
r.get('/paper', (req, res) => {
  const exam = engine.tick(req.exam.id);
  if (exam.status !== 'In Progress') throw httpError(409, engine.SUBMITTED.includes(exam.status) ? 'This examination has been submitted and is locked.' : 'The examination has not started.', engine.SUBMITTED.includes(exam.status) ? 'LOCKED' : 'NOT_STARTED');
  res.set('Cache-Control', 'no-store');
  res.json({ ...engine.getPaper(exam), timing: engine.remaining(exam) });
});
r.post('/answers', (req, res) => res.json(engine.saveAnswers(req.exam, req.body || {}, req)));
r.post('/section/next', (req, res) => {
  const exam = engine.tick(req.exam.id);
  if (exam.status !== 'In Progress') throw httpError(409, 'The examination is not in progress.');
  if (req.body?.aptitude || req.body?.communication || req.body?.programming) engine.saveAnswers(exam, req.body, req);
  engine.moveToNextSection(engine.getExam(exam.id), new Date().toISOString(), 'candidate');
  res.json({ timing: engine.remaining(engine.getExam(exam.id)) });
});
r.post('/events', (req, res) => res.json(engine.recordEvent(engine.getExam(req.exam.id), req.body || {}, req)));
r.post('/submit', (req, res) => {
  let exam = engine.tick(req.exam.id);
  if (engine.SUBMITTED.includes(exam.status)) {
    if (exam.submission_type === 'auto_timer' && req.body?.reason === 'timer') return res.json({ ok: true, already: true, state: state(req) });
    throw httpError(409, 'This examination has already been submitted.', 'ALREADY_SUBMITTED');
  }
  if (req.body?.answers) { try { engine.saveAnswers(exam, req.body.answers, req); } catch (e) { if (e.code !== 'TIME_UP') throw e; } }
  exam = engine.getExam(exam.id);
  if (exam.status === 'In Progress') engine.submitExam(exam.id, { type: req.body?.reason === 'timer' ? 'auto_timer' : 'manual', by: 'candidate', req });
  res.json({ ok: true, state: state(req) });
});
r.get('/result', (req, res) => {
  if (!settings.get('exam.show_result_to_candidate')) throw httpError(403, 'Results are shared by the recruitment team.');
  const rr = getDb().prepare('SELECT * FROM exam_results WHERE exam_id = ?').get(req.exam.id);
  if (!rr || !rr.finalized) return res.json({ available: false });
  const out = { available: true, aptitude_score: rr.aptitude_score, aptitude_max: rr.aptitude_max, aptitude_percentage: rr.aptitude_percentage,
    communication_score: rr.communication_score, communication_max: rr.communication_max, communication_percentage: rr.communication_percentage,
    final_score: rr.final_score, final_status: rr.final_status, evaluator_comments: rr.evaluator_comments,
    strengths: parseJson(rr.strengths, []), improvements: parseJson(rr.improvements, []) };
  if (settings.get('exam.show_correct_answers')) {
    out.answers = getDb().prepare(`SELECT q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation, a.selected_answer, a.is_correct
      FROM exam_questions eq JOIN aptitude_questions q ON q.id = eq.question_id LEFT JOIN aptitude_answers a ON a.exam_id = eq.exam_id AND a.question_id = q.id
      WHERE eq.exam_id = ? AND eq.section = 'aptitude' ORDER BY eq.display_order`).all(req.exam.id);
  }
  res.json(out);
});
r.post('/logout', (req, res) => { res.clearCookie(CAND_COOKIE, { path: '/' }); res.json({ ok: true }); });
module.exports = r;
