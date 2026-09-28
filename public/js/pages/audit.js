import { get, qs } from '../api.js';
import { h, html, field, select, table, fmt, downloadUrl } from '../ui.js';

export default async function (el) {
  let offset = 0; const limit = 100;
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Audit Log'), h('p', {}, 'Immutable record of candidate, examination, evaluation and administrative activity.')),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/audit?format=xlsx') }, 'Export Excel'), h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/audit?format=csv') }, 'Export CSV'))));
  const q = h('input', { type: 'search', placeholder: 'Event, actor, candidate ID, exam ID or details' });
  const ev = select('event', [['', 'All events']], '');
  const df = h('input', { type: 'date' }); const dt = h('input', { type: 'date' });
  const form = h('form', { class: 'filters card', style: 'padding:14px' });
  const g = field('Search', q); g.classList.add('grow');
  form.append(g, field('Event', ev), field('From', df), field('To', dt), h('button', { class: 'btn primary' }, 'Search'));
  const out = h('div');
  el.append(form, out);
  form.addEventListener('submit', (e) => { e.preventDefault(); offset = 0; load(); });
  ev.addEventListener('change', () => { offset = 0; load(); });
  let eventsLoaded = false;
  async function load() {
    const d = await get('/audit' + qs({ q: q.value, event: ev.value, date_from: df.value, date_to: dt.value, limit, offset }));
    if (!eventsLoaded) { for (const e of d.events) ev.append(h('option', { value: e }, e)); eventsLoaded = true; }
    out.innerHTML = '';
    out.append(table([
      { label: 'Log ID', render: (r) => html`<span class="mono small">${r.log_code}</span>` },
      { label: 'Timestamp', render: (r) => html`<span class="nowrap">${fmt.dt(r.timestamp)}</span>` },
      { label: 'Event', render: (r) => html`<span class="badge ${r.event.startsWith('SUSPICIOUS') ? 'warn' : /FAIL|BLOCK|EXPIRED/.test(r.event) ? 'bad' : 'info'}">${r.event}</span>` },
      { label: 'Actor', key: 'actor' },
      { label: 'Candidate', render: (r) => (r.candidate_code ? html`<a href="#/candidates/${r.candidate_id}">${r.candidate_code}</a><div class="muted small">${r.full_name}</div>` : '—') },
      { label: 'Exam', key: 'exam_code' }, { label: 'IP', key: 'ip_address' },
      { label: 'Details', render: (r) => html`<span class="mono small" title="${r.browser || ''}">${(r.details || '').slice(0, 220)}</span>` },
    ], d.rows));
    out.append(h('div', { class: 'pager' }, h('span', {}, `${d.total ? offset + 1 : 0}–${Math.min(d.total, offset + limit)} of ${d.total}`),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn sm', disabled: offset === 0, onclick: () => { offset -= limit; load(); } }, '‹ Newer'),
        h('button', { class: 'btn sm', disabled: offset + limit >= d.total, onclick: () => { offset += limit; load(); } }, 'Older ›'))));
  }
  await load();
}
