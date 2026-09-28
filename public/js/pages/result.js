// Candidate Examination Result + Communication Evaluation Report (staff view).
import { get } from '../api.js';
import { h, html, fmt, badge, resultBadge, table, bars } from '../ui.js';
import { can } from '../app.js';

const SRC = { ai: 'AI Evaluation', rule: 'Automated rule-based', manual: 'Manual (evaluator)' };
export default async function (el, { id }) {
  const d = await get(`/exams/${id}`);
  const { candidate: c, exam: e, result: r } = d;
  el.append(h('div', { class: 'page-head' },
    h('div', {}, h('a', { href: `#/candidates/${c.id}`, class: 'small' }, `‹ ${c.full_name}`), h('h1', {}, 'Candidate Examination Result'),
      h('p', {}, `${e.exam_type_name} · ${e.exam_code} · attempt ${e.attempt_number}`)),
    h('div', { class: 'btn-row' },
      can('evaluation') && r && !r.finalized ? h('a', { class: 'btn primary', href: `#/evaluation/${e.id}` }, 'Evaluate & finalise') : null,
      h('a', { class: 'btn', href: `/api/reports/exam/${e.id}.pdf`, target: '_blank', rel: 'noopener' }, 'View PDF report'),
      h('a', { class: 'btn', href: `/api/reports/exam/${e.id}.pdf?download=1` }, 'Download PDF'),
      h('button', { class: 'btn', onclick: () => window.print() }, 'Print'))));

  const kv = (pairs) => h('div', { class: 'kv' }, pairs.map(([k, v]) => h('div', {}, h('span', {}, k), v instanceof Node ? v : h('b', {}, v ?? '—'))));
  el.append(h('div', { class: 'card' }, kv([
    ['Candidate', c.full_name], ['Candidate ID', c.candidate_code], ['Position', c.position_applied], ['Email', c.email],
    ['Exam set', e.set_code], ['Exam date', fmt.dt(e.started_at)], ['Exam duration', fmt.dur(e.duration_seconds)], ['Attempt number', String(e.attempt_number)],
    ['Submission', e.submission_type === 'auto_timer' ? 'Auto-submitted (timer expired)' : e.submission_type === 'admin' ? `Submitted by ${e.submitted_by}` : 'Manual (candidate)'],
    ['Tab switches', String(e.tab_switch_count)], ['Integrity flags', String(e.suspicious_event_count)], ['Status', (() => { const s = h('span'); s.innerHTML = badge(e.status).__raw; return s; })()],
  ])));
  if (!r) { el.append(h('div', { class: 'callout warn' }, 'No result has been calculated yet.')); return; }

  const pass = r.final_status === 'PASS'; const pending = r.final_status === 'Pending Evaluation';
  const prg = d.programming || [];
  const statCard = (label, value, sub, cls = '') => h('div', { class: 'stat' }, h('div', { class: 'label' }, label), h('div', { class: `value ${cls}` }, value), h('div', { class: 'sub' }, sub));
  el.append(h('div', { class: 'result-hero', style: 'margin-bottom:18px' },
    statCard('Aptitude', `${r.aptitude_score} / ${r.aptitude_max}`, `Percentage ${fmt.pct(r.aptitude_percentage)} · ${r.aptitude_answered}/${d.aptitude.length} answered`),
    statCard('Communication', r.communication_score != null ? `${fmt.num(r.communication_score, 1)} / ${r.communication_max}` : 'Pending', pending ? `${r.communication_evaluated}/10 evaluated` : `Percentage ${fmt.pct(r.communication_percentage)}`),
    ...(prg.length ? [statCard('Programming', r.programming_score != null ? `${fmt.num(r.programming_score, 1)} / ${r.programming_max}` : 'Pending',
      `${prg[0].language_label} set ${e.programming_set} · ${r.programming_percentage != null ? fmt.pct(r.programming_percentage) : `${r.programming_evaluated}/${prg.length} evaluated`}`)] : []),
    statCard('Overall', fmt.pct(r.final_score), `Weights: apt ${r.scoring_snapshot?.aptitude_weight} · comm ${r.scoring_snapshot?.communication_weight}${prg.length ? ` · prog ${r.scoring_snapshot?.programming_weight}` : ''}`),
    statCard('Result', pending ? 'PENDING' : r.final_status, r.finalized ? `Finalised ${fmt.dt(r.finalized_at)}` : 'Provisional – awaiting finalisation', pending ? '' : pass ? 'pass' : 'fail')));
  if (r.scoring_snapshot?.reasons?.length) el.append(h('div', { class: 'callout bad' }, r.scoring_snapshot.reasons.join('. ') + '.'));
  if (prg.length) el.querySelector('.result-hero').style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
  el.append(h('p', { class: 'muted small' }, `Pass criteria at calculation: aptitude ≥ ${r.scoring_snapshot?.aptitude_min_pct}%, communication ≥ ${r.scoring_snapshot?.communication_min_pct}%${prg.length ? `, programming ≥ ${r.scoring_snapshot?.programming_min_pct}%` : ''}, overall ≥ ${r.scoring_snapshot?.overall_min_pct}%.`));
  if (d.skills?.length) el.append(h('div', { class: 'card' }, h('h3', {}, 'Declared skills'), h('div', { class: 'btn-row' }, d.skills.map((x) => h('span', { class: 'badge brand', style: 'font-size:12.5px' }, `${x.skill} · ${x.level}${x.years != null ? ` · ${x.years}y` : ''}`)))));

  const rub = r.communication_rubric || {};
  const rubItems = [['Grammar', rub.grammar], ['Vocabulary', rub.vocabulary], ['Clarity', rub.clarity], ['Structure', rub.structure], ['Professional Communication', rub.professional]];
  const sources = [...new Set(d.communication.map((q) => q.current_evaluation?.source).filter(Boolean))].map((s) => SRC[s]);
  el.append(h('div', { class: 'grid g2' },
    h('div', { class: 'card' }, h('h3', {}, 'Aptitude – category-wise performance'),
      bars(Object.entries(r.aptitude_breakdown || {}).map(([k, v]) => ({ label: k, value: v.percentage, v })), { max: 100, format: (x) => `${x}%`, title: (x) => `${x.label}: ${x.v.correct}/${x.v.total} correct` })),
    h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Communication Assessment'), h('span', { class: 'badge purple' }, sources.join(' + ') || 'Pending')),
      rub.grammar != null ? bars(rubItems.map(([l, v]) => ({ label: l, value: v })), { max: 20, format: (v) => `${fmt.num(v, 1)}/20` }) : h('div', { class: 'empty' }, 'Not evaluated yet.'),
      rub.total != null ? h('p', {}, h('b', {}, `Total: ${fmt.num(rub.total, 1)}/100`), h('span', { class: 'muted small' }, ' (average per answer)')) : null)));
  if (prg.length) {
    const pr = r.programming_rubric || {};
    el.append(h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h3', {}, `Programming assessment – ${prg[0].language_label}`),
        pr.correctness != null ? bars([['Correctness', pr.correctness, 40], ['Logic', pr.logic, 20], ['Code quality', pr.code_quality, 15], ['Efficiency', pr.efficiency, 10], ['Edge cases', pr.edge_cases, 15]]
          .map(([l, v, mx]) => ({ label: l, value: v / mx * 100, raw: v, mx })), { max: 100, format: (v) => `${fmt.num(v, 0)}%`, title: (x) => `${x.label}: ${fmt.num(x.raw, 1)}/${x.mx}` }) : h('div', { class: 'empty' }, 'Not evaluated yet.')),
      h('div', { class: 'card' }, h('h3', {}, 'Programming by topic'),
        bars(Object.entries(r.programming_breakdown || {}).map(([k, v]) => ({ label: k, value: v.percentage, v })), { max: 100, format: (x) => `${x}%`, title: (x) => `${x.label}: ${x.v.score}/${x.v.max}` }))));
  }
  const list = (items) => (items?.length ? h('ul', {}, items.map((s) => h('li', {}, s))) : h('p', { class: 'muted' }, '—'));
  el.append(h('div', { class: 'grid g3' },
    h('div', { class: 'card' }, h('h3', {}, 'Strengths'), list(r.strengths)),
    h('div', { class: 'card' }, h('h3', {}, 'Areas for improvement'), list(r.improvements)),
    h('div', { class: 'card' }, h('h3', {}, 'Evaluator comments'), h('p', { style: 'white-space:pre-wrap' }, r.evaluator_comments || '—'))));

  el.append(h('div', { class: 'card' }, h('h3', {}, 'Communication responses'),
    ...d.communication.map((q, i) => {
      const ev = q.current_evaluation;
      return h('div', { style: 'margin-bottom:16px' },
        h('b', {}, `Q${i + 1}. ${q.question}`), h('div', { class: 'muted small' }, `${q.code} · ${q.word_count || 0} words · ${ev ? `${fmt.num(ev.question_score, 1)}/${q.marks} · ${SRC[ev.source]}${ev.provider && ev.source === 'ai' ? ' (' + ev.provider + ')' : ''}` : 'not evaluated'}`),
        h('div', { class: 'answer-text' }, q.answer_text || '(No answer submitted)'),
        ev ? h('div', { class: 'small', style: 'margin-top:4px' }, `Grammar ${ev.grammar} · Vocabulary ${ev.vocabulary} · Clarity ${ev.clarity} · Structure ${ev.structure} · Professional ${ev.professional}${ev.feedback ? ' — ' + ev.feedback : ''}`) : null,
        ev?.evaluator_comments ? h('div', { class: 'small' }, h('b', {}, 'Evaluator: '), ev.evaluator_comments) : null);
    })));

  if (prg.length) el.append(h('div', { class: 'card' }, h('h3', {}, 'Programming responses'),
    ...prg.map((q, i) => {
      const ev = q.current_evaluation;
      return h('div', { style: 'margin-bottom:16px' },
        h('b', {}, `P${i + 1}. ${q.question}`), h('div', { class: 'muted small' }, `${q.code} · ${q.topic || ''} · ${q.task_type.replace('_', ' ')} · ${ev ? `${fmt.num(ev.question_score, 1)}/${q.marks} · ${String(ev.verdict || '').replace('_', ' ')} · ${ev.source === 'ai' ? 'AI Evaluation' : ev.source === 'manual' ? 'Manual (evaluator)' : 'Automatic'}` : 'awaiting review'}`),
        h('pre', { class: 'answer-text mono', style: 'white-space:pre-wrap' }, q.answer_text || '(No answer submitted)'),
        ev?.feedback ? h('div', { class: 'small' }, ev.feedback) : null);
    })));
  el.append(h('div', { class: 'card' }, h('h3', {}, 'Aptitude answer sheet (HR only)'), table([
    { label: '#', num: true, key: 'display_order' },
    { label: 'Question', render: (q) => html`<div>${q.question}</div><div class="muted small">${q.code} · ${q.category} · ${q.difficulty}</div>` },
    { label: 'Selected', render: (q) => q.selected_answer ? `${q.selected_answer}. ${q['option_' + q.selected_answer.toLowerCase()]}` : 'Unanswered' },
    { label: 'Correct', render: (q) => `${q.correct_answer}. ${q['option_' + q.correct_answer.toLowerCase()]}` },
    { label: 'Result', render: (q) => html`<span class="badge ${q.is_correct ? 'good' : q.selected_answer ? 'bad' : ''}">${q.is_correct ? 'Correct' : q.selected_answer ? 'Incorrect' : 'Unanswered'}</span>` },
    { label: 'Marks', num: true, render: (q) => `${q.marks_awarded ?? 0}/${q.marks}` },
  ], d.aptitude)));

  el.append(h('div', { class: 'card' }, h('h3', {}, 'Attempt audit trail'), table([
    { label: 'Time', render: (a) => fmt.dt(a.timestamp) }, { label: 'Event', render: (a) => html`<span class="badge ${a.event.startsWith('SUSPICIOUS') ? 'warn' : ''}">${a.event}</span>` },
    { label: 'Actor', key: 'actor' }, { label: 'IP', key: 'ip_address' }, { label: 'Details', render: (a) => html`<span class="small mono">${(a.details || '').slice(0, 160)}</span>` },
  ], d.audit)));
  void resultBadge;
}
