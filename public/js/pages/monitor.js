import { get, post } from '../api.js';
import { h, html, fmt, badge, table, toast, confirmBox } from '../ui.js';
import { navigate, can } from '../app.js';

export default async function (el, params, { isCurrent }) {
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Exam Monitoring'),
    h('p', {}, 'Live view of assigned and in-progress examinations. Refreshes every 10 seconds. Integrity signals are indicators for review, not proof of misconduct.')),
    h('span', { class: 'muted small', id: 'mon-updated' })));
  const body = h('div'); el.append(body);
  async function load() {
    if (!isCurrent()) return;
    const d = await get('/monitor');
    const drift = Date.now() - new Date(d.server_time).getTime();
    body.innerHTML = '';
    const live = d.exams.filter((e) => e.status === 'In Progress');
    const waiting = d.exams.filter((e) => e.status !== 'In Progress');
    body.append(h('div', { class: 'card' }, h('h3', {}, `In progress (${live.length})`), table([
      { label: 'Candidate', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.candidate_code} · ${r.position_applied || ''}</div>` },
      { label: 'Exam', render: (r) => html`${r.exam_code}<div class="muted small">${r.set_code}</div>` },
      { label: 'Section', render: (r) => r.current_section || '—' },
      { label: 'Time left', render: (r) => html`<b class="mono ${r.remaining_seconds < 300 ? 'bad' : ''}">${fmt.hms(r.remaining_seconds)}</b>` },
      { label: 'Aptitude', num: true, render: (r) => `${r.apt_answered}/20` },
      { label: 'Written', num: true, render: (r) => `${r.com_answered}/10` },
      { label: 'Code', num: true, render: (r) => (r.prg_total ? html`${r.prg_answered}/${r.prg_total}<div class="muted small">${r.programming_language}</div>` : '—') },
      { label: 'Tab switches', num: true, render: (r) => html`<span class="badge ${r.tab_switch_count >= 3 ? 'bad' : r.tab_switch_count ? 'warn' : ''}">${r.tab_switch_count}</span>` },
      { label: 'Flags', num: true, key: 'suspicious_event_count' },
      { label: 'Resumes', num: true, key: 'resume_count' },
      { label: 'Last seen', render: (r) => (r.last_seen_at ? `${Math.max(0, Math.round((Date.now() - drift - new Date(r.last_seen_at)) / 1000))}s ago` : '—') },
      { label: 'Last autosave', render: (r) => fmt.dt(r.last_autosave_at) },
      { label: '', render: (r) => (can('exams') ? h('button', { class: 'btn sm danger', onclick: async () => {
        if (!await confirmBox('Force submit?', `Submit ${r.full_name}'s exam now with the answers saved so far?`, { danger: true, okText: 'Submit exam' })) return;
        try { await post(`/exams/${r.id}/force-submit`); toast('Submitted', 'success'); load(); } catch (e) { toast(e.message, 'error'); }
      } }, 'Force submit') : '') },
    ], live, { onRow: (r) => navigate(`candidates/${r.candidate_id}`), empty: 'No examinations in progress right now.' })));
    body.append(h('div', { class: 'card' }, h('h3', {}, `Assigned / awaiting action (${waiting.length})`), table([
      { label: 'Candidate', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.candidate_code}</div>` },
      { label: 'Exam', render: (r) => html`${r.exam_code}<div class="muted small">${r.set_code}</div>` },
      { label: 'Status', render: (r) => badge(r.status) }, { label: 'Assigned', render: (r) => fmt.dt(r.assigned_at) },
      { label: 'Opens', render: (r) => (r.available_from ? fmt.dt(r.available_from) : 'Now') },
      { label: 'Link expires', render: (r) => fmt.dt(r.link_expires_at) },
    ], waiting, { onRow: (r) => navigate(`candidates/${r.candidate_id}`), empty: 'Nothing waiting.' })));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Recent exam activity & integrity events'), table([
      { label: 'Time', render: (r) => fmt.dt(r.timestamp) },
      { label: 'Event', render: (r) => html`<span class="badge ${r.event.startsWith('SUSPICIOUS') ? 'warn' : r.event.includes('BLOCKED') ? 'bad' : 'info'}">${r.event.replace('SUSPICIOUS_', '').replace(/_/g, ' ')}</span>` },
      { label: 'Candidate', render: (r) => html`${r.full_name || '—'}<div class="muted small">${r.candidate_code || ''}</div>` },
      { label: 'Exam', key: 'exam_code' }, { label: 'IP', key: 'ip_address' },
    ], d.events, { empty: 'No events yet.' })));
    const u = document.getElementById('mon-updated'); if (u) u.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  }
  await load();
  const t = setInterval(() => { if (!isCurrent()) { clearInterval(t); return; } load().catch(() => {}); }, 10000);
}
