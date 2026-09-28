import { get, qs } from '../api.js';
import { h, html, fmt, badge, table, field, select, downloadUrl } from '../ui.js';
import { navigate, can } from '../app.js';
import { candidateForm, CANDIDATE_STATUSES } from '../shared.js';

const EXAM_STATUSES = ['Not Assigned', 'Pending Approval', 'Assigned', 'In Progress', 'Submitted', 'Under Evaluation', 'Evaluated', 'Completed', 'Expired'];
let state = { offset: 0, limit: 25 };

export default async function (el) {
  const sets = await get('/exam-sets');
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Candidates'), h('p', {}, 'Search, filter and manage candidate records.')),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/candidates' + qs({ ...collect(), format: 'xlsx' })) }, 'Export Excel'),
      h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/candidates' + qs({ ...collect(), format: 'csv' })) }, 'Export CSV'),
      can('candidates') ? h('button', { class: 'btn primary', onclick: () => candidateForm({}, (c) => navigate(`candidates/${c.id}`)) }, '+ New candidate') : null)));
  const f = h('form', { class: 'filters card', style: 'padding:14px' });
  const inputs = {
    q: h('input', { type: 'search', name: 'q', placeholder: 'ID, name, email or mobile' }),
    position: h('input', { type: 'text', name: 'position', placeholder: 'Any' }),
    department: h('input', { type: 'text', name: 'department', placeholder: 'Any' }),
    recruiter: h('input', { type: 'text', name: 'recruiter', placeholder: 'Any' }),
    exam_set: select('exam_set', [['', 'Any'], ...sets.map((s) => s.code)], ''),
    exam_status: select('exam_status', [['', 'Any'], ...EXAM_STATUSES], ''),
    candidate_status: select('candidate_status', [['', 'Any'], ...CANDIDATE_STATUSES], ''),
    filter: select('filter', [['', 'All'], ['passed', 'Passed'], ['failed', 'Failed'], ['pending', 'Pending'], ['completed', 'Completed'], ['not_started', 'Not started'], ['under_evaluation', 'Under evaluation']], ''),
    date_from: h('input', { type: 'date', name: 'date_from' }), date_to: h('input', { type: 'date', name: 'date_to' }),
  };
  const fld = (l, i, grow) => { const x = field(l, i); if (grow) x.classList.add('grow'); return x; };
  f.append(fld('Search', inputs.q, true), fld('Position', inputs.position), fld('Department', inputs.department), fld('Recruiter', inputs.recruiter),
    fld('Exam set', inputs.exam_set), fld('Exam status', inputs.exam_status), fld('Candidate status', inputs.candidate_status), fld('Result', inputs.filter),
    fld('Applied from', inputs.date_from), fld('Applied to', inputs.date_to),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Search'), h('button', { class: 'btn', type: 'reset' }, 'Clear')));
  function collect() { const o = {}; for (const [k, i] of Object.entries(inputs)) if (i.value) o[k] = i.value; return o; }
  const results = h('div');
  f.addEventListener('submit', (e) => { e.preventDefault(); state.offset = 0; load(); });
  f.addEventListener('reset', () => setTimeout(() => { state.offset = 0; load(); }));
  el.append(f, results);
  async function load() {
    const d = await get('/candidates' + qs({ ...collect(), limit: state.limit, offset: state.offset }));
    results.innerHTML = '';
    results.append(table([
      { label: 'Candidate ID', render: (r) => html`<span class="mono">${r.candidate_code}</span>` },
      { label: 'Name', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.email}</div>` },
      { label: 'Mobile', key: 'mobile' },
      { label: 'Position', render: (r) => html`${r.position_applied || '—'}<div class="muted small">${r.department || ''}</div>` },
      { label: 'Recruiter', key: 'recruiter_name' },
      { label: 'Status', render: (r) => badge(r.candidate_status) },
      { label: 'Exam', render: (r) => html`${badge(r.exam_status)}<div class="muted small">${r.selected_exam_set || ''}</div>` },
      { label: 'Apt %', num: true, render: (r) => fmt.pct(r.aptitude_percentage) },
      { label: 'Comm %', num: true, render: (r) => fmt.pct(r.communication_percentage) },
      { label: 'Final', num: true, render: (r) => fmt.pct(r.total_percentage) },
      { label: 'Result', render: (r) => (r.final_status ? badge(r.final_status) : '—') },
      { label: 'Applied', render: (r) => fmt.date(r.application_date) },
    ], d.rows, { onRow: (r) => navigate(`candidates/${r.id}`), empty: 'No candidates match your filters.' }));
    const prev = h('button', { class: 'btn sm', disabled: state.offset === 0, onclick: () => { state.offset = Math.max(0, state.offset - state.limit); load(); } }, '‹ Previous');
    const next = h('button', { class: 'btn sm', disabled: state.offset + state.limit >= d.total, onclick: () => { state.offset += state.limit; load(); } }, 'Next ›');
    results.append(h('div', { class: 'pager' }, h('span', {}, `${d.total ? state.offset + 1 : 0}–${Math.min(d.total, state.offset + state.limit)} of ${d.total}`), h('div', { class: 'btn-row' }, prev, next)));
  }
  await load();
}
