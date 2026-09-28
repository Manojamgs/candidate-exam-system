import { get, post, put, del, qs } from '../api.js';
import { h, html, table, field, select, modal, toast, confirmBox, formData, downloadUrl } from '../ui.js';

const TT = { write_code: 'Write code', fix_bug: 'Fix bug', explain_output: 'Explain output', complete_code: 'Complete code' };
export default async function render(el) {
  el.innerHTML = '';
  const meta = await get('/programming/questions?language=__none__');
  const langs = meta.languages;
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Programming Question Bank'),
    h('p', {}, 'Language-specific programming-basics questions: 5 sets × 10 per language, AI-evaluated against the reference solution and evaluation points (never shown to candidates).')),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/programming_questions?format=xlsx') }, 'Export with reference solutions'),
      h('button', { class: 'btn', onclick: () => langDialog(() => render(el)) }, '+ Language'),
      h('button', { class: 'btn primary', onclick: () => edit({}, langs, load) }, '+ New question'))));
  el.append(h('div', { class: 'card' }, h('h3', {}, 'Languages & sets'), table([
    { label: 'Language', render: (l) => html`<b>${l.label}</b> <span class="muted mono">${l.key}</span>` },
    { label: 'Active questions', num: true, key: 'active_questions' },
    { label: 'Sets (ready / used)', render: (l) => html`${l.sets.map((s) => html`<span class="badge ${s.ready ? 'good' : 'warn'}" title="${s.active}/${s.questions} active · used ${s.used}×" style="margin:1px">S${s.set_number}·${s.used}</span>`)}` },
    { label: 'State', render: (l) => html`<span class="badge ${l.active ? 'good' : ''}">${l.active ? 'Active' : 'Inactive'}</span>` },
    { label: '', render: (l) => h('button', { class: 'btn sm', onclick: async () => { try { await post('/programming/languages', { key: l.key, label: l.label, active: !l.active }); render(el); } catch (e) { toast(e.message, 'error'); } } }, l.active ? 'Deactivate' : 'Activate') },
  ], langs)));
  const f = { language: select('language', [['', 'All languages'], ...langs.map((l) => [l.key, l.label])], ''), set_number: select('set_number', [['', 'All sets'], 1, 2, 3, 4, 5, 6, 7, 8].map((x) => (Array.isArray(x) ? x : [x, `Set ${x}`])), ''),
    difficulty: select('difficulty', [['', 'All'], 'Easy', 'Medium', 'Hard'], ''), task_type: select('task_type', [['', 'All'], ...Object.entries(TT)], ''),
    active: select('active', [['', 'All'], ['1', 'Active'], ['0', 'Inactive']], ''), q: h('input', { type: 'search', placeholder: 'Text, code or topic' }) };
  const form = h('form', { class: 'filters' });
  const g = field('Search', f.q); g.classList.add('grow');
  form.append(g, field('Language', f.language), field('Set', f.set_number), field('Difficulty', f.difficulty), field('Task', f.task_type), field('Active', f.active), h('button', { class: 'btn primary' }, 'Filter'));
  const out = h('div');
  el.append(h('div', { class: 'card' }, form, out));
  form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
  Object.values(f).forEach((x) => x.tagName === 'SELECT' && x.addEventListener('change', load));
  async function load() {
    const d = await get('/programming/questions' + qs(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value]))));
    out.innerHTML = '';
    out.append(h('p', { class: 'muted small' }, `${d.rows.length} question(s)`), table([
      { label: 'Code', render: (q) => html`<span class="mono">${q.code}</span><div class="muted small">${q.language_label} · set ${q.set_number}</div>` },
      { label: 'Question', render: (q) => html`${q.question.length > 150 ? q.question.slice(0, 150) + '…' : q.question}` },
      { label: 'Topic / type', render: (q) => html`${q.topic || '—'}<div class="muted small">${TT[q.task_type]}</div>` },
      { label: 'Difficulty', render: (q) => html`<span class="badge ${q.difficulty === 'Hard' ? 'bad' : q.difficulty === 'Medium' ? 'warn' : 'good'}">${q.difficulty}</span>` },
      { label: 'Min', num: true, key: 'expected_minutes' }, { label: 'Used', num: true, key: 'times_used' },
      { label: 'Active', render: (q) => html`<span class="badge ${q.active ? 'good' : ''}">${q.active ? 'Active' : 'Inactive'}</span>` },
      { label: '', render: (q) => h('div', { class: 'btn-row' }, h('button', { class: 'btn sm', onclick: () => preview(q) }, 'Preview'), h('button', { class: 'btn sm', onclick: () => edit(q, langs, load) }, 'Edit'),
        h('button', { class: 'btn sm danger', onclick: async () => {
          if (!await confirmBox('Delete question?', `${q.code}: questions used in any attempt are deactivated instead.`, { danger: true, okText: 'Delete' })) return;
          try { const r = await del(`/programming/questions/${q.id}`); toast(r.message || 'Deleted', 'success'); load(); } catch (e) { toast(e.message, 'error'); }
        } }, 'Delete')) },
    ], d.rows));
  }
  await load();
}
function preview(q) {
  const body = h('div', {}, h('p', { class: 'muted small' }, `${q.code} · ${q.language_label} set ${q.set_number} · ${TT[q.task_type]} · ${q.difficulty} · ${q.marks} marks · ~${q.expected_minutes} min`),
    h('p', { style: 'font-size:15px;white-space:pre-wrap' }, q.question),
    q.starter_code ? h('pre', { class: 'answer-text mono', style: 'background:#0f172a;color:#e2e8f0' }, q.starter_code) : null,
    h('h3', {}, 'Reference solution (staff only)'), h('pre', { class: 'answer-text mono' }, q.reference_solution),
    h('h3', {}, 'Evaluation points'), h('ul', {}, q.evaluation_points.map((p) => h('li', {}, p))),
    q.test_cases.length ? h('div', {}, h('h3', {}, 'Test cases'), h('ul', { class: 'small mono' }, q.test_cases.map((t) => h('li', {}, `${t.input} ⇒ ${t.expected}`)))) : null);
  const m = modal({ title: 'Question preview', body, size: 'wide' }); m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Close'));
}
function edit(q, langs, onSaved) {
  const active = h('input', { type: 'checkbox', name: 'active' }); active.checked = q.id ? !!q.active : true;
  const mono = { class: 'mono', spellcheck: 'false' };
  const form = h('form', { class: 'form-grid' },
    field('Language *', select('language', langs.map((l) => [l.key, l.label]), q.language || langs[0]?.key)),
    field('Set number *', h('input', { type: 'number', name: 'set_number', min: 1, value: q.set_number || 1 })),
    field('Task type *', select('task_type', Object.entries(TT), q.task_type || 'write_code')),
    field('Difficulty *', select('difficulty', ['Easy', 'Medium', 'Hard'], q.difficulty || 'Medium')),
    field('Topic', h('input', { type: 'text', name: 'topic', value: q.topic || '' })),
    field('Expected minutes', h('input', { type: 'number', name: 'expected_minutes', min: 1, max: 30, value: q.expected_minutes || 4 })),
    field('Marks', h('input', { type: 'number', name: 'marks', min: 1, value: q.marks ?? 10 })));
  const full = (x) => { x.classList.add('full'); return x; };
  form.append(
    full(field('Question *', h('textarea', { name: 'question', rows: 3 }, q.question || ''))),
    full(field('Starter / given code', h('textarea', { name: 'starter_code', rows: 6, ...mono }, q.starter_code || ''), 'Required for fix-bug, explain-output and complete-code tasks.')),
    full(field('Reference solution * (never shown to candidates)', h('textarea', { name: 'reference_solution', rows: 6, ...mono }, q.reference_solution || ''))),
    full(field('Evaluation points * (one per line, at least 2)', h('textarea', { name: 'points', rows: 4 }, (q.evaluation_points || []).join('\n')))),
    full(field('Test cases (one per line: input => expected)', h('textarea', { name: 'tests', rows: 3, ...mono }, (q.test_cases || []).map((t) => `${t.input} => ${t.expected}`).join('\n')))),
    full(h('label', { class: 'check' }, active, 'Active (validated before activation)')));
  const m = modal({ title: q.id ? `Edit ${q.code}` : 'New programming question', body: form, size: 'wide' });
  m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
    const d = formData(form);
    const body = { ...d, evaluation_points: d.points.split('\n').map((x) => x.trim()).filter(Boolean),
      test_cases: d.tests.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => { const [i, ...e] = x.split('=>'); return { input: i.trim(), expected: e.join('=>').trim() }; }) };
    delete body.points; delete body.tests;
    try { const r = q.id ? await put(`/programming/questions/${q.id}`, body) : await post('/programming/questions', body); m.close(); toast(`${r.code} saved`, 'success'); onSaved(); } catch (e) { toast(e.message, 'error', 7000); }
  } }, 'Save'));
}
function langDialog(onSaved) {
  const form = h('form', {}, field('Key (lowercase)', h('input', { type: 'text', name: 'key', placeholder: 'e.g. go, kotlin, php' })), field('Label', h('input', { type: 'text', name: 'label', placeholder: 'e.g. Go' })),
    h('p', { class: 'muted small' }, 'Add at least one complete set of 10 active questions before the language can be assigned.'));
  const m = modal({ title: 'Add programming language', body: form, size: 'narrow' });
  m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
    try { await post('/programming/languages', formData(form)); m.close(); toast('Language saved', 'success'); onSaved(); } catch (e) { toast(e.message, 'error'); }
  } }, 'Save'));
}
