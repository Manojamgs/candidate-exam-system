import { get, qs } from '../api.js';
import { h, html, field, select, table, fmt, downloadUrl, resultBadge } from '../ui.js';

const DATASETS = [
  ['candidates', 'Candidate list', 'All Candidate Master fields with latest exam summary.'],
  ['results', 'Examination results', 'One row per submitted attempt with section scores, rubric averages and final status.'],
  ['communication', 'Communication evaluation', 'Every written answer with rubric scores, AI feedback and evaluator adjustments.'],
  ['aptitude', 'Aptitude results', 'Every aptitude answer with the selected and correct option.'],
  ['programming', 'Programming evaluation', 'Every programming answer with the rubric scores, verdict, AI feedback, issues and evaluator adjustments.'],
  ['skills', 'Candidate skills', 'All skills declared by candidates or recorded by HR, with level and years.'],
  ['reschedules', 'Reschedule requests', 'All technical-issue requests, system evidence and Admin decisions.'],
  ['programming_questions', 'Programming question bank', 'All programming questions with reference solutions and evaluation points.'],
  ['audit', 'Audit log', 'All recorded system and examination activity.'],
  ['questions', 'Aptitude question bank + answer key', 'All 120+ aptitude questions with correct answers and explanations.'],
];
export default async function (el) {
  const sets = await get('/exam-sets');
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Reports & Export'), h('p', {}, 'Download data as Excel, CSV or PDF, and generate the Complete Candidate Report.'))));
  const f = { exam_set: select('exam_set', [['', 'All sets'], ...sets.map((s) => s.code)], ''), result: select('result', [['', 'Any result'], 'PASS', 'FAIL', 'Pending Evaluation'], ''),
    date_from: h('input', { type: 'date' }), date_to: h('input', { type: 'date' }), position: h('input', { type: 'text', placeholder: 'Any position' }) };
  const filters = h('div', { class: 'filters' }, field('Exam set', f.exam_set), field('Result', f.result), field('From', f.date_from), field('To', f.date_to), field('Position', f.position));
  const params = () => ({ exam_set: f.exam_set.value, result: f.result.value, date_from: f.date_from.value, date_to: f.date_to.value, position: f.position.value });
  el.append(h('div', { class: 'card' }, h('h3', {}, 'Filters (applied to result-based exports)'), filters));
  el.append(h('div', { class: 'card' }, h('h3', {}, 'Data exports'), table([
    { label: 'Dataset', render: (d) => html`<b>${d[1]}</b><div class="muted small">${d[2]}</div>` },
    { label: 'Download', render: (d) => h('div', { class: 'btn-row' }, ['xlsx', 'csv', 'pdf'].map((fmtx) =>
      h('button', { class: 'btn sm', onclick: () => downloadUrl(`/api/export/${d[0]}` + qs({ ...(d[0] === 'candidates' ? { exam_set: f.exam_set.value, result: f.result.value, date_from: f.date_from.value, date_to: f.date_to.value, position: f.position.value } : params()), format: fmtx })) },
        fmtx === 'xlsx' ? 'Excel' : fmtx.toUpperCase()))) },
  ], DATASETS)));
  const res = await get('/results');
  el.append(h('div', { class: 'card' }, h('h3', {}, 'Complete Candidate Report (PDF)'),
    h('p', { class: 'muted small' }, 'Candidate information, examination details, aptitude category performance, communication rubric, final result, strengths, improvements, evaluator comments, written answers and the aptitude answer sheet.'),
    table([
      { label: 'Candidate', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.candidate_code}</div>` },
      { label: 'Exam', render: (r) => html`${r.exam_code}<div class="muted small">${r.set_code}</div>` },
      { label: 'Submitted', render: (r) => fmt.dt(r.submitted_at) }, { label: 'Overall', num: true, render: (r) => fmt.pct(r.final_score) },
      { label: 'Result', render: (r) => resultBadge(r) },
      { label: '', render: (r) => h('div', { class: 'btn-row' }, h('a', { class: 'btn sm', href: `/api/reports/exam/${r.exam_id}.pdf`, target: '_blank', rel: 'noopener' }, 'View'),
        h('a', { class: 'btn sm primary', href: `/api/reports/exam/${r.exam_id}.pdf?download=1` }, 'Download')) },
    ], res.rows, { empty: 'No submitted exams yet.' })));
}
