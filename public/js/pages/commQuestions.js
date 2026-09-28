import { get, post, put, del, qs } from '../api.js';
import { h, html, table, field, select, modal, toast, confirmBox, formData, downloadUrl } from '../ui.js';

export default async function (el) {
  const sets = await get('/exam-sets');
  el.append(h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Communication Question Bank'), h('p', {}, 'Open-ended written questions (100–200 words, 10 marks each), evaluated on grammar, vocabulary, clarity, structure and professional communication.')),
    h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => downloadUrl('/api/export/communication_questions?format=xlsx') }, 'Export'),
      h('button', { class: 'btn primary', onclick: () => edit({}) }, '+ New question'))));
  const f = { exam_set: select('exam_set', [['', 'All sets'], ...sets.map((s) => s.code)], ''), active: select('active', [['', 'All'], ['1', 'Active'], ['0', 'Inactive']], ''), q: h('input', { type: 'search', placeholder: 'Search' }) };
  const form = h('form', { class: 'filters' });
  const g = field('Search', f.q); g.classList.add('grow');
  form.append(g, field('Exam set', f.exam_set), field('Active', f.active), h('button', { class: 'btn primary' }, 'Filter'));
  const out = h('div');
  el.append(h('div', { class: 'card' }, form, out));
  form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
  [f.exam_set, f.active].forEach((x) => x.addEventListener('change', load));
  async function load() {
    const d = await get('/questions/communication' + qs({ exam_set: f.exam_set.value, active: f.active.value, q: f.q.value }));
    out.innerHTML = '';
    out.append(h('p', { class: 'muted small' }, `${d.rows.length} question(s)`), table([
      { label: 'Code', render: (q) => html`<span class="mono">${q.code}</span><div class="muted small">${q.set_code || 'Unassigned'}</div>` },
      { label: 'Question', key: 'question' }, { label: 'Category', key: 'category' },
      { label: 'Words', render: (q) => `${q.expected_words_min}–${q.expected_words_max}` }, { label: 'Marks', num: true, key: 'marks' },
      { label: 'Used', num: true, key: 'times_used' },
      { label: 'Active', render: (q) => html`<span class="badge ${q.active ? 'good' : ''}">${q.active ? 'Active' : 'Inactive'}</span>` },
      { label: '', render: (q) => h('div', { class: 'btn-row' },
        h('button', { class: 'btn sm', onclick: () => preview(q) }, 'Preview'), h('button', { class: 'btn sm', onclick: () => edit(q) }, 'Edit'),
        h('button', { class: 'btn sm danger', onclick: async () => {
          if (!await confirmBox('Delete question?', 'Questions used in any attempt are deactivated instead.', { danger: true, okText: 'Delete' })) return;
          try { const r = await del(`/questions/communication/${q.id}`); toast(r.message || 'Deleted', 'success'); load(); } catch (e) { toast(e.message, 'error'); }
        } }, 'Delete')) },
    ], d.rows));
  }
  function preview(q) {
    const m = modal({ title: 'Candidate preview', body: h('div', {}, h('p', { style: 'font-size:15px' }, q.question), h('textarea', { rows: 8, placeholder: 'Candidate types a paragraph here…', disabled: true }),
      h('p', { class: 'muted small' }, `Word count: 0 / ${q.expected_words_max} · recommended minimum ${q.expected_words_min} words`)) });
    m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Close'));
  }
  function edit(q) {
    const active = h('input', { type: 'checkbox', name: 'active' }); active.checked = q.id ? !!q.active : true;
    const form = h('form', { class: 'form-grid' },
      field('Exam set', select('exam_set_id', [['', 'Unassigned'], ...sets.map((s) => [s.id, s.code])], q.exam_set_id)),
      field('Category', select('category', ['', 'Self-presentation', 'Problem Solving', 'Teamwork', 'Customer Handling', 'Leadership', 'Time Management', 'Workplace Communication', 'Career Goals', 'Adaptability', 'Ethics & Professionalism'], q.category)),
      field('Min words', h('input', { type: 'number', name: 'expected_words_min', min: 10, value: q.expected_words_min ?? 100 })),
      field('Max words', h('input', { type: 'number', name: 'expected_words_max', min: 20, value: q.expected_words_max ?? 200 })),
      field('Marks', h('input', { type: 'number', name: 'marks', min: 1, value: q.marks ?? 10 })));
    const qf = field('Question *', h('textarea', { name: 'question', rows: 3 }, q.question || '')); qf.classList.add('full');
    const af = h('label', { class: 'check full' }, active, 'Active');
    form.append(qf, af);
    const m = modal({ title: q.id ? `Edit ${q.code}` : 'New communication question', body: form });
    m.foot.append(h('button', { class: 'btn', onclick: m.close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
      const d = formData(form); d.exam_set_id = d.exam_set_id ? Number(d.exam_set_id) : null;
      try { const r = q.id ? await put(`/questions/communication/${q.id}`, d) : await post('/questions/communication', d); m.close(); toast(`${r.code} saved`, 'success'); load(); } catch (e) { toast(e.message, 'error', 6000); }
    } }, 'Save'));
  }
  await load();
}
