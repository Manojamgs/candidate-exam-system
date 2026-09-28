import { get, qs } from '../api.js';
import { h, html, fmt, badge, resultBadge, table, field, select, downloadUrl } from '../ui.js';
import { navigate } from '../app.js';

export default async function (el) {
  const sets = await get('/exam-sets');
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Exam Results'), h('p', {}, 'All submitted examinations with aptitude, communication and overall scores.')),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/results' + qs({ ...collect(), format: 'xlsx' })) }, 'Excel'),
      h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/results' + qs({ ...collect(), format: 'csv' })) }, 'CSV'),
      h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/results' + qs({ ...collect(), format: 'pdf' })) }, 'PDF'))));
  const inputs = {
    q: h('input', { type: 'search', placeholder: 'Candidate, ID, email or exam ID' }),
    exam_set: select('exam_set', [['', 'Any'], ...sets.map((s) => s.code)], ''),
    result: select('result', [['', 'Any'], 'PASS', 'FAIL', 'Pending Evaluation'], ''),
    status: select('status', [['', 'Any'], ['pending', 'Not finalised'], ['finalized', 'Finalised']], ''),
    date_from: h('input', { type: 'date' }), date_to: h('input', { type: 'date' }),
  };
  function collect() { const o = {}; for (const [k, i] of Object.entries(inputs)) if (i.value) o[k] = i.value; return o; }
  const f = h('form', { class: 'filters card', style: 'padding:14px' });
  const g = field('Search', inputs.q); g.classList.add('grow');
  f.append(g, field('Exam set', inputs.exam_set), field('Result', inputs.result), field('Finalisation', inputs.status), field('Submitted from', inputs.date_from), field('Submitted to', inputs.date_to),
    h('button', { class: 'btn primary', type: 'submit' }, 'Filter'));
  const out = h('div');
  f.addEventListener('submit', (e) => { e.preventDefault(); load(); });
  el.append(f, out);
  async function load() {
    const d = await get('/results' + qs(collect()));
    out.innerHTML = '';
    const rows = d.rows;
    const fin = rows.filter((r) => r.final_score != null);
    out.append(h('div', { class: 'grid g4', style: 'margin-bottom:14px' },
      stat('Results shown', rows.length), stat('Pass', rows.filter((r) => r.final_status === 'PASS').length), stat('Fail', rows.filter((r) => r.final_status === 'FAIL').length),
      stat('Average overall', fin.length ? fmt.pct(Math.round(fin.reduce((s, r) => s + r.final_score, 0) / fin.length * 10) / 10) : '—')));
    out.append(table([
      { label: 'Candidate', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.candidate_code} · ${r.position_applied || ''}</div>` },
      { label: 'Exam', render: (r) => html`<span class="mono">${r.exam_code}</span><div class="muted small">${r.set_code} · attempt ${r.attempt_number}</div>` },
      { label: 'Submitted', render: (r) => html`${fmt.dt(r.submitted_at)}<div class="muted small">${r.submission_type === 'auto_timer' ? 'auto (timer)' : r.submission_type} · ${fmt.dur(r.duration_seconds)}</div>` },
      { label: 'Aptitude', num: true, render: (r) => html`${r.aptitude_score ?? '—'} / ${r.aptitude_max ?? 20}<div class="muted small">${fmt.pct(r.aptitude_percentage)}</div>` },
      { label: 'Communication', num: true, render: (r) => html`${r.communication_score != null ? fmt.num(r.communication_score, 1) : '—'} / ${r.communication_max ?? 100}<div class="muted small">${r.communication_evaluated < 10 ? `${r.communication_evaluated ?? 0}/10 evaluated` : fmt.pct(r.communication_percentage)}</div>` },
      { label: 'Programming', num: true, render: (r) => (r.programming_language ? html`${r.programming_score != null ? fmt.num(r.programming_score, 1) : '—'} / ${r.programming_max ?? 100}<div class="muted small">${r.programming_language} · ${r.programming_percentage != null ? fmt.pct(r.programming_percentage) : `${r.programming_evaluated ?? 0}/10`}</div>` : '—') },
      { label: 'Overall', num: true, render: (r) => html`<b>${fmt.pct(r.final_score)}</b>` },
      { label: 'Result', render: (r) => resultBadge(r) },
      { label: 'Exam status', render: (r) => badge(r.exam_status) },
      { label: 'Tab sw.', num: true, key: 'tab_switch_count' },
    ], rows, { onRow: (r) => navigate(`results/${r.exam_id}`), empty: 'No submitted examinations match the filters.' }));
  }
  await load();
}
const stat = (l, v) => h('div', { class: 'stat' }, h('div', { class: 'label' }, l), h('div', { class: 'value' }, v));
