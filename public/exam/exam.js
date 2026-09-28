// Candidate examination portal. Server is authoritative for time, scoring and locking; this client only renders and saves.
const root = document.getElementById('exam-app');
const params = new URLSearchParams(location.search);
const TOKEN = params.get('t') || '';
const LETTERS = ['A', 'B', 'C', 'D'];

// ---------- tiny DOM helpers ----------
const BOOL_ATTRS = new Set(['disabled', 'checked', 'selected', 'required', 'readonly', 'hidden', 'multiple', 'autofocus', 'novalidate']);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v; else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (BOOL_ATTRS.has(k)) { if (v) el.setAttribute(k, ''); } else if (v === true) el.setAttribute(k, ''); else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const hms = (s) => { s = Math.max(0, Math.floor(s)); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map((x) => String(x).padStart(2, '0')).join(':'); };
const countWords = (t) => ((t || '').trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;

class ApiError extends Error { constructor(s, m, c) { super(m); this.status = s; this.code = c; } }
async function api(method, url, body, { keepalive = false } = {}) {
  const r = await fetch('/api/candidate' + url, { method, credentials: 'same-origin', keepalive,
    headers: { 'x-requested-with': 'cexs', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const t = await r.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = null; }
  if (!r.ok) throw new ApiError(r.status, d?.error || 'Request failed', d?.code);
  return d;
}

// ---------- state ----------
const S = {
  state: null, paper: null, section: 'aptitude', idx: { aptitude: 0, communication: 0 },
  dirty: new Map(), saving: false, lastSaved: null, saveError: null, deadlineLocal: null, sectionDeadlineLocal: null,
  timerHandle: null, autosaveHandle: null, submitting: false, locked: false, warned: 0, listenersOn: false, skillsConfirmed: false,
};

// ---------- screens ----------
const BRAND = { logo: null, company: '' };
const brandLogo = (cls) => (BRAND.logo ? h('img', { class: `${cls}${BRAND.logo_plate && cls === 'head-logo' ? ' on-plate' : ''}`, src: BRAND.logo.url, alt: BRAND.company || 'Company logo' }) : null);
// Every full-page card gets the company logo and a thin brand-colour bar at the top.
function screen(...content) {
  root.innerHTML = '';
  for (const c of content) { const card = c.querySelector?.(':scope > .exam-card'); if (card && BRAND.logo) card.prepend(brandLogo('exam-logo')); }
  root.append(h('div', { class: 'exam-brandbar' }), ...content); window.scrollTo(0, 0);
}
function fatal(title, msg, extra) {
  stopTimers(); S.locked = true; document.body.classList.remove('no-select');
  screen(h('div', { class: 'exam-center' }, h('div', { class: 'exam-card' }, h('h1', {}, title), h('p', {}, msg), extra || null)));
}

async function boot() {
  try { Object.assign(BRAND, await (await fetch('/api/brand', { credentials: 'same-origin' })).json()); } catch { /* defaults */ }
  if (BRAND.company) document.title = `${BRAND.company} · Online Examination`;
  try { S.state = await api('GET', '/state'); return route(); } catch (e) { if (e.status !== 401 && e.status !== 409) return fatal('Unable to load', e.message); }
  showLogin();
}
async function showLogin() {
  if (!TOKEN) return fatal('Exam link required', 'Please open the personal examination link sent to you by email.');
  let info = { require_access_code: true, company: '' };
  try { info = await api('GET', '/link-info'); } catch { /* default */ }
  const err = h('div', { class: 'callout bad hidden', role: 'alert' });
  const code = h('input', { type: 'text', id: 'code', autocomplete: 'one-time-code', maxlength: 12, style: 'font-size:20px;letter-spacing:.2em;text-transform:uppercase;text-align:center', 'aria-label': 'Access code' });
  const btn = h('button', { class: 'btn primary', type: 'submit', style: 'width:100%;justify-content:center;padding:11px' }, 'Continue');
  const form = h('form', {}, info.require_access_code ? h('div', { class: 'field' }, h('label', { for: 'code' }, 'Access code (from your invitation email)'), code) : null, btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.classList.add('hidden'); btn.disabled = true;
    try { await api('POST', '/login', { token: TOKEN, access_code: code.value.trim() }); S.state = await api('GET', '/state'); route(); }
    catch (x) { err.textContent = x.message; err.classList.remove('hidden'); } finally { btn.disabled = false; }
  });
  screen(h('div', { class: 'exam-center', style: 'max-width:460px' }, h('div', { class: 'exam-card' },
    h('h1', {}, 'Online Examination'), h('p', { class: 'muted' }, `${info.company ? info.company + ' · ' : ''}Candidate authentication`), err, form,
    h('p', { class: 'muted small', style: 'margin-top:14px' }, 'Use a laptop or desktop with a stable connection. Your activity during the exam is recorded.'))));
  if (info.require_access_code) code.focus();
}

function route() {
  const st = S.state;
  if (st.exam.status === 'Submitted') return showSubmitted();
  if (st.exam.status === 'In Progress') return startExamUi();
  if (st.exam.status === 'Assigned') {
    const codes = (st.blockers || []).map((b) => b.code);
    if (codes.includes('NOT_YET_OPEN')) return showNotYetOpen();
    if (st.skills && (!S.skillsConfirmed || codes.includes('SKILLS_REQUIRED') || codes.includes('LANGUAGE_REQUIRED'))) return showSkills();
    return showInstructions();
  }
  return fatal('Examination unavailable', `This examination is ${st.exam.status.toLowerCase()}. Please contact the recruitment team.`);
}

// ---------- scheduled window ----------
function showNotYetOpen() {
  const st = S.state;
  const opens = new Date(st.available_from);
  const cd = h('div', { class: 'timer', style: 'display:inline-block;background:var(--brand);color:#fff;margin:10px 0' }, h('small', {}, 'Opens in'), h('span', { id: 'open-cd' }, '--:--:--'));
  screen(h('div', { class: 'exam-center' }, h('div', { class: 'exam-card', style: 'text-align:center' },
    h('h1', {}, 'Your examination is scheduled'), h('p', {}, `Hello ${st.candidate.first_name}, your examination opens on`),
    h('p', { style: 'font-size:18px;font-weight:600' }, opens.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })), cd,
    h('p', { class: 'muted small' }, 'Keep this page open — it will continue automatically when the exam opens. You can also close it and use your link again later.'))));
  const t = setInterval(async () => {
    const left = (opens - Date.now()) / 1000;
    const el = document.getElementById('open-cd'); if (el) el.textContent = hms(left);
    if (left <= 0) { clearInterval(t); try { S.state = await api('GET', '/state'); route(); } catch (e) { handleErr(e); } }
  }, 1000);
}

// ---------- skills & programming language ----------
function showSkills() {
  const st = S.state; const sk = st.skills; const prg = st.programming;
  const rows = h('div', { id: 'skill-rows' });
  const list = h('datalist', { id: 'skill-suggest' }, sk.suggestions.map((x) => h('option', { value: x })));
  const langSel = prg ? h('select', { id: 'prg-lang', 'aria-label': 'Programming language for the test', disabled: prg.choice === 'hr' && !!prg.language }) : null;
  const addRow = (v = {}) => {
    const skill = h('input', { type: 'text', list: 'skill-suggest', placeholder: 'e.g. Java, Python, SQL, Salesforce Apex', value: v.skill || '', maxlength: 60, 'aria-label': 'Skill' });
    const level = h('select', { 'aria-label': 'Proficiency level' }, h('option', { value: '' }, 'Level…'), sk.levels.map((l) => h('option', { value: l, selected: v.level === l }, l)));
    const years = h('input', { type: 'number', min: 0, max: 50, step: 0.5, placeholder: 'Years', value: v.years ?? '', style: 'max-width:90px', 'aria-label': 'Years of experience' });
    const del = h('button', { type: 'button', class: 'btn sm danger', 'aria-label': 'Remove skill', onclick: () => { row.remove(); refreshLang(); } }, '✕');
    const row = h('div', { class: 'skill-row' }, skill, level, years, del);
    skill.addEventListener('input', refreshLang);
    rows.append(row);
  };
  const aliases = { java: ['java'], python: ['python', 'python3'], javascript: ['javascript', 'js', 'node', 'node.js', 'nodejs', 'typescript'], csharp: ['c#', 'csharp', 'c sharp', '.net', 'dotnet'],
    sql: ['sql', 'mysql', 'postgresql', 'postgres', 'sql server', 't-sql', 'oracle sql', 'sqlite', 'pl/sql'], apex: ['apex', 'salesforce apex', 'salesforce', 'salesforce development'] };
  const collect = () => [...rows.querySelectorAll('.skill-row')].map((r) => { const [s, l, y] = r.querySelectorAll('input,select'); return { skill: s.value.trim(), level: l.value, years: y.value === '' ? null : Number(y.value) }; }).filter((x) => x.skill);
  function refreshLang() {
    if (!langSel || (prg.choice === 'hr' && prg.language)) return;
    const declared = new Set(collect().map((x) => x.skill.toLowerCase()));
    const match = prg.languages.filter((l) => (aliases[l.key] || [l.label.toLowerCase()]).some((a) => declared.has(a)) || declared.has(l.label.toLowerCase()));
    const keep = langSel.value || prg.language;
    langSel.innerHTML = '';
    langSel.append(h('option', { value: '' }, 'Choose a language…'));
    if (match.length) langSel.append(h('optgroup', { label: 'From your skills' }, match.map((l) => h('option', { value: l.key }, l.label))));
    const others = prg.languages.filter((l) => !match.includes(l));
    if (others.length) langSel.append(h('optgroup', { label: 'Other supported languages' }, others.map((l) => h('option', { value: l.key }, l.label))));
    if (keep) langSel.value = keep;
  }
  (sk.current.length ? sk.current : [{}, {}]).forEach(addRow);
  if (langSel) { if (prg.choice === 'hr' && prg.language) langSel.append(h('option', { value: prg.language, selected: true }, prg.language_label)); refreshLang(); }
  const err = h('div', { class: 'callout bad hidden', role: 'alert' });
  const next = h('button', { class: 'btn primary', style: 'padding:11px 22px' }, 'Save & Continue');
  next.addEventListener('click', async () => {
    err.classList.add('hidden');
    const skills = collect();
    if (skills.length < sk.min) { err.textContent = `Please add at least ${sk.min} skill${sk.min === 1 ? '' : 's'}.`; err.classList.remove('hidden'); return; }
    const miss = skills.find((x) => !x.level); if (miss) { err.textContent = `Select a level for ${miss.skill}.`; err.classList.remove('hidden'); return; }
    if (langSel && !langSel.value) { err.textContent = 'Choose the programming language for your test.'; err.classList.remove('hidden'); return; }
    next.disabled = true;
    try { S.state = await api('POST', '/skills', { skills, programming_language: langSel ? langSel.value : undefined }); S.skillsConfirmed = true; route(); }
    catch (e) { err.textContent = e.message; err.classList.remove('hidden'); } finally { next.disabled = false; }
  });
  screen(h('div', { class: 'exam-center' }, h('div', { class: 'exam-card' },
    h('h1', {}, 'Your skills'), h('p', { class: 'muted' }, `Hello ${st.candidate.first_name}. Before the instructions, tell us about your skills — add as many as apply, with your level and years of experience.`),
    err, list, rows, h('button', { type: 'button', class: 'btn sm', style: 'margin:6px 0 16px', onclick: () => addRow() }, '+ Add another skill'),
    prg ? h('div', { class: 'callout info' }, h('b', {}, 'Programming section: '), prg.choice === 'hr' && prg.language
      ? `Your programming questions will be in ${prg.language_label} (selected by the recruitment team).`
      : 'Choose the language for your 10 programming questions. You will write code (or explain code) in this language; answers are reviewed by AI and evaluators.') : null,
    prg ? h('div', { class: 'field', style: 'max-width:360px' }, h('label', { for: 'prg-lang' }, 'Programming language for the test'), langSel) : null,
    h('div', { class: 'btn-row', style: 'margin-top:10px' }, next))));
}

function showInstructions() {
  const st = S.state; const d = st.duration;
  const hasPrg = !!st.programming;
  const dur = d.mode === 'sectional'
    ? `${d.aptitude_minutes + d.communication_minutes + (hasPrg ? d.programming_minutes : 0)} minutes – Aptitude ${d.aptitude_minutes} min, then Communication ${d.communication_minutes} min${hasPrg ? `, then Programming ${d.programming_minutes} min` : ''} (each section has its own timer; you cannot return to a section once you move on)`
    : `${d.total_minutes} minutes for the whole examination (you can move freely between sections)`;
  const agree = h('input', { type: 'checkbox', id: 'agree' });
  const start = h('button', { class: 'btn primary', disabled: true, style: 'padding:11px 22px;font-size:15px' }, 'I Agree & Start Examination');
  agree.addEventListener('change', () => { start.disabled = !agree.checked; });
  start.addEventListener('click', async () => {
    start.disabled = true;
    try { S.state = await api('POST', '/start', { agree: true }); startExamUi(); } catch (e) { alertBox('Could not start', e.message); start.disabled = false; if (['SKILLS_REQUIRED', 'LANGUAGE_REQUIRED', 'NOT_YET_OPEN'].includes(e.code)) { S.state = await api('GET', '/state'); route(); } }
  });
  const kv = (k, v) => h('div', {}, h('span', {}, k), h('b', {}, v ?? '—'));
  screen(h('div', { class: 'exam-center' }, h('div', { class: 'exam-card' },
    h('h1', {}, 'Candidate Examination Instructions'),
    h('div', { class: 'kv', style: 'margin:14px 0 18px' }, kv('Candidate', st.candidate.name), kv('Candidate ID', st.candidate.candidate_id), kv('Email', st.candidate.email),
      kv('Position applied for', st.candidate.position), kv('Exam ID', st.exam.exam_id), kv('Exam set', st.exam.exam_set),
      hasPrg ? kv('Programming language', st.programming.language_label) : null),
    h('div', { class: 'callout info' }, h('b', {}, 'Structure: '), 'Section 1 – 20 Aptitude multiple-choice questions (1 mark each). Section 2 – 10 Communication questions requiring a written paragraph of about ',
      `${st.config.min_words}–${st.config.max_words} words each. `,
      hasPrg ? `Section 3 – 10 Programming questions in ${st.programming.language_label} (write, fix or explain short pieces of code; 10 marks each). ` : '',
      h('b', {}, 'Duration: '), dur, '.'),
    h('ol', { class: 'instructions' }, st.instructions.map((t) => h('li', {}, t))),
    hasPrg ? h('p', { class: 'small' }, 'Programming answers are typed in a plain code box — no compiler is available and your code is never executed. Focus on correct logic and readable code; small typos are not penalised. Pasting is disabled; use “Insert starter code” when a task provides code.') : null,
    h('p', { class: 'small muted' }, 'Answers are saved automatically every few seconds and whenever you move between questions. Leaving the exam window, switching tabs and copy/paste attempts are recorded for review by the recruitment team.'),
    st.skills ? h('p', { class: 'small' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); S.skillsConfirmed = false; showSkills(); } }, 'Change my skills / language')) : null,
    h('label', { class: 'check', style: 'margin:16px 0' }, agree, 'I have read and agree to the examination instructions.'), start)));
}

// ---------- exam ----------
const SECTION_META = {
  aptitude: { label: 'Section 1 – Aptitude', short: 'Aptitude', prefix: 'A' },
  communication: { label: 'Section 2 – Communication', short: 'Communication', prefix: 'C' },
  programming: { label: 'Section 3 – Programming', short: 'Programming', prefix: 'P' },
};
const sections = () => ['aptitude', 'communication', 'programming'].filter((k) => S.paper && S.paper[k] && S.paper[k].length);
async function startExamUi() {
  try { S.paper = await api('GET', '/paper'); } catch (e) { return handleErr(e); }
  S.state = await api('GET', '/state').catch(() => S.state);
  applyTiming(S.paper.timing);
  for (const k of sections()) if (S.idx[k] === undefined) S.idx[k] = 0;
  if (S.paper.timing.mode === 'sectional') S.section = S.paper.timing.current_section;
  enableIntegrity();
  document.body.classList.toggle('no-select', !!S.state.config.disable_copy_paste);
  drawExam();
  stopTimers();
  S.timerHandle = setInterval(tickTimer, 500);
  S.autosaveHandle = setInterval(() => save('interval'), Math.max(5, S.state.config.autosave_seconds || 15) * 1000);
}
function applyTiming(t) {
  if (!t) return;
  S.deadlineLocal = Date.now() + t.remaining_seconds * 1000;
  S.sectionDeadlineLocal = t.section_remaining_seconds != null ? Date.now() + t.section_remaining_seconds * 1000 : null;
  S.timing = t;
}
function stopTimers() { clearInterval(S.timerHandle); clearInterval(S.autosaveHandle); }
const qList = () => S.paper[S.section];
const cur = () => qList()[S.idx[S.section]];
const isAnswered = (sec, q) => (sec === 'aptitude' ? !!q.answer : sec === 'programming' ? !!String(q.answer || '').trim() : countWords(q.answer) > 0);
// Sectional mode: only the current section is open; earlier sections are locked, later sections are not yet open.
const sectionLocked = (sec) => S.timing?.mode === 'sectional' && S.timing.current_section !== sec;
const sectionIsPast = (sec) => S.timing?.mode === 'sectional' && (S.timing.locked_sections || []).includes(sec);
const countAnswered = () => sections().reduce((m, k) => m + S.paper[k].filter((q) => isAnswered(k, q)).length, 0);
const countTotal = () => sections().reduce((m, k) => m + S.paper[k].length, 0);
const nextSection = (sec) => sections()[sections().indexOf(sec) + 1];

function codeEditor(q, locked) {
  const ta = h('textarea', { class: 'essay code', 'aria-label': `Your ${q.language_label} answer`, placeholder: q.task_type === 'explain_output' ? 'Write the exact output, then explain why…' : `Write your ${q.language_label} code here…`,
    spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', disabled: locked });
  ta.value = q.answer || '';
  const info = h('span', {});
  const upd = () => { const t = ta.value; info.textContent = `${t.trim() ? t.split('\n').length : 0} lines · ${t.length} characters`; };
  upd();
  let debounce;
  const changed = () => { q.answer = ta.value; markDirty('programming', q); upd(); updatePalette(); clearTimeout(debounce); debounce = setTimeout(() => save('typing'), 3000); };
  ta.addEventListener('input', changed);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { // indent instead of leaving the field
      e.preventDefault();
      const s = ta.selectionStart; const en = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s + 4; changed();
    } else if (e.key === 'Enter') { // keep indentation
      const s = ta.selectionStart; const line = ta.value.slice(0, s).split('\n').pop(); const ind = (line.match(/^\s*/) || [''])[0];
      if (ind) { e.preventDefault(); ta.value = ta.value.slice(0, s) + '\n' + ind + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 1 + ind.length; changed(); }
    }
  });
  return { ta, info, setValue: (v) => { ta.value = v; changed(); } };
}

function drawExam() {
  const st = S.state;
  const total = countTotal();
  const secs = sections();
  const overallNo = secs.slice(0, secs.indexOf(S.section)).reduce((m, k) => m + S.paper[k].length, 0) + S.idx[S.section] + 1;
  const answered = countAnswered();
  const timer = h('div', { class: 'timer', id: 'timer', role: 'timer', 'aria-live': 'off' }, h('small', {}, S.timing.mode === 'sectional' ? `${SECTION_META[S.timing.current_section]?.short || ''} time remaining` : 'Time Remaining'), h('span', { id: 'timer-v' }, '--:--:--'));
  const head = h('header', { class: 'exam-head' },
    h('div', { class: 'who', style: 'display:flex;align-items:center' }, brandLogo('head-logo'), h('div', {}, h('b', {}, st.candidate.name), h('div', {}, h('span', {}, `ID ${st.candidate.candidate_id}`), h('span', {}, st.candidate.position || ''), h('span', {}, `Exam set ${st.exam.exam_set}`),
      st.programming?.language_label ? h('span', {}, st.programming.language_label) : null))),
    h('div', {}, h('div', { style: 'font-size:13px' }, `Question ${overallNo} of ${total}`), h('div', { class: 'progress-bar', style: 'width:160px' }, h('i', { id: 'hdr-bar', style: `width:${answered / total * 100}%` })),
      h('div', { class: 'small', id: 'hdr-count', style: 'color:var(--on-brand-muted);margin-top:3px' }, `${answered} of ${total} answered`)),
    timer);
  const q = cur();
  const area = h('section', { class: 'q-area', 'aria-live': 'polite' });
  const locked = sectionLocked(S.section);
  const metaRight = S.section === 'aptitude' ? `${q.category || ''} · 1 mark` : S.section === 'communication' ? '10 marks · written answer'
    : `${q.language_label} · ${String(q.task_type).replace('_', ' ')} · ${q.marks} marks · ~${q.expected_minutes} min`;
  area.append(h('div', { class: 'q-meta' }, h('span', {}, `${SECTION_META[S.section].label} · Question ${S.idx[S.section] + 1} of ${qList().length}`), h('span', {}, metaRight)));
  if (S.section === 'aptitude') {
    area.append(h('div', { class: 'q-text' }, q.question));
    if (q.table) area.append(h('div', { style: 'overflow-x:auto' }, h('table', { class: 'q-table' }, h('thead', {}, h('tr', {}, q.table.headers.map((x) => h('th', {}, x)))),
      h('tbody', {}, q.table.rows.map((r) => h('tr', {}, r.map((x) => h('td', {}, x))))))));
    const opts = h('div', { class: 'opts', role: 'radiogroup', 'aria-label': 'Answer options' });
    for (const o of q.options) {
      const b = h('button', { type: 'button', class: `opt ${q.answer === o.key ? 'sel' : ''}`, role: 'radio', 'aria-checked': q.answer === o.key ? 'true' : 'false', disabled: locked },
        h('span', { class: 'k' }, o.key), h('span', {}, o.text));
      b.addEventListener('click', () => { if (locked) return; q.answer = o.key; markDirty('aptitude', q); drawExam(); save('change'); });
      opts.append(b);
    }
    area.append(opts);
  } else if (S.section === 'communication') {
    area.append(h('div', { class: 'q-text' }, q.question));
    const ta = h('textarea', { class: 'essay', 'aria-label': 'Your answer', placeholder: 'Write your answer in complete paragraphs…', spellcheck: 'true', disabled: locked });
    ta.value = q.answer || '';
    const wc = h('b', {});
    const updWc = () => { const n = countWords(ta.value); wc.textContent = `Word Count: ${n} / ${q.max_words}`; wc.className = n === 0 ? '' : n < q.min_words ? 'low' : n > q.max_words ? 'over' : 'ok'; };
    updWc();
    let debounce;
    ta.addEventListener('input', () => { q.answer = ta.value; markDirty('communication', q); updWc(); updatePalette(); clearTimeout(debounce); debounce = setTimeout(() => save('typing'), 3000); });
    area.append(ta, h('div', { class: 'wc' }, wc, h('span', {}, `Recommended minimum: ${q.min_words} words`)));
    setTimeout(() => { if (!locked) ta.focus(); }, 0);
  } else {
    const TT = { write_code: 'Write code', fix_bug: 'Find & fix the bug', explain_output: 'Predict the output & explain', complete_code: 'Complete the code' };
    area.append(h('div', { class: 'btn-row', style: 'margin-bottom:6px' }, h('span', { class: 'badge brand' }, TT[q.task_type] || q.task_type), q.topic ? h('span', { class: 'badge' }, q.topic) : null));
    area.append(h('div', { class: 'q-text' }, q.question));
    const ed = codeEditor(q, locked);
    if (q.starter_code) {
      area.append(h('div', { class: 'small muted', style: 'margin-bottom:4px' }, q.task_type === 'explain_output' ? 'Code:' : 'Starter / given code:'),
        h('pre', { class: 'code-block' }, q.starter_code));
      if (q.task_type !== 'explain_output') area.append(h('button', { type: 'button', class: 'btn sm', style: 'margin:6px 0;align-self:flex-start', disabled: locked, onclick: async () => {
        if (ed.ta.value.trim() && !(await confirmBox('Replace your answer?', 'Your current answer will be replaced by the starter code.', 'Replace'))) return;
        ed.setValue(q.starter_code); ed.ta.focus();
      } }, 'Insert starter code into my answer'));
    }
    area.append(ed.ta, h('div', { class: 'wc' }, ed.info, h('span', {}, 'Tab inserts spaces · code is not executed')));
    setTimeout(() => { if (!locked) ed.ta.focus(); }, 0);
  }
  if (locked) area.append(h('div', { class: `callout ${sectionIsPast(S.section) ? 'warn' : 'info'}`, style: 'margin-top:12px' },
    sectionIsPast(S.section) ? `The ${SECTION_META[S.section].short.toLowerCase()} section is closed. Answers can no longer be changed.` : 'Complete the current section first.'));
  const isFirst = S.idx[S.section] === 0; const isLast = S.idx[S.section] === qList().length - 1;
  const firstSection = secs.indexOf(S.section) === 0;
  const prev = h('button', { class: 'btn', disabled: isFirst && (firstSection || S.timing.mode === 'sectional'), onclick: () => move(-1) }, '‹ Previous');
  const nx = nextSection(S.section);
  const next = isLast && !nx ? h('button', { class: 'btn primary', onclick: showReview }, 'Review & Submit')
    : isLast ? h('button', { class: 'btn primary', onclick: () => goToSection(nx) }, `Continue to ${SECTION_META[nx].short} ›`)
      : h('button', { class: 'btn primary', onclick: () => move(1) }, 'Next ›');
  const review = h('button', { class: 'btn', disabled: locked, onclick: () => { q.review = !q.review; markDirty(S.section, q); drawExam(); save('change'); } }, q.review ? '★ Unmark Review' : '☆ Mark for Review');
  const clear = h('button', { class: 'btn danger', disabled: locked, onclick: () => { if (S.section === 'aptitude') q.answer = null; else q.answer = ''; markDirty(S.section, q); drawExam(); save('change'); } }, 'Clear Answer');
  area.append(h('div', { class: 'q-actions' }, h('div', { class: 'btn-row' }, prev, review, clear), next));

  const side = h('aside', { class: 'side' });
  const secTabs = h('div', { class: 'sec-tabs' }, secs.map((k) => h('button', { class: S.section === k ? 'active' : '',
    disabled: S.timing.mode === 'sectional' && S.section !== k && sectionIsPast(k), onclick: () => switchSection(k) }, `${SECTION_META[k].short} (${S.paper[k].length})`)));
  const pal = h('div', { class: 'palette', id: 'palette' });
  side.append(h('div', { class: 'panel' }, h('h3', {}, 'Question navigation'), secTabs, pal,
    h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'a' }), 'Answered'), h('span', {}, h('i'), 'Unanswered'), h('span', {}, h('i', { class: 'r' }), 'Marked for review')),
    h('div', { class: 'save-state', id: 'save-state', style: 'margin-top:12px' }, saveText())),
    h('div', { class: 'panel' }, h('h3', {}, 'Finish'), h('p', { class: 'small muted' }, 'Review your answers before submitting. Submission is final.'),
      h('button', { class: 'btn success', style: 'width:100%;justify-content:center', onclick: showReview }, 'Review & Submit')));
  screen(head, h('main', { class: 'exam-layout' }, area, side));
  updatePalette(); tickTimer();
}
function updatePalette() {
  const pal = document.getElementById('palette'); if (!pal) return;
  const total = countTotal(); const answered = countAnswered();
  const hc = document.getElementById('hdr-count'); if (hc) hc.textContent = `${answered} of ${total} answered`;
  const hb = document.getElementById('hdr-bar'); if (hb) hb.style.width = `${answered / total * 100}%`;
  pal.innerHTML = '';
  const sec = S.section;
  S.paper[sec].forEach((q, i) => {
    const cls = [isAnswered(sec, q) ? 'answered' : '', q.review ? 'review' : '', i === S.idx[sec] ? 'current' : ''].join(' ');
    pal.append(h('button', { class: cls, title: `${isAnswered(sec, q) ? 'Answered' : 'Unanswered'}${q.review ? ', marked for review' : ''}`, 'aria-label': `Question ${i + 1}`, onclick: () => { S.idx[sec] = i; save('navigate'); drawExam(); } }, String(i + 1)));
  });
}
function move(d) {
  const n = S.idx[S.section] + d;
  const secs = sections(); const pos = secs.indexOf(S.section);
  if (n < 0 && pos > 0 && S.timing.mode !== 'sectional') { S.section = secs[pos - 1]; S.idx[S.section] = S.paper[S.section].length - 1; }
  else if (n >= 0 && n < qList().length) S.idx[S.section] = n;
  save(d > 0 ? 'next' : 'previous'); drawExam();
}
function switchSection(sec) {
  if (sec === S.section) return;
  if (S.timing.mode === 'sectional') {
    if (sectionIsPast(sec)) return;
    if (sec !== S.timing.current_section) return goToSection(sec);
  }
  S.section = sec; save('navigate'); drawExam();
}
async function goToSection(target) {
  if (S.timing.mode !== 'sectional' || target === S.timing.current_section) { S.section = target; save('navigate'); return drawExam(); }
  const curSec = S.timing.current_section;
  if (sections().indexOf(target) !== sections().indexOf(curSec) + 1) return;
  const un = S.paper[curSec].filter((q) => !isAnswered(curSec, q)).length;
  const ok = await confirmBox(`Finish the ${SECTION_META[curSec].short.toLowerCase()} section?`, `${un ? `You have ${un} unanswered question(s) in this section. ` : ''}Once you continue, you cannot return to it.`, `Continue to ${SECTION_META[target].short}`);
  if (!ok) return;
  try {
    await save('section');
    const r = await api('POST', '/section/next', {});
    applyTiming(r.timing); S.section = r.timing.current_section; S.idx[S.section] = 0; drawExam();
  } catch (e) { handleErr(e); }
}

// ---------- autosave ----------
function markDirty(sec, q) { S.dirty.set(`${sec}:${q.id}`, { sec, q }); }
function build(entries) {
  const out = { aptitude: [], communication: [], programming: [] };
  for (const { sec, q } of entries) {
    if (sec === 'aptitude') out.aptitude.push({ id: q.id, answer: q.answer || null, review: !!q.review });
    else out[sec].push({ id: q.id, text: q.answer || '', review: !!q.review });
  }
  return out;
}
// Full snapshot of every answer in open sections – sent with the final submission so nothing in flight can be lost.
const snapshot = () => build(sections().filter((k) => !sectionLocked(k)).flatMap((k) => S.paper[k].map((q) => ({ sec: k, q }))));
async function save(reason) {
  if (S.locked || S.submitting || !S.dirty.size || S.saving) return;
  S.saving = true;
  const batch = new Map(S.dirty); S.dirty.clear();
  try {
    const r = await api('POST', '/answers', { ...build(batch.values()), reason });
    S.lastSaved = new Date(); S.saveError = null;
    if (r.timing) applyTiming(r.timing);
  } catch (e) {
    for (const [k, v] of batch) if (!S.dirty.has(k)) S.dirty.set(k, v);
    S.saveError = e.status ? e.message : 'Connection problem – answers will be saved when you are back online';
    if ([401, 409].includes(e.status)) handleErr(e);
  } finally { S.saving = false; const el = document.getElementById('save-state'); if (el) { el.textContent = saveText(); el.classList.toggle('err', !!S.saveError); } }
}
function saveText() {
  if (S.saveError) return `⚠ ${S.saveError}`;
  if (S.dirty.size) return 'Unsaved changes…';
  return S.lastSaved ? `All answers saved at ${S.lastSaved.toLocaleTimeString()}` : 'Answers are saved automatically';
}

// ---------- timer ----------
function tickTimer() {
  if (S.locked) return;
  const now = Date.now();
  const sectional = S.timing?.mode === 'sectional';
  const left = ((sectional && S.sectionDeadlineLocal ? S.sectionDeadlineLocal : S.deadlineLocal) - now) / 1000;
  const v = document.getElementById('timer-v');
  if (v) { v.textContent = hms(left); document.getElementById('timer').classList.toggle('low', left <= 300); }
  if (left <= 0) {
    if (sectional && S.timing.has_next_section) {
      const closed = S.timing.current_section;
      S.timing.has_next_section = false; // prevent repeat until the server confirms
      save('section').finally(async () => { try { const p = await api('GET', '/paper'); S.paper = p; applyTiming(p.timing); S.section = p.timing.current_section; S.idx[S.section] = 0; drawExam();
        alertBox(`${SECTION_META[closed].short} time is over`, `The ${SECTION_META[closed].short.toLowerCase()} section has closed. You are now in the ${SECTION_META[S.section].short.toLowerCase()} section.`); } catch (e) { handleErr(e); } });
      return;
    }
    submit('timer');
  }
}

// ---------- review & submit ----------
function showReview() {
  save('review');
  const secs = sections();
  const total = countTotal(); const answered = countAnswered();
  const un = secs.flatMap((k) => S.paper[k].map((q, i) => ({ sec: k, i, q, label: `${SECTION_META[k].prefix}${i + 1}` }))).filter((x) => !isAnswered(x.sec, x.q) || x.q.review);
  const com = S.paper.communication || [];
  const short = com.map((q, i) => ({ i, n: countWords(q.answer) })).filter((x) => x.n > 0 && x.n < (com[x.i].min_words || 100));
  const back = h('div', { class: 'overlay-warn', role: 'dialog', 'aria-modal': 'true' });
  const jump = (x) => { back.remove(); if (sectionLocked(x.sec)) return; S.section = x.sec; S.idx[x.sec] = x.i; drawExam(); };
  const box = h('div', { class: 'box', style: 'max-width:560px;text-align:left' },
    h('h2', {}, 'Review your answers'),
    h('p', { style: 'font-size:16px' }, h('b', {}, `You have answered ${answered} of ${total} questions. Are you sure you want to submit?`)),
    h('p', { class: 'small muted' }, secs.map((k) => `${SECTION_META[k].short}: ${S.paper[k].filter((q) => isAnswered(k, q)).length}/${S.paper[k].length}`).join(' · ')),
    un.length ? h('div', {}, h('b', { class: 'small' }, 'Unanswered (red) or marked for review (amber) – click to go back:'),
      h('div', { class: 'review-list' }, un.map((x) => h('button', { class: isAnswered(x.sec, x.q) ? 'rv' : '', onclick: () => jump(x), disabled: sectionLocked(x.sec) }, x.label)))) : h('div', { class: 'callout good' }, 'All questions have been answered.'),
    short.length ? h('div', { class: 'callout warn small' }, `Communication answers below the recommended length: ${short.map((x) => `C${x.i + 1} (${x.n} words)`).join(', ')}`) : null,
    h('div', { class: 'btn-row', style: 'justify-content:flex-end;margin-top:12px' },
      h('button', { class: 'btn', onclick: () => back.remove() }, 'Cancel'),
      h('button', { class: 'btn success', onclick: (e) => { e.target.disabled = true; back.remove(); submit('manual'); } }, 'Submit Examination')));
  back.append(box); document.body.append(back);
}
async function submit(reason) {
  if (S.submitting || S.locked) return;
  S.submitting = true; stopTimers();
  const answers = snapshot(); S.dirty.clear();
  const busy = h('div', { class: 'overlay-warn' }, h('div', { class: 'box' }, h('span', { class: 'spinner' }), h('p', {}, reason === 'timer' ? 'Time is up – submitting your examination…' : 'Submitting your examination…')));
  document.body.append(busy);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await api('POST', '/submit', { answers, reason: reason === 'timer' ? 'timer' : 'manual' });
      S.state = r.state; busy.remove(); S.locked = true; return showSubmitted(reason === 'timer');
    } catch (e) {
      if (e.code === 'ALREADY_SUBMITTED' || e.code === 'LOCKED') { busy.remove(); S.locked = true; S.state = await api('GET', '/state').catch(() => S.state); return showSubmitted(); }
      if (e.status && e.status !== 503) { busy.remove(); S.submitting = false; return handleErr(e); }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  busy.remove(); S.submitting = false;
  alertBox('Connection problem', 'We could not reach the server to submit. Please check your connection – your saved answers are safe and the exam will be submitted automatically when time runs out.');
  S.timerHandle = setInterval(tickTimer, 1000);
}
async function showSubmitted(timer) {
  stopTimers(); S.locked = true; disableIntegrity(); document.body.classList.remove('no-select');
  const st = S.state;
  const card = h('div', { class: 'exam-card', style: 'text-align:center' },
    h('div', { style: 'font-size:48px;color:var(--good)' }, '✓'),
    h('h1', {}, 'Your examination has been submitted successfully.'),
    h('p', {}, timer || st.exam.submission_type === 'auto_timer' ? 'The time limit was reached and your saved answers were submitted automatically.' : 'Thank you for completing the assessment.'),
    h('div', { class: 'kv', style: 'text-align:left;margin:18px 0' }, ...[['Candidate', st.candidate.name], ['Candidate ID', st.candidate.candidate_id], ['Exam ID', st.exam.exam_id],
      ['Submitted', st.exam.submitted_at ? new Date(st.exam.submitted_at).toLocaleString() : '—'], ['Questions answered', st.progress ? `${st.progress.answered} of ${st.progress.total}` : '—']].map(([k, v]) => h('div', {}, h('span', {}, k), h('b', {}, v)))),
    h('p', { class: 'muted' }, 'Your answers are locked and can no longer be changed. The recruitment team will contact you regarding the next steps. You may now close this window.'));
  screen(h('div', { class: 'exam-center' }, card));
  if (st.config.show_result) {
    try {
      const r = await api('GET', '/result');
      if (r.available) card.append(resultView(r));
    } catch { /* result not shared */ }
  }
}
function resultView(r) {
  const row = (k, v) => h('tr', {}, h('td', { style: 'text-align:left;padding:6px 12px' }, k), h('td', { style: 'text-align:right;padding:6px 12px;font-weight:600' }, v));
  const box = h('div', { style: 'margin-top:20px;text-align:left' }, h('h2', {}, 'Candidate Examination Result'),
    h('table', { style: 'width:100%;border-collapse:collapse' },
      row('Aptitude', `${r.aptitude_score} / ${r.aptitude_max} (${r.aptitude_percentage}%)`),
      row('Communication', `${r.communication_score} / ${r.communication_max} (${r.communication_percentage}%)`),
      row('Overall', `${r.final_score}%`), row('Result', r.final_status)),
    r.evaluator_comments ? h('p', {}, h('b', {}, 'Comments: '), r.evaluator_comments) : null);
  if (r.answers) box.append(h('h3', { style: 'margin-top:14px' }, 'Answer review'), ...r.answers.map((a, i) => h('div', { class: 'small', style: 'margin:8px 0' },
    h('b', {}, `${i + 1}. ${a.question}`), h('div', {}, `Your answer: ${a.selected_answer ? a.selected_answer + '. ' + a['option_' + a.selected_answer.toLowerCase()] : 'Unanswered'} · Correct: ${a.correct_answer}. ${a['option_' + a.correct_answer.toLowerCase()]}`),
    a.explanation ? h('div', { class: 'muted' }, a.explanation) : null)));
  return box;
}

// ---------- integrity controls (deterrents, not guarantees) ----------
const throttled = new Map();
function report(type, details) {
  const now = Date.now();
  if (type !== 'tab_hidden' && now - (throttled.get(type) || 0) < 3000) return;
  throttled.set(type, now);
  api('POST', '/events', { type, details }, { keepalive: true }).then((r) => { if (type === 'tab_hidden' && r) S.tabCount = r.tab_switch_count; }).catch(() => {});
}
const handlers = {
  visibilitychange: () => {
    if (document.visibilityState === 'hidden') { report('tab_hidden', { at: new Date().toISOString() }); save('hidden'); }
    else if (!S.locked) warnReturn();
  },
  blur: () => { if (!S.locked && document.visibilityState === 'visible') report('window_blur'); },
  copy: (e) => { if (S.state.config.disable_copy_paste) { e.preventDefault(); report('copy_attempt'); } },
  cut: (e) => { if (S.state.config.disable_copy_paste) { e.preventDefault(); report('cut_attempt'); } },
  paste: (e) => { if (S.state.config.disable_copy_paste) { e.preventDefault(); report('paste_attempt'); flash('Pasting is disabled during the examination.'); } },
  contextmenu: (e) => { if (S.state.config.disable_copy_paste) { e.preventDefault(); report('right_click'); } },
  drop: (e) => { if (S.state.config.disable_copy_paste) { e.preventDefault(); report('paste_attempt', { via: 'drop' }); } },
  keydown: (e) => {
    const k = e.key.toLowerCase();
    if (k === 'f12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(k))) { e.preventDefault(); report('devtools_key'); }
    if (k === 'f5' || ((e.ctrlKey || e.metaKey) && k === 'r')) { e.preventDefault(); report('reload_attempt'); flash('Refreshing is disabled during the examination.'); }
    if ((e.ctrlKey || e.metaKey) && ['p', 's', 'u'].includes(k)) e.preventDefault();
  },
  beforeunload: (e) => { if (!S.locked) { save('unload'); e.preventDefault(); e.returnValue = ''; } },
  popstate: () => { if (!S.locked) { history.pushState(null, '', location.href); report('back_navigation'); flash('Back navigation is disabled during the examination.'); } },
  offline: () => { report('offline'); flash('You are offline. Keep working – answers will be saved when the connection returns.'); },
  online: () => { report('online'); save('online'); },
};
function enableIntegrity() {
  if (S.listenersOn) return; S.listenersOn = true;
  history.pushState(null, '', location.href);
  for (const [ev, fn] of Object.entries(handlers)) (ev === 'visibilitychange' || ['copy', 'cut', 'paste', 'contextmenu', 'drop', 'keydown'].includes(ev) ? document : window).addEventListener(ev, fn);
}
function disableIntegrity() {
  if (!S.listenersOn) return; S.listenersOn = false;
  for (const [ev, fn] of Object.entries(handlers)) (ev === 'visibilitychange' || ['copy', 'cut', 'paste', 'contextmenu', 'drop', 'keydown'].includes(ev) ? document : window).removeEventListener(ev, fn);
}
function warnReturn() {
  S.warned++;
  const limit = S.state.config.tab_switch_warning_limit || 3;
  const final = S.warned >= limit;
  alertBox(final ? 'Final warning' : 'You left the examination window',
    `Leaving the exam window or switching tabs is not allowed and has been recorded (${S.tabCount ?? S.warned} time${(S.tabCount ?? S.warned) === 1 ? '' : 's'}). ${final ? 'Further activity will be reported to the recruitment team for review.' : 'Please stay on this page until you submit.'}`);
}
function flash(msg) {
  const t = h('div', { class: 'toast error', style: 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:120' }, msg);
  document.body.append(t); setTimeout(() => t.remove(), 3000);
}
function alertBox(title, msg) {
  const back = h('div', { class: 'overlay-warn', role: 'alertdialog', 'aria-modal': 'true' });
  const ok = h('button', { class: 'btn primary', onclick: () => back.remove() }, 'Return to examination');
  back.append(h('div', { class: 'box' }, h('h2', {}, title), h('p', {}, msg), ok));
  document.body.append(back); ok.focus();
}
function confirmBox(title, msg, okText) {
  return new Promise((res) => {
    const back = h('div', { class: 'overlay-warn', role: 'dialog', 'aria-modal': 'true' });
    back.append(h('div', { class: 'box' }, h('h2', {}, title), h('p', {}, msg), h('div', { class: 'btn-row', style: 'justify-content:center' },
      h('button', { class: 'btn', onclick: () => { back.remove(); res(false); } }, 'Cancel'), h('button', { class: 'btn primary', onclick: () => { back.remove(); res(true); } }, okText))));
    document.body.append(back);
  });
}
function handleErr(e) {
  if (e.code === 'SESSION_REVOKED') return fatal('Session ended', e.message);
  if (e.code === 'LOCKED' || e.code === 'ALREADY_SUBMITTED') return api('GET', '/state').then((s) => { S.state = s; showSubmitted(); }).catch(() => fatal('Submitted', e.message));
  if (e.code === 'TIME_UP') return submit('timer');
  if (e.status === 401) return fatal('Session expired', e.message, h('p', {}, h('a', { href: location.href }, 'Open the exam link again')));
  alertBox('Something went wrong', e.message);
}
boot();
