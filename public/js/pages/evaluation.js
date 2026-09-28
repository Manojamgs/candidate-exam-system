import { get, qs } from '../api.js';
import { h, html, fmt, badge, resultBadge, table } from '../ui.js';
import { navigate } from '../app.js';

export default async function (el) {
  const [pending, done] = await Promise.all([get('/results' + qs({ status: 'pending' })), get('/results' + qs({ status: 'finalized' }))]);
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Communication Evaluation'),
    h('p', {}, 'Review AI / rule-based communication scores, adjust where needed, add comments and finalise results.'))));
  const cols = [
    { label: 'Candidate', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.candidate_code} · ${r.position_applied || ''}</div>` },
    { label: 'Exam', render: (r) => html`${r.exam_code}<div class="muted small">${r.set_code}</div>` },
    { label: 'Submitted', render: (r) => fmt.dt(r.submitted_at) },
    { label: 'Aptitude', num: true, render: (r) => fmt.pct(r.aptitude_percentage) },
    { label: 'Evaluated', num: true, render: (r) => `${r.communication_evaluated ?? 0}/10` },
    { label: 'Communication', num: true, render: (r) => fmt.pct(r.communication_percentage) },
    { label: 'Programming', num: true, render: (r) => (r.programming_language ? html`${r.programming_percentage != null ? fmt.pct(r.programming_percentage) : `${r.programming_evaluated ?? 0}/10`}<div class="muted small">${r.programming_language}</div>` : '—') },
    { label: 'Overall', num: true, render: (r) => fmt.pct(r.final_score) },
    { label: 'Result', render: (r) => resultBadge(r) },
    { label: 'Status', render: (r) => badge(r.exam_status) },
  ];
  el.append(h('div', { class: 'card' }, h('h3', {}, `Awaiting review / finalisation (${pending.rows.length})`),
    table(cols, pending.rows, { onRow: (r) => navigate(`evaluation/${r.exam_id}`), empty: 'Nothing waiting for evaluation.' })));
  el.append(h('div', { class: 'card' }, h('h3', {}, `Recently finalised (${done.rows.length})`),
    table(cols, done.rows.slice(0, 25), { onRow: (r) => navigate(`results/${r.exam_id}`), empty: 'No finalised results yet.' })));
}
