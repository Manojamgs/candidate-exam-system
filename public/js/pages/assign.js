import { get, post, qs } from '../api.js';
import { h, html, fmt, badge, table, toast, bars } from '../ui.js';
import { navigate, session } from '../app.js';
import { assignDialog, showCredentials } from '../shared.js';

export default async function render(el) {
  const [ready, all, sets, mon] = await Promise.all([
    get('/candidates' + qs({ exam_status: 'Not Assigned', limit: 200 })),
    get('/candidates' + qs({ limit: 500 })),
    get('/exam-sets'),
    get('/monitor'),
  ]);
  el.innerHTML = '';
  const reload = () => render(el);
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Exam Assignment'),
    h('p', {}, 'Assign examinations, approve retakes and review exam-set usage. Each assignment generates a unique Exam ID, a secure expiring link and an access code.'))));

  const pending = mon.exams.filter((e) => e.status === 'Pending Approval');
  if (pending.length) {
    el.append(h('div', { class: 'card' }, h('h3', {}, 'Retakes awaiting approval'), table([
      { label: 'Candidate', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.candidate_code}</div>` },
      { label: 'Exam', key: 'exam_code' }, { label: 'Set', key: 'set_code' }, { label: 'Requested', render: (r) => fmt.dt(r.assigned_at) },
      { label: '', render: (r) => (session.user.role === 'admin'
        ? h('button', { class: 'btn sm success', onclick: async () => { try { showCredentials(await post(`/exams/${r.id}/approve-retake`), 'Retake approved', { examId: r.id, candidateEmail: r.email || r.candidate_email }); reload(); } catch (e) { toast(e.message, 'error'); } } }, 'Approve')
        : h('span', { class: 'muted small' }, 'Admin approval required')) },
    ], pending)));
  }

  const eligible = all.rows.filter((c) => ['Not Assigned', 'Completed', 'Expired'].includes(c.exam_status) || c.exam_status === 'Evaluated');
  const newOnes = ready.rows;
  el.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, `Candidates without an exam (${newOnes.length})`),
    newOnes.length ? h('button', { class: 'btn primary', onclick: bulk }, `Assign all ${newOnes.length} automatically`) : null),
    table([
      { label: 'Candidate', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.candidate_code} · ${r.email}</div>` },
      { label: 'Position', key: 'position_applied' }, { label: 'Status', render: (r) => badge(r.candidate_status) },
      { label: 'Applied', render: (r) => fmt.date(r.application_date) },
      { label: '', render: (r) => h('button', { class: 'btn sm primary', onclick: () => assignDialog({ ...r, attempts: 0 }, reload) }, 'Assign') },
    ], newOnes, { empty: 'Every candidate already has an exam. Create new candidates on the Candidates page.' })));

  const retake = eligible.filter((c) => c.exam_status !== 'Not Assigned');
  if (retake.length) {
    el.append(h('div', { class: 'card' }, h('h3', {}, 'Eligible for another attempt'), h('p', { class: 'muted small' }, 'Candidates whose last attempt is finished or expired. Retakes require a reason and automatically prefer a set the candidate has not taken.'),
      table([
        { label: 'Candidate', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.candidate_code}</div>` },
        { label: 'Last set', key: 'selected_exam_set' }, { label: 'Exam status', render: (r) => badge(r.exam_status) }, { label: 'Result', render: (r) => (r.final_status ? badge(r.final_status) : '—') },
        { label: '', render: (r) => h('button', { class: 'btn sm', onclick: async () => { const d = await get(`/candidates/${r.id}`); assignDialog({ ...r, attempts: d.exams.filter((e) => e.status !== 'Cancelled').length }, reload); } }, 'Assign retake') },
      ], retake, { onRow: (r) => navigate(`candidates/${r.id}`) })));
  }

  el.append(h('div', { class: 'card' }, h('h3', {}, 'Exam set usage'),
    table([
      { label: 'Set', render: (s) => html`<b>${s.code}</b><div class="muted small">${s.name}</div>` },
      { label: 'Aptitude Qs', num: true, render: (s) => `${s.readiness.aptitude} / ${s.readiness.required.mcq}` },
      { label: 'Communication Qs', num: true, render: (s) => `${s.readiness.communication} / ${s.readiness.required.written}` },
      { label: 'Ready', render: (s) => (s.readiness.ready ? html`<span class="badge good">Ready</span>` : html`<span class="badge warn">Incomplete</span>`) },
      { label: 'Times used', num: true, key: 'used' }, { label: 'Completed', num: true, key: 'completed' }, { label: 'Last used', render: (s) => fmt.dt(s.last_used_at) },
    ], sets), h('div', { style: 'margin-top:14px' }, bars(sets, { label: (s) => s.code, value: (s) => s.used, format: (v) => `${v}×` }))));

  async function bulk() {
    let ok = 0;
    for (const c of newOnes) {
      try { await post(`/candidates/${c.id}/assign`, {}); ok++; } catch (e) { toast(`${c.full_name}: ${e.message}`, 'error'); }
    }
    toast(`${ok} exam(s) assigned; invitations queued`, 'success'); reload();
  }
}
