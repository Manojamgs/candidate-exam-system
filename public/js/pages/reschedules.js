import { get, post, qs } from '../api.js';
import { h, html, fmt, badge, table, toast, modal, field, select, downloadUrl } from '../ui.js';
import { navigate, session } from '../app.js';
import { showCredentials, toLocalInput, fromLocalInput } from '../shared.js';

export default async function render(el) {
  el.innerHTML = '';
  const isAdmin = session.user.role === 'admin';
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Reschedule Requests'),
    h('p', {}, 'Technical-issue requests raised by HR, with system diagnostics. Admins approve or reject; every decision is audit-logged and nothing is deleted.')),
    h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/reschedules?format=xlsx') }, 'Export Excel')));
  const status = select('status', [['Pending', 'Pending'], ['', 'All'], ['Approved', 'Approved'], ['Rejected', 'Rejected'], ['Withdrawn', 'Withdrawn']], 'Pending');
  const q = h('input', { type: 'search', placeholder: 'Candidate, exam or request ID' });
  const f = h('form', { class: 'filters card', style: 'padding:14px' });
  const g = field('Search', q); g.classList.add('grow');
  f.append(g, field('Status', status), h('button', { class: 'btn primary' }, 'Filter'));
  const out = h('div');
  el.append(f, out);
  f.addEventListener('submit', (e) => { e.preventDefault(); load(); });
  status.addEventListener('change', load);
  async function load() {
    const d = await get('/reschedules' + qs({ status: status.value, q: q.value }));
    out.innerHTML = '';
    out.append(table([
      { label: 'Request', render: (x) => html`<b class="mono">${x.request_code}</b><div class="muted small">${fmt.dt(x.requested_at)}</div>` },
      { label: 'Candidate', render: (x) => html`<b>${x.full_name}</b><div class="muted small">${x.candidate_code}</div>` },
      { label: 'Exam', render: (x) => html`${x.exam_code}<div class="muted small">${x.set_code || ''} · attempt ${x.attempt_number} · ${x.exam_status}</div>` },
      { label: 'Reason', render: (x) => html`<b>${x.reason_label}</b><div class="muted small">${x.description.slice(0, 100)}${x.description.length > 100 ? '…' : ''}</div>` },
      { label: 'Requested action', render: (x) => html`${x.option_label}${x.extra_minutes ? html`<div class="muted small">+${x.extra_minutes} min</div>` : ''}${x.proposed_start ? html`<div class="muted small">opens ${fmt.dt(x.proposed_start)}</div>` : ''}` },
      { label: 'Evidence', render: (x) => { const e = x.system_evidence || {}; return html`<span class="small">${e.connection_lost_events ?? 0} disconnects · ${e.resume_count ?? 0} resumes · ${e.answered?.answered ?? 0}/${e.answered?.total ?? 0} answered</span>`; } },
      { label: 'Requested by', key: 'requested_by_name' },
      { label: 'Status', render: (x) => html`${badge(x.status)}${x.decided_by_name ? html`<div class="muted small">${x.decided_by_name}</div>` : ''}` },
      { label: '', render: (x) => h('button', { class: `btn sm ${x.status === 'Pending' && isAdmin ? 'primary' : ''}`, onclick: () => detail(x) }, x.status === 'Pending' && isAdmin ? 'Review' : 'View') },
    ], d.rows, { empty: status.value === 'Pending' ? 'No pending requests.' : 'No requests found.' }));
  }
  function detail(x) {
    const e = x.system_evidence || {};
    const kv = (pairs) => h('div', { class: 'kv' }, pairs.map(([k, v]) => h('div', {}, h('span', {}, k), h('b', {}, v ?? '—'))));
    const body = h('div', {},
      kv([['Candidate', `${x.full_name} (${x.candidate_code})`], ['Exam', `${x.exam_code} · ${x.set_code || ''} · attempt ${x.attempt_number}`], ['Exam status now', x.exam_status],
        ['Reason', x.reason_label], ['Incident time', fmt.dt(x.incident_at)], ['Requested by', `${x.requested_by_name || '—'} · ${fmt.dt(x.requested_at)}`],
        ['Requested action', x.option_label], ['Extra minutes', x.extra_minutes ?? '—'], ['Proposed window', x.proposed_start ? `${fmt.dt(x.proposed_start)} → ${fmt.dt(x.proposed_expiry)}` : 'Immediately / default']]),
      h('h3', { style: 'margin-top:14px' }, 'Description'), h('div', { class: 'answer-text' }, x.description),
      x.evidence_notes ? h('div', { class: 'small', style: 'margin-top:6px' }, h('b', {}, 'Evidence / reference: '), x.evidence_notes) : null,
      h('h3', { style: 'margin-top:14px' }, 'System diagnostics (captured at request time)'),
      kv([['Started', fmt.dt(e.started_at)], ['Deadline', fmt.dt(e.deadline_at)], ['Submitted', `${fmt.dt(e.submitted_at)}${e.submission_type ? ` (${e.submission_type})` : ''}`],
        ['Last autosave', fmt.dt(e.last_autosave_at)], ['Connection losses', e.connection_lost_events], ['Resumes / logins', `${e.resume_count ?? 0} / ${e.logins ?? 0}`],
        ['Distinct IPs', e.distinct_ips], ['Tab switches', e.tab_switch_count], ['Answers saved', e.answered ? `${e.answered.answered} of ${e.answered.total}` : '—'],
        ['Previous approved reschedules', e.prior_reschedules]]),
      e.timeline?.length ? h('details', { style: 'margin-top:8px' }, h('summary', { class: 'small' }, `Session timeline (${e.timeline.length} events)`),
        h('ul', { class: 'timeline' }, e.timeline.map((t) => h('li', { class: /LOST/.test(t.event) ? 'bad' : '' }, `${t.event.replace(/_/g, ' ').toLowerCase()} · ${fmt.dt(t.at)}`)))) : null,
      x.status !== 'Pending' ? h('div', { class: `callout ${x.status === 'Approved' ? 'good' : 'info'}`, style: 'margin-top:12px' },
        `${x.status} by ${x.decided_by_name || '—'} on ${fmt.dt(x.decided_at)}. ${x.decision_notes || ''}${x.resulting_exam_code ? ` New exam: ${x.resulting_exam_code}.` : ''}`) : null);
    const m = modal({ title: `Reschedule request ${x.request_code}`, body, size: 'wide' });
    m.foot.append(h('a', { class: 'btn', href: `#/candidates/${x.candidate_id}`, onclick: () => m.close() }, 'Open candidate'));
    if (x.status === 'Pending') {
      m.foot.append(h('button', { class: 'btn', onclick: async () => { try { await post(`/reschedules/${x.id}/withdraw`); m.close(); toast('Request withdrawn', 'success'); load(); } catch (er) { toast(er.message, 'error'); } } }, 'Withdraw'));
      if (isAdmin) {
        const notes = h('textarea', { rows: 2, placeholder: 'Decision notes (required to reject)' });
        const extra = h('input', { type: 'number', min: 0, max: 180, value: x.extra_minutes ?? 15 });
        const start = h('input', { type: 'datetime-local', value: toLocalInput(x.proposed_start) });
        const exp = h('input', { type: 'datetime-local', value: toLocalInput(x.proposed_expiry) });
        const override = h('input', { type: 'checkbox' });
        body.append(h('fieldset', { style: 'margin-top:14px' }, h('legend', {}, 'Admin decision'),
          x.requested_option === 'resume_extra_time' ? field('Extra minutes to grant', extra) : h('div', { class: 'form-grid' }, field('Exam opens at', start, 'Empty = immediately'), field('Link expires', exp, 'Empty = default')),
          field('Notes', notes), (e.prior_reschedules ?? 0) > 0 ? h('label', { class: 'check' }, override, 'Override the reschedule limit if it has been reached') : null));
        m.foot.append(
          h('button', { class: 'btn danger', onclick: async () => {
            if (notes.value.trim().length < 5) { toast('Enter a reason to reject the request', 'error'); notes.focus(); return; }
            try { await post(`/reschedules/${x.id}/reject`, { decision_notes: notes.value }); m.close(); toast('Request rejected', 'success'); load(); } catch (er) { toast(er.message, 'error', 7000); }
          } }, 'Reject'),
          h('button', { class: 'btn success', onclick: async () => {
            const b = { decision_notes: notes.value, override_limit: override.checked };
            if (x.requested_option === 'resume_extra_time') b.extra_minutes = Number(extra.value);
            else { b.proposed_start = fromLocalInput(start.value); b.proposed_expiry = fromLocalInput(exp.value) || undefined; }
            try {
              const r = await post(`/reschedules/${x.id}/approve`, b);
              m.close(); load();
              if (r.outcome.link) showCredentials({ link: r.outcome.link, access_code: r.outcome.access_code, expires_at: r.outcome.expires_at, available_from: r.outcome.available_from },
                r.outcome.new_exam_code ? `Approved – new exam ${r.outcome.new_exam_code} (${r.outcome.exam_set})` : 'Approved – new exam link',
                { examId: r.outcome.new_exam_id || x.exam_id, candidateEmail: x.email, candidateName: x.full_name });
              else toast(`Approved – candidate can resume${r.outcome.extra_minutes ? ` with ${r.outcome.extra_minutes} extra minutes` : ''}`, 'success', 6000);
            } catch (er) { toast(er.message, 'error', 8000); }
          } }, 'Approve'));
      }
    }
    m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Close'));
  }
  await load();
  void navigate;
}
