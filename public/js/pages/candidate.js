import { get, post, put } from '../api.js';
import { h, html, fmt, badge, resultBadge, table, toast, confirmBox, select } from '../ui.js';
import { navigate, can, session } from '../app.js';
import { candidateForm, assignDialog, showCredentials, emailLinkDialog, skillsDialog, rescheduleDialog, CANDIDATE_STATUSES } from '../shared.js';

const PROFILE = [
  ['Candidate ID', 'candidate_code'], ['Full name', 'full_name'], ['Email', 'email'], ['Mobile', 'mobile'], ['Alternate mobile', 'alternate_mobile'],
  ['Date of birth', 'date_of_birth', 'date'], ['Nationality', 'nationality'], ['Current location', 'current_location'], ['Country', 'country'], ['City', 'city'],
  ['Position applied for', 'position_applied'], ['Department', 'department'], ['Experience', 'experience'], ['Years of experience', 'years_of_experience'],
  ['Highest qualification', 'highest_qualification'], ['University / institute', 'university'], ['Current company', 'current_company'],
  ['Current salary', 'current_salary'], ['Expected salary', 'expected_salary'], ['Notice period', 'notice_period'], ['Recruitment source', 'recruitment_source'],
  ['Recruiter', 'recruiter_name'], ['Interviewer', 'interviewer'], ['Application date', 'application_date', 'date'], ['Created', 'created_at', 'dt'], ['Modified', 'modified_at', 'dt'],
];

export default async function render(el, { id }) {
  const d = await get(`/candidates/${id}`);
  const c = d.candidate;
  el.innerHTML = '';
  const reload = () => render(el, { id });
  const nonCancelled = d.exams.filter((e) => e.status !== 'Cancelled' && e.counts_as_attempt);
  const active = d.exams.find((e) => ['Assigned', 'In Progress', 'Pending Approval'].includes(e.status));

  const statusSel = select('candidate_status', CANDIDATE_STATUSES, c.candidate_status, { style: 'width:auto', 'aria-label': 'Candidate status', disabled: !can('candidates') });
  statusSel.addEventListener('change', async () => {
    try { await put(`/candidates/${c.id}`, { candidate_status: statusSel.value }); toast('Status updated', 'success'); } catch (e) { toast(e.message, 'error'); statusSel.value = c.candidate_status; }
  });
  el.append(h('div', { class: 'page-head' },
    h('div', {}, h('a', { href: '#/candidates', class: 'small' }, '‹ Candidates'), h('h1', {}, c.full_name),
      h('p')),
    h('div', { class: 'btn-row' }, statusSel,
      can('candidates') ? h('button', { class: 'btn', onclick: () => candidateForm(c, reload) }, 'Edit') : null,
      can('exams') && !active ? h('button', { class: 'btn primary', onclick: () => assignDialog({ ...c, attempts: nonCancelled.length }, reload) }, nonCancelled.length ? 'Assign retake' : 'Assign exam') : null)));
  const sub = el.querySelector('.page-head p');
  sub.innerHTML = html`<span class="mono">${c.candidate_code}</span> · ${c.position_applied || 'No position'} &nbsp; ${badge(c.candidate_status)} ${badge(c.exam_status)}`.__raw;

  // Latest result summary
  if (c.total_percentage !== null || c.aptitude_percentage !== null) {
    el.append(h('div', { class: 'grid g4', style: 'margin-bottom:18px' },
      statBox('Aptitude', c.aptitude_score != null ? `${c.aptitude_score} / 20` : '—', fmt.pct(c.aptitude_percentage)),
      statBox('Communication', c.communication_score != null ? `${fmt.num(c.communication_score, 1)} / 100` : 'Pending', fmt.pct(c.communication_percentage)),
      statBox('Overall', fmt.pct(c.total_percentage), `Exam set ${c.selected_exam_set || '—'}`),
      statBox('Final status', c.final_status || '—', c.evaluator_comments || '')));
  }

  const prof = h('div', { class: 'kv' });
  for (const [label, key, type] of PROFILE) prof.append(h('div', {}, h('span', {}, label), h('b', {}, type === 'date' ? fmt.date(c[key]) : type === 'dt' ? fmt.dt(c[key]) : (c[key] ?? '—'))));
  el.append(h('div', { class: 'card' }, h('h3', {}, 'Candidate information'), prof));

  const skillMeta = { levels: d.skill_levels, categories: d.skill_categories, suggestions: d.skill_suggestions };
  el.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, `Skills (${d.skills.length})`),
    can('candidates') ? h('button', { class: 'btn sm', onclick: () => skillsDialog(c, d.skills, skillMeta, reload) }, 'Edit skills') : null),
    d.skills.length ? table([
      { label: 'Skill', render: (x) => html`<b>${x.skill}</b>${x.test_language ? html` <span class="badge info" title="Available as a programming test language">test: ${x.test_language}</span>` : ''}` },
      { label: 'Category', key: 'category' }, { label: 'Level', render: (x) => html`<span class="badge ${x.level === 'Expert' || x.level === 'Advanced' ? 'good' : ''}">${x.level}</span>` },
      { label: 'Years', num: true, render: (x) => (x.years ?? '—') }, { label: 'Source', render: (x) => (x.source === 'candidate' ? 'Candidate' : 'HR') },
      { label: 'Updated', render: (x) => fmt.dt(x.modified_at) },
    ], d.skills) : h('div', { class: 'empty' }, 'No skills recorded yet. Candidates are also asked for their skills before the exam.')));

  const actions = (e) => {
    const row = h('div', { class: 'btn-row' });
    const done = ['Submitted', 'Under Evaluation', 'Evaluated', 'Completed'].includes(e.status);
    if (done) row.append(h('a', { class: 'btn sm', href: `#/results/${e.id}` }, 'Result'));
    if (can('exams') && e.reschedule_options?.length && !e.pending_reschedule) row.append(h('button', { class: 'btn sm', onclick: () => rescheduleDialog(e, c, reload) }, 'Request reschedule'));
    if (e.pending_reschedule) row.append(h('a', { class: 'btn sm', href: '#/reschedules' }, `Reschedule pending (${e.pending_reschedule.request_code})`));
    if (done && can('evaluation') && !e.finalized) row.append(h('a', { class: 'btn sm primary', href: `#/evaluation/${e.id}` }, 'Evaluate'));
    if (!can('exams')) return row;
    const act = (label, fn, cls = '') => row.append(h('button', { class: `btn sm ${cls}`, onclick: fn }, label));
    if (e.status === 'Pending Approval' && session.user.role === 'admin') act('Approve retake', async () => { try { showCredentials(await post(`/exams/${e.id}/approve-retake`), 'Retake approved', { examId: e.id, candidateEmail: c.email, candidateName: c.first_name }); reload(); } catch (x) { toast(x.message, 'error'); } }, 'success');
    if (['Assigned', 'In Progress'].includes(e.status)) act('Email link', () => emailLinkDialog(e, c), 'primary');
    if (['Assigned', 'In Progress'].includes(e.status) || (e.status === 'Expired' && !e.started_at)) act('New link', async () => {
      if (!await confirmBox('Issue a new exam link?', 'The current link and access code stop working immediately. A new invitation email is sent.')) return;
      try { showCredentials(await post(`/exams/${e.id}/regenerate-link`), 'New exam link', { examId: e.id, candidateEmail: c.email, candidateName: c.first_name }); reload(); } catch (x) { toast(x.message, 'error'); }
    });
    if (e.status === 'In Progress') {
      act('Reset session', async () => {
        const mins = await confirmBox('Reset exam session', 'Ends the current browser session and lets the candidate resume once (even if resume is disabled). Answers are kept. Optionally extend the time:', { okText: 'Reset session', input: { label: 'Extra minutes (optional)', placeholder: '0' } });
        if (mins === null) return;
        try { await post(`/exams/${e.id}/reset-session`, { extendMinutes: Number(mins) || 0 }); toast('Session reset', 'success'); reload(); } catch (x) { toast(x.message, 'error'); }
      });
      act('Force submit', async () => {
        if (!await confirmBox('Submit this exam now?', 'The candidate’s saved answers will be submitted and locked.', { danger: true, okText: 'Submit exam' })) return;
        try { await post(`/exams/${e.id}/force-submit`); toast('Exam submitted', 'success'); reload(); } catch (x) { toast(x.message, 'error'); }
      }, 'danger');
    }
    if (['In Progress', 'Expired', 'Assigned'].includes(e.status) && (e.started_at || e.status === 'In Progress')) act('Reset exam', async () => {
      const reason = await confirmBox('Reset the whole exam?', 'All saved answers for this attempt are deleted and the candidate starts again with a new link and reshuffled paper.', { danger: true, okText: 'Reset exam', input: { label: 'Reason *', required: true } });
      if (!reason) return;
      try { showCredentials(await post(`/exams/${e.id}/reset`, { reason }), 'Exam reset – new link', { examId: e.id, candidateEmail: c.email, candidateName: c.first_name }); reload(); } catch (x) { toast(x.message, 'error'); }
    }, 'danger');
    if (['Pending Approval', 'Assigned', 'Expired'].includes(e.status)) act('Cancel', async () => {
      const reason = await confirmBox('Cancel this exam?', 'The link stops working and the attempt no longer counts toward the attempt limit.', { danger: true, okText: 'Cancel exam', input: { label: 'Reason', required: false } });
      if (reason === null) return;
      try { await post(`/exams/${e.id}/cancel`, { reason }); toast('Exam cancelled', 'success'); reload(); } catch (x) { toast(x.message, 'error'); }
    }, 'danger');
    return row;
  };
  el.append(h('div', { class: 'card' }, h('h3', {}, 'Examination history'),
    table([
      { label: 'Attempt', render: (e) => html`<b>#${e.attempt_number}</b><div class="muted small mono">${e.attempt_code}</div>` },
      { label: 'Exam ID', render: (e) => html`<span class="mono">${e.exam_code}</span><div class="muted small">${e.assignment_method}</div>` },
      { label: 'Set', render: (e) => html`${e.set_code || '—'}${e.programming_language ? html`<div class="muted small">${e.programming_language.toUpperCase()} set ${e.programming_set}</div>` : ''}<div class="muted small">${e.exam_type === 'APT-COMM-PRG' ? 'with programming' : ''}</div>` },
      { label: 'Status', render: (e) => html`${badge(e.status)}${!e.counts_as_attempt ? html`<div class="muted small" title="${e.void_reason || ''}">not counted</div>` : ''}${e.available_from && e.status === 'Assigned' ? html`<div class="muted small">opens ${fmt.dt(e.available_from)}</div>` : ''}` },
      { label: 'Assigned', render: (e) => html`${fmt.dt(e.assigned_at)}<div class="muted small">${e.status === 'Assigned' ? 'Expires ' + fmt.dt(e.link_expires_at) : ''}</div>` },
      { label: 'Started', render: (e) => fmt.dt(e.started_at) },
      { label: 'Submitted', render: (e) => html`${fmt.dt(e.submitted_at)}<div class="muted small">${e.submission_type === 'auto_timer' ? 'auto (timer)' : e.submission_type || ''}</div>` },
      { label: 'Tab sw.', num: true, key: 'tab_switch_count' },
      { label: 'Final', num: true, render: (e) => fmt.pct(e.final_score) },
      { label: 'Result', render: (e) => resultBadge(e) },
      { label: 'Actions', render: actions },
    ], d.exams, { empty: 'No examinations assigned yet.' }),
    d.exams.some((e) => e.retake_reason) ? h('p', { class: 'muted small' }, 'Retake reasons: ' + d.exams.filter((e) => e.retake_reason).map((e) => `#${e.attempt_number}: ${e.retake_reason}`).join(' · ')) : null));

  if (d.reschedules.length) {
    el.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Reschedule requests'), h('a', { href: '#/reschedules', class: 'small' }, 'All requests')), table([
      { label: 'Request', render: (x) => html`<span class="mono">${x.request_code}</span><div class="muted small">${fmt.dt(x.requested_at)} · ${x.requested_by_name || ''}</div>` },
      { label: 'Exam', key: 'exam_code' }, { label: 'Reason', render: (x) => html`${x.reason_label}<div class="muted small">${x.description.slice(0, 90)}</div>` },
      { label: 'Action', key: 'option_label' }, { label: 'Status', render: (x) => badge(x.status) },
      { label: 'Decision', render: (x) => html`${x.decided_by_name || '—'}<div class="muted small">${x.decision_notes || ''}${x.resulting_exam_code ? ` → ${x.resulting_exam_code}` : ''}</div>` },
    ], d.reschedules)));
  }
  const tl = h('ul', { class: 'timeline' });
  for (const a of d.audit.slice(0, 40)) {
    const cls = a.event.startsWith('SUSPICIOUS') ? 'warn' : /FAILED|BLOCKED|EXPIRED/.test(a.event) ? 'bad' : /SUBMITTED|FINALIZED|PASS/.test(a.event) ? 'good' : '';
    tl.append(h('li', { class: cls }, h('b', {}, a.event.replace(/_/g, ' ').toLowerCase()), ` · ${a.actor || 'system'} · `, h('span', { class: 'muted' }, fmt.dt(a.timestamp))));
  }
  el.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Activity'), can('audit.view') ? h('a', { href: `#/audit`, class: 'small' }, 'Full audit log') : null),
    d.audit.length ? tl : h('div', { class: 'empty' }, 'No activity yet.')));
  void navigate;
}
function statBox(label, value, sub) { return h('div', { class: 'stat' }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value), h('div', { class: 'sub' }, sub || '')); }
