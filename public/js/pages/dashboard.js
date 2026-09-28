import { get } from '../api.js';
import { h, html, render, fmt, badge, resultBadge, table, bars } from '../ui.js';
import { navigate } from '../app.js';

export default async function (el) {
  const d = await get('/dashboard');
  const s = d.stats; const sc = d.scores;
  const stat = (label, value, sub, href) => {
    const card = h('div', { class: 'stat', style: href ? 'cursor:pointer' : '' }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value ?? '—'), sub ? h('div', { class: 'sub' }, sub) : null);
    if (href) card.addEventListener('click', () => navigate(href));
    return card;
  };
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Dashboard'), h('p', {}, 'Candidate pipeline, examination activity and score statistics.'))));
  el.append(h('h3', {}, 'Candidate statistics'));
  el.append(h('div', { class: 'grid g6', style: 'margin-bottom:18px' },
    stat('Total candidates', s.total_candidates, null, 'candidates'),
    stat('Exams assigned', s.exams_assigned, `${s.exams_awaiting_start} awaiting start`, 'monitor'),
    stat('Exams started', s.exams_started, `${s.exams_in_progress} in progress now`, 'monitor'),
    stat('Exams completed', s.exams_completed, null, 'results'),
    stat('Passed', s.passed, 'finalised results', 'results'),
    stat('Failed', s.failed, 'finalised results', 'results')));
  el.append(h('div', { class: 'grid g5', style: 'margin-bottom:18px' },
    stat('Pending evaluation', s.pending_evaluation, 'submitted, not finalised', 'evaluation'),
    stat('Pending retake approval', s.pending_approval, null, 'assign'),
    stat('Pending reschedules', s.pending_reschedules, 'awaiting Admin decision', 'reschedules'),
    stat('Expired links', s.expired, null, 'monitor'),
    stat('Backend sync', d.sync.backend === 'none' ? 'Off' : d.sync.backend === 'google_sheets' ? 'Google Sheets' : 'SharePoint',
      d.sync.backend === 'none' ? 'Local database only' : `${d.sync.counts.pending || 0} pending · ${d.sync.counts.failed || 0} failed`, 'settings')));
  el.append(h('h3', {}, 'Score statistics'));
  el.append(h('div', { class: 'grid g6', style: 'margin-bottom:18px' },
    stat('Avg aptitude', sc.avg_aptitude_score != null ? `${fmt.num(sc.avg_aptitude_score, 1)}/20` : '—', fmt.pct(sc.avg_aptitude_pct)),
    stat('Avg communication', sc.avg_communication_score != null ? `${fmt.num(sc.avg_communication_score, 1)}/100` : '—', fmt.pct(sc.avg_communication_pct)),
    stat('Avg final score', fmt.pct(sc.avg_final)),
    stat('Highest score', fmt.pct(sc.highest)),
    stat('Lowest score', fmt.pct(sc.lowest)),
    stat('Pass rate', s.passed + s.failed ? fmt.pct(Math.round(s.passed / (s.passed + s.failed) * 1000) / 10) : '—', 'of finalised results')));

  const usage = h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Exam set usage'), h('a', { href: '#/questions' }, 'Manage sets')),
    bars(d.set_usage, { label: (x) => `${x.code}${x.active ? '' : ' (inactive)'}`, value: (x) => x.used, format: (v) => `${v} used`,
      title: (x) => `${x.code}: ${x.used} assigned, ${x.completed} completed${x.last_used_at ? `, last used ${fmt.dt(x.last_used_at)}` : ''}` }));
  const cat = h('div', { class: 'card' }, h('h3', {}, 'Aptitude accuracy by category'),
    d.by_category.length ? bars(d.by_category, { label: (x) => x.category, value: (x) => x.pct, max: 100, format: (v) => `${v}%`, title: (x) => `${x.category}: ${x.correct}/${x.total} correct (${x.pct}%)` })
      : h('div', { class: 'empty' }, 'No scored attempts yet.'));
  el.append(h('div', { class: 'grid g2' }, usage, cat));
  if (d.by_language?.length) el.append(h('div', { class: 'card' }, h('h3', {}, `Programming – average score by language${sc.avg_programming_pct != null ? ` (overall ${fmt.pct(sc.avg_programming_pct)})` : ''}`),
    bars(d.by_language, { label: (x) => x.language, value: (x) => x.avg_pct, max: 100, format: (v) => `${v}%`, title: (x) => `${x.language}: ${x.avg_pct}% average over ${x.n} result(s)` })));

  const recent = h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, 'Recent examination activity'), h('a', { href: '#/results' }, 'All results')),
    table([
      { label: 'Candidate', render: (r) => html`<b>${r.full_name}</b><div class="muted small">${r.candidate_code} · ${r.position_applied || ''}</div>` },
      { label: 'Exam', render: (r) => html`${r.exam_code}<div class="muted small">${r.set_code || ''}</div>` },
      { label: 'Status', render: (r) => badge(r.status) },
      { label: 'Final score', num: true, render: (r) => fmt.pct(r.final_score) },
      { label: 'Result', render: (r) => resultBadge(r) },
      { label: 'Submitted', render: (r) => fmt.dt(r.submitted_at) },
    ], d.recent, { onRow: (r) => navigate(['Submitted', 'Under Evaluation', 'Evaluated', 'Completed'].includes(r.status) ? `results/${r.id}` : 'monitor'), empty: 'No exams yet — create a candidate and assign an exam to get started.' }));
  el.append(recent);
  void render;
}
