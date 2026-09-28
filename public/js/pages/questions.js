import { get, post, put, del, qs } from '../api.js';
import { h, html, table, field, select, modal, toast, confirmBox, formData, downloadUrl } from '../ui.js';

export default async function render(el) {
  el.innerHTML = '';
  const [sets, meta] = await Promise.all([get('/exam-sets'), get('/questions/aptitude?active=9')]);
  const reload = () => render(el);
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Question Bank – Aptitude'), h('p', {}, 'Multiple-choice questions by exam set, category and difficulty. Answer keys are visible to staff only.')),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/questions?format=xlsx') }, 'Export with answer key'),
      h('button', { class: 'btn', onclick: () => setDialog(null, reload) }, '+ New exam set'),
      h('button', { class: 'btn primary', onclick: () => editDialog({}, sets, meta, load) }, '+ New question'))));

  el.append(h('div', { class: 'card' }, h('h3', {}, 'Exam sets'), table([
    { label: 'Set', render: (s) => html`<b>${s.code}</b> <span class="muted">${s.name}</span>` },
    { label: 'Aptitude', num: true, render: (s) => `${s.readiness.aptitude}/${s.readiness.required.mcq}` },
    { label: 'Communication', num: true, render: (s) => `${s.readiness.communication}/${s.readiness.required.written}` },
    { label: 'State', render: (s) => html`<span class="badge ${!s.active ? '' : s.readiness.ready ? 'good' : 'warn'}">${!s.active ? 'Inactive' : s.readiness.ready ? 'Ready' : 'Incomplete'}</span>` },
    { label: 'Used', num: true, key: 'used' },
    { label: '', render: (s) => h('div', { class: 'btn-row' }, h('button', { class: 'btn sm', onclick: () => setDialog(s, reload) }, 'Edit'),
      h('button', { class: 'btn sm', onclick: async () => { try { await put(`/exam-sets/${s.id}`, { active: !s.active }); reload(); } catch (e) { toast(e.message, 'error'); } } }, s.active ? 'Deactivate' : 'Activate')) },
  ], sets)));

  const f = { exam_set: select('exam_set', [['', 'All sets'], ...sets.map((s) => s.code)], ''), category: select('category', [['', 'All categories'], ...meta.categories], ''),
    difficulty: select('difficulty', [['', 'All'], ...meta.difficulties], ''), active: select('active', [['', 'All'], ['1', 'Active'], ['0', 'Inactive']], ''),
    q: h('input', { type: 'search', placeholder: 'Text, code or topic' }) };
  const form = h('form', { class: 'filters' });
  const g = field('Search', f.q); g.classList.add('grow');
  form.append(g, field('Exam set', f.exam_set), field('Category', f.category), field('Difficulty', f.difficulty), field('Active', f.active), h('button', { class: 'btn primary' }, 'Filter'));
  const out = h('div');
  el.append(h('div', { class: 'card' }, form, out));
  form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
  Object.values(f).forEach((x) => x.tagName === 'SELECT' && x.addEventListener('change', load));
  async function load() {
    const d = await get('/questions/aptitude' + qs(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value]))));
    out.innerHTML = '';
    out.append(h('p', { class: 'muted small' }, `${d.rows.length} question(s)`), table([
      { label: 'Code', render: (q) => html`<span class="mono">${q.code}</span><div class="muted small">${q.set_code || 'Unassigned'}</div>` },
      { label: 'Question', render: (q) => html`${q.question.length > 140 ? q.question.slice(0, 140) + '…' : q.question}${q.table ? html`<div class="muted small">+ data table</div>` : ''}` },
      { label: 'Category', render: (q) => html`${q.category}<div class="muted small">${q.topic || ''}</div>` },
      { label: 'Difficulty', render: (q) => html`<span class="badge ${q.difficulty === 'Hard' ? 'bad' : q.difficulty === 'Medium' ? 'warn' : 'good'}">${q.difficulty}</span>` },
      { label: 'Answer', render: (q) => html`<b>${q.correct_answer}</b>` }, { label: 'Marks', num: true, key: 'marks' },
      { label: 'Used', num: true, key: 'times_used' },
      { label: 'Active', render: (q) => html`<span class="badge ${q.active ? 'good' : ''}">${q.active ? 'Active' : 'Inactive'}</span>` },
      { label: '', render: (q) => h('div', { class: 'btn-row' },
        h('button', { class: 'btn sm', onclick: () => preview(q) }, 'Preview'),
        h('button', { class: 'btn sm', onclick: () => editDialog(q, sets, meta, load) }, 'Edit'),
        h('button', { class: 'btn sm danger', onclick: async () => {
          if (!await confirmBox('Delete question?', `${q.code}: questions that appear in any exam attempt are deactivated instead of deleted.`, { danger: true, okText: 'Delete' })) return;
          try { const r = await del(`/questions/aptitude/${q.id}`); toast(r.message || 'Question deleted', 'success'); load(); } catch (e) { toast(e.message, 'error'); }
        } }, 'Delete')) },
    ], d.rows));
  }
  await load();
}

function tableEl(t) {
  if (!t) return null;
  return h('table', { class: 'q-table' }, h('thead', {}, h('tr', {}, t.headers.map((x) => h('th', {}, x)))), h('tbody', {}, t.rows.map((r) => h('tr', {}, r.map((x) => h('td', {}, x))))));
}
function preview(q) {
  const body = h('div', {}, h('p', { class: 'muted small' }, `${q.code} · ${q.set_code || ''} · ${q.category} · ${q.difficulty} · ${q.marks} mark(s)`),
    h('p', { style: 'font-size:15px' }, q.question), tableEl(q.table),
    h('ol', { type: 'A' }, ['a', 'b', 'c', 'd'].map((k) => h('li', { style: q.correct_answer.toLowerCase() === k ? 'font-weight:700;color:var(--good)' : '' }, q['option_' + k]))),
    h('div', { class: 'callout info' }, h('b', {}, `Answer: ${q.correct_answer}. `), q.explanation || ''),
    h('p', { class: 'muted small' }, 'Options are shuffled for each candidate at assignment time.'));
  const m = modal({ title: 'Question preview', body }); m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Close'));
}

function editDialog(q, sets, meta, onSaved) {
  const form = h('form', { class: 'form-grid' });
  const tableTxt = h('textarea', { name: 'table_text', rows: 4, placeholder: 'Optional data table – first line headers, comma-separated. E.g.\nRegion,Q1,Q2\nNorth,120,140' });
  if (q.table) tableTxt.value = [q.table.headers.join(','), ...q.table.rows.map((r) => r.join(','))].join('\n');
  const correct = select('correct_answer', ['A', 'B', 'C', 'D'], q.correct_answer || 'A');
  const active = h('input', { type: 'checkbox', name: 'active' }); active.checked = q.id ? !!q.active : true;
  const full = (x) => { x.classList.add('full'); return x; };
  form.append(
    field('Exam set', select('exam_set_id', [['', 'Unassigned'], ...sets.map((s) => [s.id, s.code])], q.exam_set_id)),
    field('Category *', select('category', meta.categories, q.category || meta.categories[0])),
    field('Topic', h('input', { type: 'text', name: 'topic', value: q.topic || '', placeholder: 'e.g. Percentage' })),
    field('Difficulty *', select('difficulty', meta.difficulties, q.difficulty || 'Medium')),
    full(field('Question *', h('textarea', { name: 'question', rows: 3, required: true }, q.question || ''))),
    full(field('Data table (optional)', tableTxt)),
    ...['a', 'b', 'c', 'd'].map((k) => field(`Option ${k.toUpperCase()} *`, h('input', { type: 'text', name: `option_${k}`, value: q[`option_${k}`] || '' }))),
    field('Correct answer *', correct), field('Marks', h('input', { type: 'number', name: 'marks', min: 0.5, step: 0.5, value: q.marks ?? 1 })),
    full(field('Explanation', h('textarea', { name: 'explanation', rows: 2 }, q.explanation || ''))),
    full(h('label', { class: 'check' }, active, 'Active (validated before activation)')));
  const m = modal({ title: q.id ? `Edit ${q.code}` : 'New aptitude question', body: form, size: 'wide' });
  const save = h('button', { class: 'btn primary' }, 'Save question');
  save.addEventListener('click', async () => {
    const d = formData(form);
    const opts = ['a', 'b', 'c', 'd'].map((k) => d[`option_${k}`].trim());
    if (d.active) {
      const errs = [];
      if (!d.question.trim()) errs.push('question text');
      if (opts.some((o) => !o)) errs.push('all four options');
      if (new Set(opts.map((o) => o.toLowerCase())).size < 4) errs.push('distinct options');
      if (errs.length) { toast(`Cannot activate: ${errs.join(', ')} required. Save as inactive to keep a draft.`, 'error', 6000); return; }
    }
    let table = null;
    if (d.table_text.trim()) {
      const lines = d.table_text.trim().split('\n').map((l) => l.split(',').map((x) => x.trim()));
      table = { headers: lines[0], rows: lines.slice(1) };
    }
    const body = { ...d, table, exam_set_id: d.exam_set_id ? Number(d.exam_set_id) : null }; delete body.table_text;
    try { const r = q.id ? await put(`/questions/aptitude/${q.id}`, body) : await post('/questions/aptitude', body); m.close(); toast(`${r.code} saved`, 'success'); onSaved(); } catch (e) { toast(e.message, 'error', 7000); }
  });
  m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), save);
}

export function setDialog(s, onSaved) {
  const form = h('form', {}, s ? null : field('Code', h('input', { type: 'text', name: 'code', placeholder: 'Leave blank for next (e.g. SET-07)' })),
    field('Name', h('input', { type: 'text', name: 'name', value: s?.name || '' })), field('Description', h('textarea', { name: 'description', rows: 2 }, s?.description || '')));
  const m = modal({ title: s ? `Edit ${s.code}` : 'New exam set', body: form, size: 'narrow' });
  m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
    try { const d = formData(form); s ? await put(`/exam-sets/${s.id}`, d) : await post('/exam-sets', d); m.close(); toast('Exam set saved. Add 20 aptitude + 10 communication questions to make it assignable.', 'success', 6000); onSaved(); } catch (e) { toast(e.message, 'error'); }
  } }, 'Save'));
}
